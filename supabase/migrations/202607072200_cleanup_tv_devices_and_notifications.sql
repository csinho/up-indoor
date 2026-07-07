begin;

delete from public.in_app_notifications;
delete from public.tv_health_snapshots;
delete from public.tv_screen_health_snapshots;

update public.system_sync_state
set last_run_at = '1970-01-01 00:00:00+00'::timestamptz
where key = 'tv_health_notifications';

with ranked_devices as (
  select
    d.id,
    d.screen_id,
    row_number() over (
      partition by d.screen_id
      order by coalesce(d.last_seen_at, '1970-01-01 00:00:00+00'::timestamptz) desc,
        d.updated_at desc
    ) as rn
  from public.tv_devices d
  where d.screen_id is not null
    and d.active
    and d.status <> 'pending'
)
delete from public.tv_devices d
using ranked_devices r
where d.id = r.id
  and r.rn > 1;

delete from public.tv_devices
where screen_id is null
   or status = 'pending';

truncate table public.tv_device_heartbeats;

insert into public.tv_screen_health_snapshots (
  screen_id,
  owner_id,
  primary_device_id,
  health_state,
  problem_open,
  baseline_established
)
select
  s.id,
  s.owner_id,
  public.get_primary_tv_device_id(s.id),
  public.evaluate_tv_device_health(d.status, d.last_seen_at, d.screen_id),
  false,
  true
from public.screens s
join lateral (
  select d.status, d.last_seen_at, d.screen_id
  from public.tv_devices d
  where d.id = public.get_primary_tv_device_id(s.id)
) d on true
where s.active
  and public.get_primary_tv_device_id(s.id) is not null;

commit;
