-- Recurring shift scheduling (v1): templates + weekly series + exceptions.

create table if not exists company_shift_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  title text not null,
  role_tag text,
  location text,
  headcount int not null default 1,
  checkin_geo_required boolean not null default false,
  checkin_geo_radius_m int,
  checkin_geo_lat numeric,
  checkin_geo_lng numeric,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_shift_templates_headcount_positive check (headcount >= 1)
);

create unique index if not exists uq_company_shift_templates_name
  on company_shift_templates(company_id, lower(name));

create index if not exists idx_company_shift_templates_company
  on company_shift_templates(company_id, created_at desc);

create table if not exists company_shift_series (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  template_id uuid not null references company_shift_templates(id) on delete restrict,
  status text not null default 'active', -- active | paused | ended
  frequency text not null default 'weekly', -- weekly (v1)
  interval_weeks int not null default 1,
  days_of_week int[] not null, -- 0=Sun..6=Sat
  start_date date not null,
  end_date date,
  start_time time not null,
  end_time time not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_shift_series_status_chk check (status in ('active','paused','ended')),
  constraint company_shift_series_frequency_chk check (frequency in ('weekly')),
  constraint company_shift_series_interval_chk check (interval_weeks >= 1 and interval_weeks <= 52),
  constraint company_shift_series_days_nonempty_chk check (array_length(days_of_week, 1) is not null and array_length(days_of_week, 1) >= 1),
  constraint company_shift_series_time_order_chk check (end_time > start_time),
  constraint company_shift_series_date_order_chk check (end_date is null or end_date >= start_date)
);

create index if not exists idx_company_shift_series_company
  on company_shift_series(company_id, created_at desc);

create index if not exists idx_company_shift_series_template
  on company_shift_series(template_id, created_at desc);

create table if not exists company_shift_series_exceptions (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references company_shift_series(id) on delete cascade,
  kind text not null default 'skip', -- skip (v1)
  on_date date not null,
  note text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint company_shift_series_exceptions_kind_chk check (kind in ('skip'))
);

create unique index if not exists uq_company_shift_series_exceptions
  on company_shift_series_exceptions(series_id, kind, on_date);

create index if not exists idx_company_shift_series_exceptions_series
  on company_shift_series_exceptions(series_id, created_at desc);

alter table shift_blocks
  add column if not exists series_id uuid references company_shift_series(id) on delete set null,
  add column if not exists series_occurrence_date date;

create unique index if not exists uq_shift_blocks_series_occurrence
  on shift_blocks(series_id, series_occurrence_date)
  where series_id is not null and series_occurrence_date is not null;

