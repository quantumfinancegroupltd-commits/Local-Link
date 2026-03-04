-- Add affiliate payout support to the existing payouts table (008 created it with user_id;
-- 122_affiliates.sql used "create table if not exists payouts" so affiliate_id was never added).
-- Affiliate payouts use status 'pending' for requested (same enum as user payouts).

-- Add affiliate-related columns if missing.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payouts' and column_name = 'affiliate_id') then
    alter table public.payouts add column affiliate_id uuid references affiliates(id) on delete cascade;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payouts' and column_name = 'requested_at') then
    alter table public.payouts add column requested_at timestamptz default now();
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payouts' and column_name = 'paid_at') then
    alter table public.payouts add column paid_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payouts' and column_name = 'admin_notes') then
    alter table public.payouts add column admin_notes text;
  end if;
end $$;

create index if not exists idx_payouts_affiliate on payouts(affiliate_id) where affiliate_id is not null;
