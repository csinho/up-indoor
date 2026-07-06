insert into storage.buckets (id, name, public)
values ('ad-media', 'ad-media', true)
on conflict (id) do update
set public = excluded.public;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'ad_media_public_read'
  ) then
    create policy ad_media_public_read on storage.objects
      for select
      using (bucket_id = 'ad-media');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'ad_media_authenticated_insert'
  ) then
    create policy ad_media_authenticated_insert on storage.objects
      for insert to authenticated
      with check (bucket_id = 'ad-media');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'ad_media_authenticated_update'
  ) then
    create policy ad_media_authenticated_update on storage.objects
      for update to authenticated
      using (bucket_id = 'ad-media')
      with check (bucket_id = 'ad-media');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'ad_media_authenticated_delete'
  ) then
    create policy ad_media_authenticated_delete on storage.objects
      for delete to authenticated
      using (bucket_id = 'ad-media');
  end if;
end $$;
