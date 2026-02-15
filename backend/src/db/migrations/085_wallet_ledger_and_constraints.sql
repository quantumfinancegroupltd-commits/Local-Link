-- Wallet ledger (audit trail) + safety constraints

create table if not exists wallet_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references wallets(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  direction text not null, -- credit | debit
  amount numeric not null,
  currency varchar(8) not null default 'GHS',
  kind text not null, -- escrow_release | escrow_refund | withdraw_request | admin_adjustment | etc.
  ref_type text,
  ref_id uuid,
  idempotency_key text,
  meta jsonb,
  created_at timestamptz not null default now(),
  constraint chk_wallet_ledger_direction check (direction in ('credit','debit')),
  constraint chk_wallet_ledger_amount_pos check (amount > 0)
);

create index if not exists idx_wallet_ledger_user_created on wallet_ledger_entries(user_id, created_at desc);
create index if not exists idx_wallet_ledger_wallet_created on wallet_ledger_entries(wallet_id, created_at desc);

-- Idempotency: prevent double-credit/debit on retries
create unique index if not exists uniq_wallet_ledger_user_idempotency
  on wallet_ledger_entries(user_id, idempotency_key)
  where idempotency_key is not null and length(idempotency_key) > 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_wallets_balance_nonneg') then
    alter table wallets
      add constraint chk_wallets_balance_nonneg check (balance >= 0);
  end if;
end $$;

