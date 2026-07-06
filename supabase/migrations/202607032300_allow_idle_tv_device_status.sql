alter table public.tv_devices
  drop constraint if exists tv_devices_status_check;

alter table public.tv_devices
  add constraint tv_devices_status_check
  check (
    status = any (
      array['pending', 'paired', 'online', 'idle', 'offline', 'error']
    )
  );
