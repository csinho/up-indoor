begin;

alter table public.tv_devices
  add column if not exists device_code text;

create unique index if not exists tv_devices_device_code_idx
  on public.tv_devices (device_code)
  where device_code is not null;

commit;
