begin;

alter table public.tv_devices
  add column if not exists app_state text not null default 'unknown',
  add column if not exists display_power text not null default 'unknown';

alter table public.tv_devices
  drop constraint if exists tv_devices_app_state_check;

alter table public.tv_devices
  add constraint tv_devices_app_state_check
  check (app_state in ('foreground', 'background', 'unknown'));

alter table public.tv_devices
  drop constraint if exists tv_devices_display_power_check;

alter table public.tv_devices
  add constraint tv_devices_display_power_check
  check (display_power in ('on', 'off', 'unknown'));

create or replace function public.evaluate_tv_device_health(
  p_status text,
  p_last_seen_at timestamptz,
  p_screen_id text,
  p_app_state text default 'unknown',
  p_display_power text default 'unknown'
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

  if elapsed_ms > 25000 then
    return 'problem';
  end if;

  if p_display_power = 'off' then
    return 'problem';
  end if;

  return 'online';
end;
$$;

create or replace function public.describe_tv_health_problem(
  p_status text,
  p_last_seen_at timestamptz,
  p_app_state text default 'unknown',
  p_display_power text default 'unknown'
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

  if p_display_power = 'off' then
    return 'TV desligada';
  end if;

  if p_last_seen_at is not null then
    elapsed_ms := extract(epoch from (now() - p_last_seen_at)) * 1000;
    if elapsed_ms > 25000 then
      return 'TV sem resposta';
    end if;
  end if;

  if p_app_state = 'background' or p_status = 'idle' then
    return 'app fechado';
  end if;

  return 'TV sem resposta';
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
    d.active,
    d.app_state,
    d.display_power
  into v_device
  from public.tv_devices d
  where d.id = v_device_id;

  if not found or not v_device.active then
    return;
  end if;

  v_health := public.evaluate_tv_device_health(
    v_device.status,
    v_device.last_seen_at,
    v_device.screen_id,
    v_device.app_state,
    v_device.display_power
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
      false,
      true
    );

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
      v_device.last_seen_at,
      v_device.app_state,
      v_device.display_power
    );

    insert into public.in_app_notifications (
      owner_id,
      type,
      screen_id,
      device_id,
      title,
      body,
      meta
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
      ),
      jsonb_build_object(
        'screenName', v_screen.name,
        'deviceName', v_device.device_name,
        'appState', v_device.app_state,
        'displayPower', v_device.display_power
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
    set status = 'offline'
    where id = v_device_id;

  elsif v_health = 'online' and v_snapshot.problem_open then
    insert into public.in_app_notifications (
      owner_id,
      type,
      screen_id,
      device_id,
      title,
      body,
      meta
    )
    values (
      v_screen.owner_id,
      'tv_recovered',
      v_screen.id,
      v_device_id,
      'TV normalizada',
      format('A TV "%s" voltou ao normal.', v_screen.name),
      jsonb_build_object(
        'screenName', v_screen.name,
        'deviceName', v_device.device_name,
        'appState', v_device.app_state,
        'displayPower', v_device.display_power
      )
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
    elsif v_health = 'problem' then
      update public.tv_devices
      set status = 'offline'
      where id = v_device_id;
    end if;
  end if;
end;
$$;

create or replace function public.trg_tv_devices_after_update_health()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.screen_id is not null then
    perform public.process_tv_screen_health(new.screen_id);
  end if;

  return new;
end;
$$;

drop trigger if exists tv_devices_realtime_health on public.tv_devices;

create trigger tv_devices_realtime_health
after update on public.tv_devices
for each row
when (
  old.last_seen_at is distinct from new.last_seen_at
  or old.status is distinct from new.status
  or old.app_state is distinct from new.app_state
  or old.display_power is distinct from new.display_power
)
execute function public.trg_tv_devices_after_update_health();

alter table public.tv_devices replica identity full;
alter table public.in_app_notifications replica identity full;
alter table public.tv_screen_health_snapshots replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tv_devices'
  ) then
    alter publication supabase_realtime add table public.tv_devices;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'in_app_notifications'
  ) then
    alter publication supabase_realtime add table public.in_app_notifications;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tv_screen_health_snapshots'
  ) then
    alter publication supabase_realtime add table public.tv_screen_health_snapshots;
  end if;
end;
$$;

commit;
