begin;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  city text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  active boolean not null default true,
  notes text not null default '',
  billing_status text not null default 'active',
  monthly_amount_cents integer not null default 0,
  payment_due_day integer not null default 10,
  last_payment_at timestamptz,
  next_payment_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint companies_billing_status_check
    check (billing_status in ('active', 'overdue', 'suspended')),
  constraint companies_payment_due_day_check
    check (payment_due_day between 1 and 28),
  constraint companies_monthly_amount_cents_check
    check (monthly_amount_cents >= 0)
);

create table if not exists public.company_screens (
  company_id uuid not null references public.companies(id) on delete cascade,
  screen_id text not null references public.screens(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (company_id, screen_id)
);

alter table public.screens
  add column if not exists store_id uuid references public.stores(id) on delete set null;

alter table public.ads
  add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists screens_store_id_idx on public.screens (store_id);
create index if not exists ads_company_id_idx on public.ads (company_id);
create index if not exists stores_category_id_idx on public.stores (category_id);
create index if not exists companies_category_id_idx on public.companies (category_id);

insert into public.categories (name, slug)
values
  ('Academia', 'gym'),
  ('Alimentação', 'food'),
  ('Varejo', 'retail'),
  ('Saúde', 'health'),
  ('Geral', 'general')
on conflict (slug) do nothing;

alter table public.categories enable row level security;
alter table public.stores enable row level security;
alter table public.companies enable row level security;
alter table public.company_screens enable row level security;

drop policy if exists categories_authenticated_all on public.categories;
create policy categories_authenticated_all on public.categories
  for all to authenticated using (true) with check (true);

drop policy if exists stores_authenticated_all on public.stores;
create policy stores_authenticated_all on public.stores
  for all to authenticated using (true) with check (true);

drop policy if exists companies_authenticated_all on public.companies;
create policy companies_authenticated_all on public.companies
  for all to authenticated using (true) with check (true);

drop policy if exists company_screens_authenticated_all on public.company_screens;
create policy company_screens_authenticated_all on public.company_screens
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.stores to authenticated;
grant select, insert, update, delete on public.companies to authenticated;
grant select, insert, update, delete on public.company_screens to authenticated;

grant all on public.categories to service_role;
grant all on public.stores to service_role;
grant all on public.companies to service_role;
grant all on public.company_screens to service_role;

commit;
