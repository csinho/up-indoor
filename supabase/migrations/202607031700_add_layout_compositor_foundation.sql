begin;

alter table public.ads
  add column if not exists preferred_orientation text not null default 'any';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ads_preferred_orientation_check'
      and conrelid = 'public.ads'::regclass
  ) then
    alter table public.ads
      add constraint ads_preferred_orientation_check
      check (preferred_orientation = any (array['landscape', 'portrait', 'any']));
  end if;
end $$;

create table if not exists public.layout_templates (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  description text not null default '',
  orientation text not null default 'landscape'
    check (orientation = any (array['landscape', 'portrait'])),
  canvas_width integer not null default 1920 check (canvas_width > 0),
  canvas_height integer not null default 1080 check (canvas_height > 0),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint layout_templates_name_check check (char_length(trim(name)) > 0)
);

create table if not exists public.layout_regions (
  id uuid primary key default extensions.gen_random_uuid(),
  layout_template_id uuid not null references public.layout_templates(id) on delete cascade,
  name text not null,
  region_type text not null check (region_type = any (array['media', 'banner'])),
  x integer not null default 0 check (x >= 0),
  y integer not null default 0 check (y >= 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  z_index integer not null default 1 check (z_index > 0),
  background text not null default 'transparent',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint layout_regions_name_check check (char_length(trim(name)) > 0)
);

create table if not exists public.layout_region_items (
  id uuid primary key default extensions.gen_random_uuid(),
  layout_region_id uuid not null references public.layout_regions(id) on delete cascade,
  item_type text not null check (item_type = any (array['ad', 'banner'])),
  ad_id uuid references public.ads(id) on delete set null,
  title text not null default '',
  banner_text text,
  background text not null default '#111827',
  text_color text not null default '#ffffff',
  fit_mode text not null default 'cover'
    check (fit_mode = any (array['cover', 'contain'])),
  position integer not null default 1 check (position > 0),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists layout_regions_template_id_idx
  on public.layout_regions (layout_template_id, z_index asc);

create index if not exists layout_region_items_region_id_idx
  on public.layout_region_items (layout_region_id, position asc);

create index if not exists layout_region_items_ad_id_idx
  on public.layout_region_items (ad_id);

alter table public.screens
  add column if not exists orientation text not null default 'landscape',
  add column if not exists resolution_width integer not null default 1920,
  add column if not exists resolution_height integer not null default 1080,
  add column if not exists layout_template_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'screens_orientation_check'
      and conrelid = 'public.screens'::regclass
  ) then
    alter table public.screens
      add constraint screens_orientation_check
      check (orientation = any (array['landscape', 'portrait']));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'screens_resolution_width_check'
      and conrelid = 'public.screens'::regclass
  ) then
    alter table public.screens
      add constraint screens_resolution_width_check
      check (resolution_width > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'screens_resolution_height_check'
      and conrelid = 'public.screens'::regclass
  ) then
    alter table public.screens
      add constraint screens_resolution_height_check
      check (resolution_height > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'screens_layout_template_id_fkey'
      and conrelid = 'public.screens'::regclass
  ) then
    alter table public.screens
      add constraint screens_layout_template_id_fkey
      foreign key (layout_template_id)
      references public.layout_templates(id)
      on delete set null;
  end if;
end $$;

create index if not exists screens_layout_template_id_idx
  on public.screens (layout_template_id);

create or replace function public.touch_layout_template_screens(target_layout_template_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.screens
  set playlist_version = playlist_version + 1,
      playlist_updated_at = timezone('utc'::text, now())
  where layout_template_id = target_layout_template_id;
end;
$$;

create or replace function public.touch_layout_region_screens(target_region_ids uuid[])
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.screens
  set playlist_version = playlist_version + 1,
      playlist_updated_at = timezone('utc'::text, now())
  where layout_template_id in (
    select distinct layout_template_id
    from public.layout_regions
    where id = any(coalesce(target_region_ids, '{}'::uuid[]))
  );
end;
$$;

create or replace function public.bump_playlist_version_from_screen_settings()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if row(
      new.active,
      new.sound_enabled,
      new.volume,
      new.orientation,
      new.resolution_width,
      new.resolution_height,
      new.layout_template_id
    ) is distinct from row(
      old.active,
      old.sound_enabled,
      old.volume,
      old.orientation,
      old.resolution_width,
      old.resolution_height,
      old.layout_template_id
    ) then
    new.playlist_version := old.playlist_version + 1;
    new.playlist_updated_at := timezone('utc'::text, now());
  end if;

  return new;
end;
$$;

create or replace function public.bump_playlist_version_from_layout_templates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.touch_layout_template_screens(coalesce(new.id, old.id));
  return coalesce(new, old);
end;
$$;

create or replace function public.bump_playlist_version_from_layout_regions()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.touch_layout_template_screens(new.layout_template_id);
  elsif tg_op = 'DELETE' then
    perform public.touch_layout_template_screens(old.layout_template_id);
  else
    perform public.touch_layout_template_screens(old.layout_template_id);
    perform public.touch_layout_template_screens(new.layout_template_id);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.bump_playlist_version_from_layout_region_items()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.touch_layout_region_screens(array[new.layout_region_id]);
  elsif tg_op = 'DELETE' then
    perform public.touch_layout_region_screens(array[old.layout_region_id]);
  else
    perform public.touch_layout_region_screens(array[old.layout_region_id, new.layout_region_id]);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists screens_touch_playlist_version on public.screens;
create trigger screens_touch_playlist_version
before update on public.screens
for each row execute function public.bump_playlist_version_from_screen_settings();

drop trigger if exists layout_templates_set_updated_at on public.layout_templates;
create trigger layout_templates_set_updated_at
before update on public.layout_templates
for each row execute function public.set_updated_at();

drop trigger if exists layout_regions_set_updated_at on public.layout_regions;
create trigger layout_regions_set_updated_at
before update on public.layout_regions
for each row execute function public.set_updated_at();

drop trigger if exists layout_region_items_set_updated_at on public.layout_region_items;
create trigger layout_region_items_set_updated_at
before update on public.layout_region_items
for each row execute function public.set_updated_at();

drop trigger if exists layout_templates_touch_playlists on public.layout_templates;
create trigger layout_templates_touch_playlists
after insert or update or delete on public.layout_templates
for each row execute function public.bump_playlist_version_from_layout_templates();

drop trigger if exists layout_regions_touch_playlists on public.layout_regions;
create trigger layout_regions_touch_playlists
after insert or update or delete on public.layout_regions
for each row execute function public.bump_playlist_version_from_layout_regions();

drop trigger if exists layout_region_items_touch_playlists on public.layout_region_items;
create trigger layout_region_items_touch_playlists
after insert or update or delete on public.layout_region_items
for each row execute function public.bump_playlist_version_from_layout_region_items();

alter table public.layout_templates enable row level security;
alter table public.layout_regions enable row level security;
alter table public.layout_region_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'layout_templates' and policyname = 'layout_templates_authenticated_select'
  ) then
    create policy layout_templates_authenticated_select on public.layout_templates
      for select to authenticated
      using (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'layout_templates' and policyname = 'layout_templates_authenticated_insert'
  ) then
    create policy layout_templates_authenticated_insert on public.layout_templates
      for insert to authenticated
      with check (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'layout_templates' and policyname = 'layout_templates_authenticated_update'
  ) then
    create policy layout_templates_authenticated_update on public.layout_templates
      for update to authenticated
      using (((select auth.uid()) is not null))
      with check (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'layout_templates' and policyname = 'layout_templates_authenticated_delete'
  ) then
    create policy layout_templates_authenticated_delete on public.layout_templates
      for delete to authenticated
      using (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'layout_regions' and policyname = 'layout_regions_authenticated_select'
  ) then
    create policy layout_regions_authenticated_select on public.layout_regions
      for select to authenticated
      using (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'layout_regions' and policyname = 'layout_regions_authenticated_insert'
  ) then
    create policy layout_regions_authenticated_insert on public.layout_regions
      for insert to authenticated
      with check (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'layout_regions' and policyname = 'layout_regions_authenticated_update'
  ) then
    create policy layout_regions_authenticated_update on public.layout_regions
      for update to authenticated
      using (((select auth.uid()) is not null))
      with check (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'layout_regions' and policyname = 'layout_regions_authenticated_delete'
  ) then
    create policy layout_regions_authenticated_delete on public.layout_regions
      for delete to authenticated
      using (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'layout_region_items' and policyname = 'layout_region_items_authenticated_select'
  ) then
    create policy layout_region_items_authenticated_select on public.layout_region_items
      for select to authenticated
      using (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'layout_region_items' and policyname = 'layout_region_items_authenticated_insert'
  ) then
    create policy layout_region_items_authenticated_insert on public.layout_region_items
      for insert to authenticated
      with check (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'layout_region_items' and policyname = 'layout_region_items_authenticated_update'
  ) then
    create policy layout_region_items_authenticated_update on public.layout_region_items
      for update to authenticated
      using (((select auth.uid()) is not null))
      with check (((select auth.uid()) is not null));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'layout_region_items' and policyname = 'layout_region_items_authenticated_delete'
  ) then
    create policy layout_region_items_authenticated_delete on public.layout_region_items
      for delete to authenticated
      using (((select auth.uid()) is not null));
  end if;
end $$;

commit;
