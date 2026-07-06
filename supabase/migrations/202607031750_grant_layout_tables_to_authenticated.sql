begin;

grant select on public.layout_templates to anon;
grant select, insert, update, delete on public.layout_templates to authenticated;
grant select, insert, update, delete on public.layout_templates to service_role;

grant select on public.layout_regions to anon;
grant select, insert, update, delete on public.layout_regions to authenticated;
grant select, insert, update, delete on public.layout_regions to service_role;

grant select on public.layout_region_items to anon;
grant select, insert, update, delete on public.layout_region_items to authenticated;
grant select, insert, update, delete on public.layout_region_items to service_role;

commit;
