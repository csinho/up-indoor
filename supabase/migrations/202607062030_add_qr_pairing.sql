begin;

alter table public.tv_devices
  add column if not exists pairing_token text,
  add column if not exists pairing_token_expires_at timestamptz;

create unique index if not exists tv_devices_pairing_token_idx
  on public.tv_devices (pairing_token)
  where pairing_token is not null;

commit;
