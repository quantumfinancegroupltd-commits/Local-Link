do $$
begin
  if not exists (select 1 from pg_type where typname = 'dispute_status') then
    create type dispute_status as enum ('open','under_review','resolved','rejected');
  end if;
end $$;

create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid unique references escrow_transactions(id) on delete cascade,
  raised_by_user_id uuid references users(id) on delete set null,
  reason varchar(64) not null,
  details text,
  status dispute_status not null default 'open',
  resolution jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_disputes_status on disputes(status);
create index if not exists idx_disputes_raised_by on disputes(raised_by_user_id);


