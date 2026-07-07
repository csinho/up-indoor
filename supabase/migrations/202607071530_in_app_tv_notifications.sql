begin;

create table if not exists public.tv_health_snapshots (
  device_id uuid primary key references public.tv_devices (id) on delete cascade,
  screen_id text not null references public.screens (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  health_state text not null default 'setup'
    check (health_state in ('setup', 'online', 'problem')),
  problem_open boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists tv_health_snapshots_owner_id_idx
  on public.tv_health_snapshots (owner_id);

create table if not exists public.in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('tv_problem', 'tv_recovered')),
  screen_id text references public.screens (id) on delete cascade,
  device_id uuid references public.tv_devices (id) on delete set null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists in_app_notifications_owner_created_idx
  on public.in_app_notifications (owner_id, created_at desc);

create index if not exists in_app_notifications_owner_unread_idx
  on public.in_app_notifications (owner_id)
  where read_at is null;

create table if not exists public.system_sync_state (
  key text primary key,
  last_run_at timestamptz not null default '1970-01-01 00:00:00+00'::timestamptz
);

insert into public.system_sync_state (key, last_run_at)
values ('tv_health_notifications', '1970-01-01 00:00:00+00'::timestamptz)
on conflict (key) do nothing;

create or replace function public.evaluate_tv_device_health(
  p_status text,
  p_last_seen_at timestamptz,
  p_screen_id text
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  elapsed_ms double precision;
begin
  if p_screen_id is null then
    return 'setup';
  end if;

  if p_status = 'pending' then
    return 'setup';
  end if;

  if p_status = 'error' then
    return 'problem';
  end if;

  if p_last_seen_at is null then
    return 'problem';
  end if;

  elapsed_ms := extract(epoch from (now() - p_last_seen_at)) * 1000;

  if p_status = 'idle' and elapsed_ms <= 45000 then
    return 'problem';
  end if;

  if elapsed_ms <= 35000 then
    return 'online';
  end if;

  return 'problem';
end;
$$;

create or replace function public.process_tv_device_health(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device record;
  v_screen record;
  v_health text;
  v_snapshot record;
  v_problem_label text;
begin
  select
    d.id,
    d.screen_id,
    d.status,
    d.last_seen_at,
    d.device_name,
    d.active
  into v_device
  from public.tv_devices d
  where d.id = p_device_id;

  if not found or not v_device.active then
    return;
  end if;

  select s.id, s.name, s.owner_id, s.active
  into v_screen
  from public.screens s
  where s.id = v_device.screen_id;

  if not found or not v_screen.active then
    return;
  end if;

  v_health := public.evaluate_tv_device_health(
    v_device.status,
    v_device.last_seen_at,
    v_device.screen_id
  );

  if v_health = 'setup' then
    insert into public.tv_health_snapshots (
      device_id,
      screen_id,
      owner_id,
      health_state,
      problem_open
    )
    values (p_device_id, v_screen.id, v_screen.owner_id, 'setup', false)
    on conflict (device_id) do update
      set
        screen_id = excluded.screen_id,
        owner_id = excluded.owner_id,
        health_state = 'setup',
        updated_at = now();

    return;
  end if;

  select *
  into v_snapshot
  from public.tv_health_snapshots
  where device_id = p_device_id;

  if not found then
    insert into public.tv_health_snapshots (
      device_id,
      screen_id,
      owner_id,
      health_state,
      problem_open
    )
    values (p_device_id, v_screen.id, v_screen.owner_id, v_health, false);

    select *
    into v_snapshot
    from public.tv_health_snapshots
    where device_id = p_device_id;
  end if;

  if v_health = 'problem' and not v_snapshot.problem_open then
    v_problem_label := case
      when v_device.status = 'error' then 'erro no app'
      when v_device.status = 'idle' then 'app fechado'
      else 'sem sinal'
    end;

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
      p_device_id,
      'TV com problema',
      format(
        'A TV "%s" está com %s. Verifique o equipamento.',
        v_screen.name,
        v_problem_label
      )
    );

    update public.tv_health_snapshots
    set
      health_state = 'problem',
      problem_open = true,
      updated_at = now()
    where device_id = p_device_id;

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
      p_device_id,
      'TV normalizada',
      format('A TV "%s" voltou ao normal.', v_screen.name)
    );

    update public.tv_health_snapshots
    set
      health_state = 'online',
      problem_open = false,
      updated_at = now()
    where device_id = p_device_id;

  else
    update public.tv_health_snapshots
    set
      health_state = v_health,
      updated_at = now()
    where device_id = p_device_id;
  end if;
end;
$$;

create or replace function public.sync_tv_health_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device record;
  v_count integer := 0;
begin
  for v_device in
    select d.id
    from public.tv_devices d
    where d.active
      and d.screen_id is not null
      and d.status <> 'pending'
  loop
    perform public.process_tv_device_health(v_device.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.sync_tv_health_notifications_if_due(
  p_min_interval_seconds integer default 30
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_run timestamptz;
begin
  select last_run_at
  into v_last_run
  from public.system_sync_state
  where key = 'tv_health_notifications'
  for update;

  if not found then
    insert into public.system_sync_state (key, last_run_at)
    values ('tv_health_notifications', now());
    perform public.sync_tv_health_notifications();
    return true;
  end if;

  if v_last_run > now() - make_interval(secs => p_min_interval_seconds) then
    return false;
  end if;

  update public.system_sync_state
  set last_run_at = now()
  where key = 'tv_health_notifications';

  perform public.sync_tv_health_notifications();
  return true;
end;
$$;

create or replace function public.sync_my_tv_health_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device record;
begin
  for v_device in
    select d.id
    from public.tv_devices d
    join public.screens s on s.id = d.screen_id
    where s.owner_id = (select auth.uid())
      and d.active
      and d.screen_id is not null
      and d.status <> 'pending'
  loop
    perform public.process_tv_device_health(v_device.id);
  end loop;
end;
$$;

alter table public.tv_health_snapshots enable row level security;
alter table public.in_app_notifications enable row level security;
alter table public.system_sync_state enable row level security;

drop policy if exists tv_health_snapshots_owner_select on public.tv_health_snapshots;
create policy tv_health_snapshots_owner_select on public.tv_health_snapshots
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists in_app_notifications_owner_select on public.in_app_notifications;
create policy in_app_notifications_owner_select on public.in_app_notifications
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists in_app_notifications_owner_update on public.in_app_notifications;
create policy in_app_notifications_owner_update on public.in_app_notifications
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

grant select, update on public.in_app_notifications to authenticated;
grant select on public.tv_health_snapshots to authenticated;
grant execute on function public.sync_my_tv_health_notifications() to authenticated;
grant execute on function public.sync_tv_health_notifications() to service_role;
grant execute on function public.sync_tv_health_notifications_if_due(integer) to service_role;
grant execute on function public.process_tv_device_health(uuid) to service_role;

commit;
