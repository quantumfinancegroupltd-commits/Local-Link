do $$
begin
  if not exists (select 1 from pg_type where typname = 'ops_alert_severity') then
    create type ops_alert_severity as enum ('info','warning','critical');
  end if;
end $$;

-- Operational alerts: deduped by (type,key) while unresolved.
create table if not exists ops_alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  key text not null,
  severity ops_alert_severity not null default 'warning',
  message text,
  payload jsonb,
  count int not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ops_alerts_unresolved_idx on ops_alerts (severity, last_seen_at desc) where resolved_at is null;
create index if not exists ops_alerts_type_idx on ops_alerts (type, last_seen_at desc);

-- Only one unresolved alert per (type,key).
create unique index if not exists ops_alerts_unresolved_dedupe_idx
  on ops_alerts (type, key)
  where resolved_at is null;

-- Scheduler/task guardrails: persisted per task.
create table if not exists ops_task_state (
  task_name text primary key,
  consecutive_failures int not null default 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  next_run_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

create index if not exists ops_task_state_next_run_idx on ops_task_state (next_run_at asc nulls first);

