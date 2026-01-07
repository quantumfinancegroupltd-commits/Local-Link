create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider varchar(32) not null,
  event_id varchar(128) not null,
  payload jsonb not null,
  created_at timestamptz default now(),
  unique (provider, event_id)
);


