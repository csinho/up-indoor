begin;

alter table public.screens
  add column if not exists playlist_version bigint not null default 1,
  add column if not exists playlist_updated_at timestamptz not null default timezone('utc'::text, now()),
  add column if not exists sound_enabled boolean not null default false,
  add column if not exists volume integer not null default 50;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'screens_volume_range_check'
      and conrelid = 'public.screens'::regclass
  ) then
    alter table public.screens
      add constraint screens_volume_range_check check (volume between 0 and 100);
  end if;
end $$;

alter table public.ads
  add column if not exists position integer;

with ordered as (
  select id, row_number() over (order by created_at asc, id asc) as seq
  from public.ads
)
update public.ads as ads
set position = ordered.seq
from ordered
where ads.id = ordered.id
  and (ads.position is null or ads.position <= 0);

update public.ads
set position = 1
where position is null;

alter table public.ads
  alter column position set default 1,
  alter column position set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ads_position_positive_check'
      and conrelid = 'public.ads'::regclass
  ) then
    alter table public.ads
      add constraint ads_position_positive_check check (position > 0);
  end if;
end $$;

create index if not exists ads_position_created_at_idx
  on public.ads (position asc, created_at asc, id asc);

create index if not exists screens_playlist_updated_at_idx
  on public.screens (playlist_updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

create or replace function public.touch_screen_playlists(target_screen_ids text[])
returns void
language plpgsql
as $$
begin
  update public.screens
  set playlist_version = playlist_version + 1,
      playlist_updated_at = timezone('utc'::text, now())
  where id = any(coalesce(target_screen_ids, '{}'::text[]));
end;
$$;

create or replace function public.bump_playlist_version_from_ads()
returns trigger
language plpgsql
as $$
declare
  affected_screen_ids text[];
begin
  if tg_op = 'INSERT' then
    affected_screen_ids := coalesce(new.screen_ids, '{}'::text[]);
  elsif tg_op = 'DELETE' then
    affected_screen_ids := coalesce(old.screen_ids, '{}'::text[]);
  else
    select coalesce(array_agg(distinct screen_id), '{}'::text[])
      into affected_screen_ids
    from unnest(
      coalesce(old.screen_ids, '{}'::text[]) || coalesce(new.screen_ids, '{}'::text[])
    ) as screen_id;
  end if;

  perform public.touch_screen_playlists(affected_screen_ids);
  return coalesce(new, old);
end;
$$;

create or replace function public.bump_playlist_version_from_screen_settings()
returns trigger
language plpgsql
as $$
begin
  if row(new.active, new.sound_enabled, new.volume)
      is distinct from row(old.active, old.sound_enabled, old.volume) then
    new.playlist_version := old.playlist_version + 1;
    new.playlist_updated_at := timezone('utc'::text, now());
  end if;

  return new;
end;
$$;

drop trigger if exists ads_touch_screen_playlists on public.ads;
create trigger ads_touch_screen_playlists
after insert or update or delete on public.ads
for each row execute function public.bump_playlist_version_from_ads();

drop trigger if exists screens_touch_playlist_version on public.screens;
create trigger screens_touch_playlist_version
before update on public.screens
for each row execute function public.bump_playlist_version_from_screen_settings();

create table if not exists public.tv_devices (
  id uuid primary key default extensions.gen_random_uuid(),
  device_name text not null default '',
  platform text not null default 'android_tv',
  pairing_code text,
  pairing_code_expires_at timestamptz,
  screen_id text references public.screens(id) on delete set null,
  status text not null default 'pending' check (status = any (array['pending', 'paired', 'online', 'offline', 'error'])),
  app_version text not null default '',
  os_version text not null default '',
  last_seen_at timestamptz,
  last_playlist_version bigint,
  last_ip inet,
  meta jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  paired_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists tv_devices_pairing_code_idx
  on public.tv_devices (pairing_code)
  where pairing_code is not null;

create index if not exists tv_devices_screen_id_idx
  on public.tv_devices (screen_id);

create index if not exists tv_devices_status_idx
  on public.tv_devices (status, active);

create index if not exists tv_devices_last_seen_at_idx
  on public.tv_devices (last_seen_at desc);

drop trigger if exists tv_devices_set_updated_at on public.tv_devices;
create trigger tv_devices_set_updated_at
before update on public.tv_devices
for each row execute function public.set_updated_at();

create table if not exists public.tv_device_heartbeats (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.tv_devices(id) on delete cascade,
  screen_id text references public.screens(id) on delete set null,
  status text not null default 'online' check (status = any (array['online', 'idle', 'syncing', 'playing', 'error', 'offline'])),
  playlist_version bigint,
  current_ad_id uuid references public.ads(id) on delete set null,
  network_state text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists tv_device_heartbeats_device_created_at_idx
  on public.tv_device_heartbeats (device_id, created_at desc);

create index if not exists tv_device_heartbeats_screen_created_at_idx
  on public.tv_device_heartbeats (screen_id, created_at desc);

create table if not exists public.tv_playback_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  device_id uuid not null references public.tv_devices(id) on delete cascade,
  screen_id text references public.screens(id) on delete set null,
  ad_id uuid references public.ads(id) on delete set null,
  event_type text not null check (event_type = any (array['started', 'completed', 'skipped', 'failed', 'downloaded', 'sync_applied'])),
  message text not null default '',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists tv_playback_logs_device_created_at_idx
  on public.tv_playback_logs (device_id, created_at desc);

create index if not exists tv_playback_logs_screen_created_at_idx
  on public.tv_playback_logs (screen_id, created_at desc);

alter table public.tv_devices enable row level security;
alter table public.tv_device_heartbeats enable row level security;
alter table public.tv_playback_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tv_devices' and policyname = 'tv_devices_authenticated_select'
  ) then
    create policy tv_devices_authenticated_select on public.tv_devices
      for select to authenticated
      using (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tv_devices' and policyname = 'tv_devices_authenticated_insert'
  ) then
    create policy tv_devices_authenticated_insert on public.tv_devices
      for insert to authenticated
      with check (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tv_devices' and policyname = 'tv_devices_authenticated_update'
  ) then
    create policy tv_devices_authenticated_update on public.tv_devices
      for update to authenticated
      using (((select auth.uid()) is not null))
      with check (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tv_devices' and policyname = 'tv_devices_authenticated_delete'
  ) then
    create policy tv_devices_authenticated_delete on public.tv_devices
      for delete to authenticated
      using (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tv_device_heartbeats' and policyname = 'tv_device_heartbeats_authenticated_select'
  ) then
    create policy tv_device_heartbeats_authenticated_select on public.tv_device_heartbeats
      for select to authenticated
      using (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tv_device_heartbeats' and policyname = 'tv_device_heartbeats_authenticated_insert'
  ) then
    create policy tv_device_heartbeats_authenticated_insert on public.tv_device_heartbeats
      for insert to authenticated
      with check (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tv_device_heartbeats' and policyname = 'tv_device_heartbeats_authenticated_update'
  ) then
    create policy tv_device_heartbeats_authenticated_update on public.tv_device_heartbeats
      for update to authenticated
      using (((select auth.uid()) is not null))
      with check (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tv_device_heartbeats' and policyname = 'tv_device_heartbeats_authenticated_delete'
  ) then
    create policy tv_device_heartbeats_authenticated_delete on public.tv_device_heartbeats
      for delete to authenticated
      using (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tv_playback_logs' and policyname = 'tv_playback_logs_authenticated_select'
  ) then
    create policy tv_playback_logs_authenticated_select on public.tv_playback_logs
      for select to authenticated
      using (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tv_playback_logs' and policyname = 'tv_playback_logs_authenticated_insert'
  ) then
    create policy tv_playback_logs_authenticated_insert on public.tv_playback_logs
      for insert to authenticated
      with check (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tv_playback_logs' and policyname = 'tv_playback_logs_authenticated_update'
  ) then
    create policy tv_playback_logs_authenticated_update on public.tv_playback_logs
      for update to authenticated
      using (((select auth.uid()) is not null))
      with check (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tv_playback_logs' and policyname = 'tv_playback_logs_authenticated_delete'
  ) then
    create policy tv_playback_logs_authenticated_delete on public.tv_playback_logs
      for delete to authenticated
      using (((select auth.uid()) is not null));
  end if;
end $$;

commit;
