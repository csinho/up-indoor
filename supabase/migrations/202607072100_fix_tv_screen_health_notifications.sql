begin;

create table if not exists public.tv_screen_health_snapshots (
  screen_id text primary key references public.screens (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  primary_device_id uuid references public.tv_devices (id) on delete set null,
  health_state text not null default 'setup'
    check (health_state in ('setup', 'online', 'problem')),
  problem_open boolean not null default false,
  baseline_established boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists tv_screen_health_snapshots_owner_id_idx
  on public.tv_screen_health_snapshots (owner_id);

create or replace function public.get_primary_tv_device_id(p_screen_id text)
returns uuid
language sql
stable
set search_path = public
as $$
  select d.id
  from public.tv_devices d
  where d.screen_id = p_screen_id
    and d.active
    and d.status <> 'pending'
  order by coalesce(d.last_seen_at, '1970-01-01 00:00:00+00'::timestamptz) desc,
    d.updated_at desc
  limit 1;
$$;

create or replace function public.describe_tv_health_problem(
  p_status text,
  p_last_seen_at timestamptz
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  elapsed_ms double precision;
begin
  if p_status = 'error' then
    return 'erro no app';
  end if;

  if p_last_seen_at is null then
    return 'sem sinal';
  end if;

  elapsed_ms := extract(epoch from (now() - p_last_seen_at)) * 1000;

  if p_status = 'idle' and elapsed_ms <= 45000 then
    return 'app fechado';
  end if;

  return 'sem sinal';
end;
$$;

create or replace function public.process_tv_screen_health(p_screen_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_id uuid;
  v_device record;
  v_screen record;
  v_health text;
  v_snapshot record;
  v_problem_label text;
begin
  select s.id, s.name, s.owner_id, s.active
  into v_screen
  from public.screens s
  where s.id = p_screen_id;

  if not found or not v_screen.active then
    return;
  end if;

  v_device_id := public.get_primary_tv_device_id(p_screen_id);
  if v_device_id is null then
    return;
  end if;

  select
    d.id,
    d.screen_id,
    d.status,
    d.last_seen_at,
    d.device_name,
    d.active
  into v_device
  from public.tv_devices d
  where d.id = v_device_id;

  if not found or not v_device.active then
    return;
  end if;

  v_health := public.evaluate_tv_device_health(
    v_device.status,
    v_device.last_seen_at,
    v_device.screen_id
  );

  if v_health = 'setup' then
    insert into public.tv_screen_health_snapshots (
      screen_id,
      owner_id,
      primary_device_id,
      health_state,
      problem_open,
      baseline_established
    )
    values (p_screen_id, v_screen.owner_id, v_device_id, 'setup', false, true)
    on conflict (screen_id) do update
      set
        owner_id = excluded.owner_id,
        primary_device_id = excluded.primary_device_id,
        health_state = 'setup',
        problem_open = false,
        baseline_established = true,
        updated_at = now();

    return;
  end if;

  select *
  into v_snapshot
  from public.tv_screen_health_snapshots
  where screen_id = p_screen_id;

  if not found then
    insert into public.tv_screen_health_snapshots (
      screen_id,
      owner_id,
      primary_device_id,
      health_state,
      problem_open,
      baseline_established
    )
    values (
      p_screen_id,
      v_screen.owner_id,
      v_device_id,
      v_health,
      v_health = 'problem',
      true
    );

    if v_health = 'problem' then
      update public.tv_devices
      set status = case
        when v_device.status = 'idle' then 'idle'
        else 'offline'
      end
      where id = v_device_id
        and v_device.last_seen_at is not null
        and v_device.last_seen_at < now() - interval '35 seconds';
    elsif v_health = 'online' then
      update public.tv_devices
      set status = 'online'
      where id = v_device_id;
    end if;

    return;
  end if;

  if v_snapshot.primary_device_id is distinct from v_device_id then
    update public.tv_screen_health_snapshots
    set primary_device_id = v_device_id, updated_at = now()
    where screen_id = p_screen_id;
  end if;

  if v_health = 'problem' and not v_snapshot.problem_open then
    v_problem_label := public.describe_tv_health_problem(
      v_device.status,
      v_device.last_seen_at
    );

    insert into public.in_app_notifications (
      owner_id,
      type,
      screen_id,
      device_id,
      title,
      body
    )
    values (
      v_screen.owner_id,
      'tv_problem',
      v_screen.id,
      v_device_id,
      'TV com problema',
      format(
        'A TV "%s" está com %s. Verifique o equipamento.',
        v_screen.name,
        v_problem_label
      )
    );

    update public.tv_screen_health_snapshots
    set
      health_state = 'problem',
      problem_open = true,
      primary_device_id = v_device_id,
      updated_at = now()
    where screen_id = p_screen_id;

    update public.tv_devices
    set status = case
      when v_device.status = 'idle'
        and v_device.last_seen_at is not null
        and v_device.last_seen_at >= now() - interval '45 seconds' then 'idle'
      else 'offline'
    end
    where id = v_device_id;

  elsif v_health = 'online' and v_snapshot.problem_open then
    insert into public.in_app_notifications (
      owner_id,
      type,
      screen_id,
      device_id,
      title,
      body
    )
    values (
      v_screen.owner_id,
      'tv_recovered',
      v_screen.id,
      v_device_id,
      'TV normalizada',
      format('A TV "%s" voltou ao normal.', v_screen.name)
    );

    update public.tv_screen_health_snapshots
    set
      health_state = 'online',
      problem_open = false,
      primary_device_id = v_device_id,
      updated_at = now()
    where screen_id = p_screen_id;

    update public.tv_devices
    set status = 'online'
    where id = v_device_id;

  else
    update public.tv_screen_health_snapshots
    set
      health_state = v_health,
      primary_device_id = v_device_id,
      updated_at = now()
    where screen_id = p_screen_id;

    if v_health = 'online' then
      update public.tv_devices
      set status = 'online'
      where id = v_device_id;
    elsif v_health = 'problem'
      and v_device.last_seen_at is not null
      and v_device.last_seen_at < now() - interval '35 seconds' then
      update public.tv_devices
      set status = 'offline'
      where id = v_device_id;
    end if;
  end if;
end;
$$;

create or replace function public.process_tv_device_health(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_screen_id text;
begin
  select d.screen_id
  into v_screen_id
  from public.tv_devices d
  where d.id = p_device_id;

  if v_screen_id is null then
    return;
  end if;

  perform public.process_tv_screen_health(v_screen_id);
end;
$$;

create or replace function public.sync_tv_health_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_screen record;
  v_count integer := 0;
begin
  for v_screen in
    select distinct d.screen_id
    from public.tv_devices d
    where d.active
      and d.screen_id is not null
      and d.status <> 'pending'
  loop
    perform public.process_tv_screen_health(v_screen.screen_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.sync_my_tv_health_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_screen record;
begin
  for v_screen in
    select s.id
    from public.screens s
    where s.owner_id = (select auth.uid())
      and s.active
  loop
    perform public.process_tv_screen_health(v_screen.id);
  end loop;
end;
$$;

alter table public.tv_screen_health_snapshots enable row level security;

drop policy if exists tv_screen_health_snapshots_owner_select
  on public.tv_screen_health_snapshots;
create policy tv_screen_health_snapshots_owner_select
  on public.tv_screen_health_snapshots
  for select to authenticated
  using (owner_id = (select auth.uid()));

grant select on public.tv_screen_health_snapshots to authenticated;
grant execute on function public.get_primary_tv_device_id(text) to authenticated;
grant execute on function public.process_tv_screen_health(text) to service_role;

-- Reset stuck per-device snapshots from the first rollout.
delete from public.tv_health_snapshots;

-- Establish a clean baseline for active screens without sending notifications.
insert into public.tv_screen_health_snapshots (
  screen_id,
  owner_id,
  primary_device_id,
  health_state,
  problem_open,
  baseline_established
)
select
  s.id,
  s.owner_id,
  public.get_primary_tv_device_id(s.id),
  public.evaluate_tv_device_health(d.status, d.last_seen_at, d.screen_id),
  false,
  true
from public.screens s
join lateral (
  select d.status, d.last_seen_at, d.screen_id, d.id
  from public.tv_devices d
  where d.id = public.get_primary_tv_device_id(s.id)
) d on true
where s.active
  and public.get_primary_tv_device_id(s.id) is not null
on conflict (screen_id) do update
  set
    owner_id = excluded.owner_id,
    primary_device_id = excluded.primary_device_id,
    health_state = excluded.health_state,
    problem_open = false,
    baseline_established = true,
    updated_at = now();

commit;
