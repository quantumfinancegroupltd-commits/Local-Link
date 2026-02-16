-- Internal error log for admin visibility (no external service required)
create table if not exists error_logs (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  stack text,
  code text,
  method text,
  path text,
  req_id text,
  user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_error_logs_created_at on error_logs(created_at desc);
