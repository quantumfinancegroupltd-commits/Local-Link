do $$
begin
  if not exists (select 1 from pg_type where typname = 'verification_request_status') then
    create type verification_request_status as enum ('pending','approved','rejected');
  end if;
end $$;

create table if not exists verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  requested_level verification_tier not null,
  status verification_request_status not null default 'pending',
  evidence jsonb,
  note text,
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Only one active pending request per user
create unique index if not exists uq_verification_requests_pending_user
on verification_requests(user_id)
where status = 'pending';

create index if not exists idx_verification_requests_status on verification_requests(status, created_at desc);


