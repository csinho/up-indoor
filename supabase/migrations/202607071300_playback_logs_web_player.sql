-- Allow web player logs without a paired TV device.
alter table public.tv_playback_logs
  alter column device_id drop not null;

create index if not exists tv_playback_logs_ad_created_at_idx
  on public.tv_playback_logs (ad_id, created_at desc);

create index if not exists tv_playback_logs_event_created_at_idx
  on public.tv_playback_logs (event_type, created_at desc);

drop policy if exists tv_playback_logs_owner_select on public.tv_playback_logs;
create policy tv_playback_logs_owner_select on public.tv_playback_logs
  for select to authenticated
  using (
    exists (
      select 1
      from public.screens s
      where s.id = screen_id
        and s.owner_id = (select auth.uid())
    )
  );
