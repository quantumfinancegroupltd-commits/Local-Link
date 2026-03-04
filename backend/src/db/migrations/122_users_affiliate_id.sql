-- Index on users.affiliate_id (column added in 122_affiliates.sql).
-- Separate migration so the column is committed before index creation.
create index if not exists idx_users_affiliate on public.users(affiliate_id) where affiliate_id is not null;
