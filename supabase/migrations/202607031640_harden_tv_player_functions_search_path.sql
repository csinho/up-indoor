begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

create or replace function public.touch_screen_playlists(target_screen_ids text[])
returns void
language plpgsql
set search_path = public
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
set search_path = public
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
set search_path = public
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

commit;
