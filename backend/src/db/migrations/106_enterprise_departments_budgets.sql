-- Enterprise Phase 1: departments (sites) + budget limits for workforce spend tracking.

create table if not exists company_departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  slug text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, slug)
);

create index if not exists idx_company_departments_company on company_departments(company_id);

create table if not exists company_budgets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references company_departments(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  budget_limit_ghs numeric not null default 0,
  spent_ghs numeric not null default 0,
  notes text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_company_budgets_period check (period_end >= period_start),
  constraint chk_company_budgets_limit check (budget_limit_ghs >= 0),
  constraint chk_company_budgets_spent check (spent_ghs >= 0)
);

create index if not exists idx_company_budgets_company on company_budgets(company_id, period_end desc);
create index if not exists idx_company_budgets_department on company_budgets(department_id, period_end desc);

-- Optional: link shift_blocks to department for per-site spend (future use)
alter table shift_blocks add column if not exists department_id uuid references company_departments(id) on delete set null;
create index if not exists idx_shift_blocks_department on shift_blocks(department_id) where department_id is not null;
