-- Referral programme: track referrer and unique code per user; credits applied via wallet_ledger kind 'referral_credit'
alter table users
  add column if not exists referrer_user_id uuid references users(id) on delete set null,
  add column if not exists referral_code varchar(32) unique;

create index if not exists idx_users_referrer on users(referrer_user_id) where referrer_user_id is not null;
create index if not exists idx_users_referral_code on users(referral_code) where referral_code is not null;

-- Ensure wallet_ledger has referral_credit kind (no enum change if kind is text)
comment on table users is 'referral_code: unique code for this user to share; referrer_user_id: who referred them';
