-- Affiliate program: applications, promo codes, referrals, commissions, payouts

-- Affiliate applications (can apply without account; user_id set when they log in and we match by email, or on approval)
create table if not exists affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  tier_level int not null default 1 check (tier_level between 1 and 3),
  commission_rate numeric(5,4) not null default 0.07,
  total_earned numeric(12,2) not null default 0,
  -- Application fields (stored on apply)
  full_name text not null,
  email text not null,
  phone text,
  location_city text,
  instagram_handle text,
  tiktok_handle text,
  youtube_channel text,
  website text,
  whatsapp_group_size text,
  why_affiliate text,
  how_promote text,
  estimated_audience_size text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  rejected_at timestamptz
);

create index if not exists idx_affiliates_user on affiliates(user_id) where user_id is not null;
create index if not exists idx_affiliates_status on affiliates(status);
create index if not exists idx_affiliates_email on affiliates(lower(email));
create unique index if not exists idx_affiliates_email_pending on affiliates(lower(email)) where status = 'pending';

-- Promo codes created by approved affiliates
create table if not exists affiliate_promo_codes (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  code varchar(32) not null,
  description text,
  created_at timestamptz not null default now(),
  unique(code)
);

do $$ begin if exists (select 1 from information_schema.columns where table_schema='public' and table_name='affiliate_promo_codes' and column_name='affiliate_id') then create index if not exists idx_affiliate_promo_codes_affiliate on affiliate_promo_codes(affiliate_id); end if; end $$;
create index if not exists idx_affiliate_promo_codes_code on affiliate_promo_codes(code);

-- users.affiliate_id column and index: see 122_users_affiliate_column.sql and 122_users_affiliate_id.sql

-- Referral clicks (for analytics; optional ip_hash for fraud)
create table if not exists referral_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  referral_code varchar(32) not null,
  ip_address inet,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

do $$ begin if exists (select 1 from information_schema.columns where table_schema='public' and table_name='referral_clicks' and column_name='affiliate_id') then create index if not exists idx_referral_clicks_affiliate_created on referral_clicks(affiliate_id, created_at desc); end if; end $$;

-- Payout requests (created before commissions so commissions can reference payout_id)
create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('momo', 'bank')),
  status text not null default 'requested' check (status in ('requested', 'processing', 'paid')),
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  admin_notes text
);

do $$ begin if exists (select 1 from information_schema.columns where table_schema='public' and table_name='payouts' and column_name='affiliate_id') then create index if not exists idx_payouts_affiliate on payouts(affiliate_id); end if; end $$;
create index if not exists idx_payouts_status on payouts(status);

-- Commission records (per referred user, first 30 days platform fee)
create table if not exists commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  referred_user_id uuid not null references users(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid')),
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  payout_id uuid references payouts(id) on delete set null
);

do $$ begin if exists (select 1 from information_schema.columns where table_schema='public' and table_name='commissions' and column_name='affiliate_id') then create index if not exists idx_commissions_affiliate on commissions(affiliate_id); end if; end $$;
create index if not exists idx_commissions_status on commissions(status);

comment on table affiliates is 'Affiliate program applications; user_id linked when user logs in with same email or on approval';
comment on table affiliate_promo_codes is 'Unique codes per affiliate for referral links (?ref=CODE)';
comment on table referral_clicks is 'Click tracking for affiliate links';
comment on table commissions is 'Earned commission per referred user (first 30 days platform fee share)';
comment on table payouts is 'Affiliate payout requests (min $50, monthly cycle)';
