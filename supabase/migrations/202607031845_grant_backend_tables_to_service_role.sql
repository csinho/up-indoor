begin;

grant select, insert, update, delete on public.screens to service_role;
grant select, insert, update, delete on public.ads to service_role;

grant select, insert, update, delete on public.tv_devices to service_role;
grant select, insert, update, delete on public.tv_device_heartbeats to service_role;
grant select, insert, update, delete on public.tv_playback_logs to service_role;

grant select, insert, update, delete on public.layout_templates to service_role;
grant select, insert, update, delete on public.layout_regions to service_role;
grant select, insert, update, delete on public.layout_region_items to service_role;

commit;
