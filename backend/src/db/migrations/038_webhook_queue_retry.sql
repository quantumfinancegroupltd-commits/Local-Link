do $$
begin
  if not exists (select 1 from pg_type where typname = 'webhook_queue_status') then
    create type webhook_queue_status as enum ('pending','processing','retry','processed','ignored','dead');
  end if;
end $$;

create table if not exists webhook_queue (
  id uuid primary key default gen_random_uuid(),
  provider varchar(32) not null,
  event_id varchar(128) not null,
  payload jsonb not null,
  status webhook_queue_status not null default 'pending',
  attempts int not null default 0,
  next_retry_at timestamptz not null default now(),
  last_error text,
  locked_at timestamptz,
  locked_by text,
  processed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (provider, event_id)
);

create index if not exists idx_webhook_queue_due on webhook_queue(status, next_retry_at asc);
create index if not exists idx_webhook_queue_provider on webhook_queue(provider, created_at desc);


