begin;

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

  if p_status in ('error', 'idle', 'offline') then
    return 'problem';
  end if;

  if p_last_seen_at is null then
    return 'problem';
  end if;

  elapsed_ms := extract(epoch from (now() - p_last_seen_at)) * 1000;

  if p_status = 'online' and elapsed_ms <= 35000 then
    return 'online';
  end if;

  return 'problem';
end;
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
begin
  if p_status = 'error' then
    return 'erro no app';
  end if;

  return 'TV desligada ou sem resposta';
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
    set status = 'offline'
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
    else
      update public.tv_devices
      set status = 'offline'
      where id = v_device_id;
    end if;
  end if;
end;
$$;

delete from public.tv_playback_logs
where screen_id = 'quarto'
   or device_id = '38ea4e24-151c-4fa1-ac26-0584aa5fe73e'::uuid;

delete from public.tv_device_heartbeats
where screen_id = 'quarto'
   or device_id = '38ea4e24-151c-4fa1-ac26-0584aa5fe73e'::uuid;

delete from public.in_app_notifications
where screen_id = 'quarto'
   or device_id = '38ea4e24-151c-4fa1-ac26-0584aa5fe73e'::uuid;

delete from public.tv_screen_health_snapshots
where screen_id = 'quarto';

delete from public.tv_health_snapshots
where screen_id = 'quarto';

delete from public.tv_devices
where screen_id = 'quarto'
   or id = '38ea4e24-151c-4fa1-ac26-0584aa5fe73e'::uuid;

delete from public.company_screens
where screen_id = 'quarto';

update public.ads
set screen_ids = array_remove(screen_ids, 'quarto')
where 'quarto' = any(screen_ids);

delete from public.screens
where id = 'quarto';

commit;
