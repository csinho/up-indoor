begin;

alter table public.screens
  add column if not exists owner_id uuid references auth.users(id);

alter table public.ads
  add column if not exists owner_id uuid references auth.users(id);

alter table public.stores
  add column if not exists owner_id uuid references auth.users(id);

alter table public.companies
  add column if not exists owner_id uuid references auth.users(id);

alter table public.layout_templates
  add column if not exists owner_id uuid references auth.users(id);

update public.screens
set owner_id = '4a8b0a1f-098a-4cc8-b76c-2a80f1c8923b'
where owner_id is null;

update public.ads
set owner_id = '4a8b0a1f-098a-4cc8-b76c-2a80f1c8923b'
where owner_id is null;

update public.stores
set owner_id = '4a8b0a1f-098a-4cc8-b76c-2a80f1c8923b'
where owner_id is null;

update public.companies
set owner_id = '4a8b0a1f-098a-4cc8-b76c-2a80f1c8923b'
where owner_id is null;

update public.layout_templates
set owner_id = '4a8b0a1f-098a-4cc8-b76c-2a80f1c8923b'
where owner_id is null;

alter table public.screens alter column owner_id set not null;
alter table public.ads alter column owner_id set not null;
alter table public.stores alter column owner_id set not null;
alter table public.companies alter column owner_id set not null;
alter table public.layout_templates alter column owner_id set not null;

alter table public.screens alter column owner_id set default auth.uid();
alter table public.ads alter column owner_id set default auth.uid();
alter table public.stores alter column owner_id set default auth.uid();
alter table public.companies alter column owner_id set default auth.uid();
alter table public.layout_templates alter column owner_id set default auth.uid();

create index if not exists screens_owner_id_idx on public.screens (owner_id);
create index if not exists ads_owner_id_idx on public.ads (owner_id);
create index if not exists stores_owner_id_idx on public.stores (owner_id);
create index if not exists companies_owner_id_idx on public.companies (owner_id);
create index if not exists layout_templates_owner_id_idx on public.layout_templates (owner_id);

-- Screens (keep screens_anon_select for public player)
drop policy if exists screens_authenticated_select on public.screens;
create policy screens_authenticated_select on public.screens
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists screens_authenticated_insert on public.screens;
create policy screens_authenticated_insert on public.screens
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists screens_authenticated_update on public.screens;
create policy screens_authenticated_update on public.screens
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists screens_authenticated_delete on public.screens;
create policy screens_authenticated_delete on public.screens
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Ads (keep ads_anon_select for public player)
drop policy if exists ads_authenticated_select on public.ads;
create policy ads_authenticated_select on public.ads
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists ads_authenticated_insert on public.ads;
create policy ads_authenticated_insert on public.ads
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists ads_authenticated_update on public.ads;
create policy ads_authenticated_update on public.ads
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists ads_authenticated_delete on public.ads;
create policy ads_authenticated_delete on public.ads
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Stores
drop policy if exists stores_authenticated_all on public.stores;
create policy stores_owner_select on public.stores
  for select to authenticated using (owner_id = (select auth.uid()));
create policy stores_owner_insert on public.stores
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy stores_owner_update on public.stores
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy stores_owner_delete on public.stores
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Companies
drop policy if exists companies_authenticated_all on public.companies;
create policy companies_owner_select on public.companies
  for select to authenticated using (owner_id = (select auth.uid()));
create policy companies_owner_insert on public.companies
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy companies_owner_update on public.companies
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy companies_owner_delete on public.companies
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Company screens
drop policy if exists company_screens_authenticated_all on public.company_screens;
create policy company_screens_owner_select on public.company_screens
  for select to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = company_id and c.owner_id = (select auth.uid())
    )
    and exists (
      select 1 from public.screens s
      where s.id = screen_id and s.owner_id = (select auth.uid())
    )
  );
create policy company_screens_owner_insert on public.company_screens
  for insert to authenticated
  with check (
    exists (
      select 1 from public.companies c
      where c.id = company_id and c.owner_id = (select auth.uid())
    )
    and exists (
      select 1 from public.screens s
      where s.id = screen_id and s.owner_id = (select auth.uid())
    )
  );
create policy company_screens_owner_delete on public.company_screens
  for delete to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = company_id and c.owner_id = (select auth.uid())
    )
    and exists (
      select 1 from public.screens s
      where s.id = screen_id and s.owner_id = (select auth.uid())
    )
  );

-- Layout templates
drop policy if exists layout_templates_authenticated_select on public.layout_templates;
create policy layout_templates_owner_select on public.layout_templates
  for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists layout_templates_authenticated_insert on public.layout_templates;
create policy layout_templates_owner_insert on public.layout_templates
  for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists layout_templates_authenticated_update on public.layout_templates;
create policy layout_templates_owner_update on public.layout_templates
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
drop policy if exists layout_templates_authenticated_delete on public.layout_templates;
create policy layout_templates_owner_delete on public.layout_templates
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Layout regions
drop policy if exists layout_regions_authenticated_select on public.layout_regions;
create policy layout_regions_owner_select on public.layout_regions
  for select to authenticated
  using (
    exists (
      select 1 from public.layout_templates lt
      where lt.id = layout_template_id and lt.owner_id = (select auth.uid())
    )
  );
drop policy if exists layout_regions_authenticated_insert on public.layout_regions;
create policy layout_regions_owner_insert on public.layout_regions
  for insert to authenticated
  with check (
    exists (
      select 1 from public.layout_templates lt
      where lt.id = layout_template_id and lt.owner_id = (select auth.uid())
    )
  );
drop policy if exists layout_regions_authenticated_update on public.layout_regions;
create policy layout_regions_owner_update on public.layout_regions
  for update to authenticated
  using (
    exists (
      select 1 from public.layout_templates lt
      where lt.id = layout_template_id and lt.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.layout_templates lt
      where lt.id = layout_template_id and lt.owner_id = (select auth.uid())
    )
  );
drop policy if exists layout_regions_authenticated_delete on public.layout_regions;
create policy layout_regions_owner_delete on public.layout_regions
  for delete to authenticated
  using (
    exists (
      select 1 from public.layout_templates lt
      where lt.id = layout_template_id and lt.owner_id = (select auth.uid())
    )
  );

-- Layout region items
drop policy if exists layout_region_items_authenticated_select on public.layout_region_items;
create policy layout_region_items_owner_select on public.layout_region_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.layout_regions lr
      join public.layout_templates lt on lt.id = lr.layout_template_id
      where lr.id = layout_region_id and lt.owner_id = (select auth.uid())
    )
  );
drop policy if exists layout_region_items_authenticated_insert on public.layout_region_items;
create policy layout_region_items_owner_insert on public.layout_region_items
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.layout_regions lr
      join public.layout_templates lt on lt.id = lr.layout_template_id
      where lr.id = layout_region_id and lt.owner_id = (select auth.uid())
    )
  );
drop policy if exists layout_region_items_authenticated_update on public.layout_region_items;
create policy layout_region_items_owner_update on public.layout_region_items
  for update to authenticated
  using (
    exists (
      select 1
      from public.layout_regions lr
      join public.layout_templates lt on lt.id = lr.layout_template_id
      where lr.id = layout_region_id and lt.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.layout_regions lr
      join public.layout_templates lt on lt.id = lr.layout_template_id
      where lr.id = layout_region_id and lt.owner_id = (select auth.uid())
    )
  );
drop policy if exists layout_region_items_authenticated_delete on public.layout_region_items;
create policy layout_region_items_owner_delete on public.layout_region_items
  for delete to authenticated
  using (
    exists (
      select 1
      from public.layout_regions lr
      join public.layout_templates lt on lt.id = lr.layout_template_id
      where lr.id = layout_region_id and lt.owner_id = (select auth.uid())
    )
  );

-- TV devices linked to owned screens
drop policy if exists tv_devices_authenticated_select on public.tv_devices;
create policy tv_devices_owner_select on public.tv_devices
  for select to authenticated
  using (
    screen_id is not null
    and exists (
      select 1 from public.screens s
      where s.id = screen_id and s.owner_id = (select auth.uid())
    )
  );
drop policy if exists tv_devices_authenticated_insert on public.tv_devices;
create policy tv_devices_owner_insert on public.tv_devices
  for insert to authenticated
  with check (
    screen_id is not null
    and exists (
      select 1 from public.screens s
      where s.id = screen_id and s.owner_id = (select auth.uid())
    )
  );
drop policy if exists tv_devices_authenticated_update on public.tv_devices;
create policy tv_devices_owner_update on public.tv_devices
  for update to authenticated
  using (
    screen_id is not null
    and exists (
      select 1 from public.screens s
      where s.id = screen_id and s.owner_id = (select auth.uid())
    )
  )
  with check (
    screen_id is not null
    and exists (
      select 1 from public.screens s
      where s.id = screen_id and s.owner_id = (select auth.uid())
    )
  );
drop policy if exists tv_devices_authenticated_delete on public.tv_devices;
create policy tv_devices_owner_delete on public.tv_devices
  for delete to authenticated
  using (
    screen_id is not null
    and exists (
      select 1 from public.screens s
      where s.id = screen_id and s.owner_id = (select auth.uid())
    )
  );

-- TV heartbeats / logs via owned devices
drop policy if exists tv_device_heartbeats_authenticated_select on public.tv_device_heartbeats;
create policy tv_device_heartbeats_owner_select on public.tv_device_heartbeats
  for select to authenticated
  using (
    exists (
      select 1
      from public.tv_devices d
      join public.screens s on s.id = d.screen_id
      where d.id = device_id and s.owner_id = (select auth.uid())
    )
  );
drop policy if exists tv_device_heartbeats_authenticated_insert on public.tv_device_heartbeats;
create policy tv_device_heartbeats_owner_insert on public.tv_device_heartbeats
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.tv_devices d
      join public.screens s on s.id = d.screen_id
      where d.id = device_id and s.owner_id = (select auth.uid())
    )
  );
drop policy if exists tv_device_heartbeats_authenticated_update on public.tv_device_heartbeats;
create policy tv_device_heartbeats_owner_update on public.tv_device_heartbeats
  for update to authenticated
  using (
    exists (
      select 1
      from public.tv_devices d
      join public.screens s on s.id = d.screen_id
      where d.id = device_id and s.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.tv_devices d
      join public.screens s on s.id = d.screen_id
      where d.id = device_id and s.owner_id = (select auth.uid())
    )
  );
drop policy if exists tv_device_heartbeats_authenticated_delete on public.tv_device_heartbeats;
create policy tv_device_heartbeats_owner_delete on public.tv_device_heartbeats
  for delete to authenticated
  using (
    exists (
      select 1
      from public.tv_devices d
      join public.screens s on s.id = d.screen_id
      where d.id = device_id and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists tv_playback_logs_authenticated_select on public.tv_playback_logs;
create policy tv_playback_logs_owner_select on public.tv_playback_logs
  for select to authenticated
  using (
    exists (
      select 1
      from public.tv_devices d
      join public.screens s on s.id = d.screen_id
      where d.id = device_id and s.owner_id = (select auth.uid())
    )
  );
drop policy if exists tv_playback_logs_authenticated_insert on public.tv_playback_logs;
create policy tv_playback_logs_owner_insert on public.tv_playback_logs
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.tv_devices d
      join public.screens s on s.id = d.screen_id
      where d.id = device_id and s.owner_id = (select auth.uid())
    )
  );
drop policy if exists tv_playback_logs_authenticated_update on public.tv_playback_logs;
create policy tv_playback_logs_owner_update on public.tv_playback_logs
  for update to authenticated
  using (
    exists (
      select 1
      from public.tv_devices d
      join public.screens s on s.id = d.screen_id
      where d.id = device_id and s.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.tv_devices d
      join public.screens s on s.id = d.screen_id
      where d.id = device_id and s.owner_id = (select auth.uid())
    )
  );
drop policy if exists tv_playback_logs_authenticated_delete on public.tv_playback_logs;
create policy tv_playback_logs_owner_delete on public.tv_playback_logs
  for delete to authenticated
  using (
    exists (
      select 1
      from public.tv_devices d
      join public.screens s on s.id = d.screen_id
      where d.id = device_id and s.owner_id = (select auth.uid())
    )
  );

commit;
