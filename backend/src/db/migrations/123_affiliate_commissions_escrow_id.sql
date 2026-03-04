-- Idempotency for affiliate commission: one commission per escrow release
alter table commissions add column if not exists escrow_id uuid references escrow_transactions(id) on delete set null;
create unique index if not exists idx_commissions_affiliate_escrow on commissions(affiliate_id, escrow_id) where escrow_id is not null;
create index if not exists idx_commissions_escrow on commissions(escrow_id) where escrow_id is not null;
comment on column commissions.escrow_id is 'Escrow release that generated this commission; used for idempotency';
