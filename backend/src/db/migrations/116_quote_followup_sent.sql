-- Track that we sent a "review your quotes" nudge to the buyer (one per job).
create table if not exists quote_followup_sent (
  job_id uuid not null primary key references jobs(id) on delete cascade,
  sent_at timestamptz not null default now()
);

create index if not exists idx_quote_followup_sent_sent_at on quote_followup_sent(sent_at);
