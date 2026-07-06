alter table public.screens
  add column if not exists display_mode text not null default 'normal';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'screens_display_mode_check'
  ) then
    alter table public.screens
      add constraint screens_display_mode_check
      check (display_mode = any (array['normal', 'rotate_90', 'rotate_270', 'fill']));
  end if;
end
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
      new.display_mode,
      new.resolution_width,
      new.resolution_height,
      new.layout_template_id
    ) is distinct from row(
      old.active,
      old.sound_enabled,
      old.volume,
      old.orientation,
      old.display_mode,
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
