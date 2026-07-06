begin;

grant select, insert, update, delete on public.tv_devices to authenticated;

grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.stores to authenticated;
grant select, insert, update, delete on public.companies to authenticated;
grant select, insert, update, delete on public.company_screens to authenticated;

insert into public.categories (name, slug)
values
  ('Beleza e Estética', 'beauty'),
  ('Educação', 'education'),
  ('Serviços', 'services'),
  ('Imobiliário', 'real-estate'),
  ('Automotivo', 'automotive'),
  ('Entretenimento', 'entertainment'),
  ('Tecnologia', 'technology'),
  ('Financeiro', 'finance'),
  ('Construção', 'construction'),
  ('Hotelaria e Turismo', 'hospitality'),
  ('Farmácia', 'pharmacy'),
  ('Moda', 'fashion')
on conflict (slug) do nothing;

notify pgrst, 'reload schema';

commit;
