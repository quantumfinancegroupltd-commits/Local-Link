-- Company Ops Autopilot (v0): background coverage auto-fill settings.

create table if not exists company_ops_settings (
  company_id uuid primary key references companies(id) on delete cascade,

  coverage_auto_fill_enabled boolean not null default false,
  coverage_auto_fill_list_id uuid references employer_worker_lists(id) on delete set null,
  coverage_auto_fill_days int not null default 14,
  coverage_auto_fill_max_shifts int not null default 25,
  coverage_auto_fill_last_run_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_company_ops_settings_days check (coverage_auto_fill_days >= 1 and coverage_auto_fill_days <= 90),
  constraint chk_company_ops_settings_max_shifts check (coverage_auto_fill_max_shifts >= 1 and coverage_auto_fill_max_shifts <= 200)
);

create index if not exists idx_company_ops_settings_enabled on company_ops_settings(coverage_auto_fill_enabled, coverage_auto_fill_last_run_at);

