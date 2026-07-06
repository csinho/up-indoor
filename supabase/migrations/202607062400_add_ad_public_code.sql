begin;

alter table public.ads
  add column if not exists public_code text;

create unique index if not exists ads_public_code_unique_idx
  on public.ads (public_code)
  where public_code is not null;

do $$
declare
  ad_row record;
  candidate text;
  attempts integer;
begin
  for ad_row in select id from public.ads where public_code is null loop
    attempts := 0;
    loop
      candidate := upper(substr(md5(random()::text || ad_row.id::text || clock_timestamp()::text), 1, 6));
      candidate := translate(candidate, '01iloO', '234567');
      exit when candidate !~ '[01iloO]' and length(candidate) = 6;
      attempts := attempts + 1;
      if attempts > 20 then
        candidate := upper(substr(replace(ad_row.id::text, '-', ''), 1, 6));
        exit;
      end if;
    end loop;

    update public.ads
    set public_code = candidate
    where id = ad_row.id;
  end loop;
end $$;

alter table public.ads
  alter column public_code set not null;

commit;
