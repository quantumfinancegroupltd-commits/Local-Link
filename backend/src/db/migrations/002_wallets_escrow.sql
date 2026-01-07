do $$
begin
  if not exists (select 1 from pg_type where typname = 'escrow_status') then
    create type escrow_status as enum ('pending_payment','held','released','refunded','disputed','cancelled','failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'escrow_type') then
    create type escrow_type as enum ('job','order');
  end if;
end $$;

create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users(id) on delete cascade,
  balance numeric default 0,
  currency varchar(8) default 'GHS',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Minimal escrow ledger; real money moves via Paystack/Flutterwave, but this table is our source-of-truth workflow.
create table if not exists escrow_transactions (
  id uuid primary key default gen_random_uuid(),
  type escrow_type not null,
  buyer_id uuid references users(id) on delete set null,
  counterparty_user_id uuid references users(id) on delete set null,
  job_id uuid references jobs(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  amount numeric not null,
  currency varchar(8) default 'GHS',
  platform_fee numeric default 0,
  status escrow_status not null default 'pending_payment',
  provider varchar(32), -- paystack / flutterwave
  provider_ref varchar(128),
  meta jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint escrow_one_fk check (
    (type = 'job' and job_id is not null and order_id is null) or
    (type = 'order' and order_id is not null and job_id is null)
  )
);

create index if not exists idx_escrow_job on escrow_transactions(job_id);
create index if not exists idx_escrow_order on escrow_transactions(order_id);
create index if not exists idx_escrow_buyer on escrow_transactions(buyer_id);


