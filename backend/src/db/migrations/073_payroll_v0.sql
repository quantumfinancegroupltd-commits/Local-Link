-- Payroll v0 (beta): employee pay setup + pay runs + CSV export.
-- Note: This is NOT a full UK PAYE implementation. Rates are configurable estimates.

create table if not exists employer_payroll_settings (
  company_id uuid primary key references companies(id) on delete cascade,
  currency text not null default 'GHS',
  tax_rate_pct numeric not null default 0,
  ni_rate_pct numeric not null default 0,
  pension_rate_pct numeric not null default 0,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists employer_employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  worker_user_id uuid references users(id) on delete set null,
  full_name text,
  email text,
  phone text,
  pay_basis text not null default 'salary', -- salary | hourly
  pay_rate numeric not null default 0,      -- salary per pay_period OR hourly rate
  pay_period text not null default 'month', -- week | month | year | shift | day | hour
  tax_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, worker_user_id)
);

create index if not exists employer_employees_company_idx on employer_employees(company_id, active, updated_at desc);

create table if not exists employer_pay_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  pay_date date,
  status text not null default 'draft', -- draft | finalized
  settings_snapshot jsonb,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists employer_pay_runs_company_idx on employer_pay_runs(company_id, created_at desc);

create table if not exists employer_pay_run_items (
  id uuid primary key default gen_random_uuid(),
  pay_run_id uuid not null references employer_pay_runs(id) on delete cascade,
  employee_id uuid not null references employer_employees(id) on delete cascade,
  hours_worked numeric,
  gross_pay numeric not null,
  tax_deduction numeric not null default 0,
  ni_deduction numeric not null default 0,
  pension_deduction numeric not null default 0,
  net_pay numeric not null,
  meta jsonb,
  created_at timestamptz not null default now(),
  unique(pay_run_id, employee_id)
);

create index if not exists employer_pay_run_items_run_idx on employer_pay_run_items(pay_run_id, created_at desc);

