do $$
begin
  if not exists (select 1 from pg_type where typname = 'payout_status') then
    create type payout_status as enum ('pending','processing','paid','failed','cancelled');
  end if;
end $$;

create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  amount numeric not null,
  currency varchar(8) default 'GHS',
  method varchar(32) not null, -- momo / bank
  method_details jsonb,
  status payout_status not null default 'pending',
  provider varchar(32),
  provider_ref varchar(128),
  meta jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_payouts_user on payouts(user_id);
create index if not exists idx_payouts_status on payouts(status);


