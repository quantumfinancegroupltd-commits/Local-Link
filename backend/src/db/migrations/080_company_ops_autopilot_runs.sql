-- Company Ops Autopilot run logs (v0): store each background sweep outcome.

create table if not exists company_ops_autopilot_runs (
  id bigserial primary key,
  company_id uuid not null references companies(id) on delete cascade,

  kind text not null default 'coverage_auto_fill',
  status text not null default 'ok', -- ok | partial | failed

  list_id uuid references employer_worker_lists(id) on delete set null,
  window_days int not null default 14,
  max_shifts int not null default 25,

  processed_shifts int not null default 0,
  invited_workers int not null default 0,
  failed_shifts int not null default 0,

  started_at timestamptz,
  finished_at timestamptz,

  meta jsonb,
  created_at timestamptz not null default now(),

  constraint chk_company_ops_autopilot_runs_days check (window_days >= 1 and window_days <= 90),
  constraint chk_company_ops_autopilot_runs_max_shifts check (max_shifts >= 1 and max_shifts <= 200),
  constraint chk_company_ops_autopilot_runs_counts check (processed_shifts >= 0 and invited_workers >= 0 and failed_shifts >= 0)
);

create index if not exists idx_company_ops_autopilot_runs_company_created on company_ops_autopilot_runs(company_id, created_at desc);
create index if not exists idx_company_ops_autopilot_runs_company_kind_created on company_ops_autopilot_runs(company_id, kind, created_at desc);

