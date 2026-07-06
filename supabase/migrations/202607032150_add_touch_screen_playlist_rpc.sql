create or replace function public.touch_screen_playlist(target_screen_id text)
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.screens
  set playlist_version = playlist_version + 1,
      playlist_updated_at = timezone('utc'::text, now())
  where id = target_screen_id;
end;
$$;

grant execute on function public.touch_screen_playlist(text) to authenticated;
grant execute on function public.touch_screen_playlist(text) to service_role;
