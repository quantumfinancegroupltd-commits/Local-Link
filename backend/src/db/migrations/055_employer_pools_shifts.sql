-- Employers (companies) workforce tools: worker pools + notes + shift scheduling + attendance ledger.

create table if not exists employer_worker_lists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, name)
);

create index if not exists employer_worker_lists_company_idx on employer_worker_lists(company_id, created_at desc);

create table if not exists employer_worker_list_members (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references employer_worker_lists(id) on delete cascade,
  worker_user_id uuid not null references users(id) on delete cascade,
  added_by_user_id uuid references users(id) on delete set null,
  source text, -- 'manual' | 'job_application' | 'marketplace' | etc
  source_id uuid,
  created_at timestamptz not null default now(),
  unique(list_id, worker_user_id)
);

create index if not exists employer_worker_list_members_list_idx on employer_worker_list_members(list_id, created_at desc);
create index if not exists employer_worker_list_members_worker_idx on employer_worker_list_members(worker_user_id, created_at desc);

create table if not exists employer_worker_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  worker_user_id uuid not null references users(id) on delete cascade,
  rating int, -- 1..5 (optional)
  notes text,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, worker_user_id),
  constraint employer_worker_notes_rating_range check (rating is null or (rating >= 1 and rating <= 5))
);

create index if not exists employer_worker_notes_company_idx on employer_worker_notes(company_id, updated_at desc);

-- Shift scheduling (v1): single shift blocks + assignments (recurrence later).
create table if not exists shift_blocks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null,
  role_tag text, -- e.g. "cleaner", "forklift"
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  headcount int not null default 1,
  status text not null default 'scheduled', -- draft | scheduled | completed | cancelled
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_blocks_headcount_positive check (headcount >= 1),
  constraint shift_blocks_time_order check (end_at > start_at)
);

create index if not exists shift_blocks_company_idx on shift_blocks(company_id, start_at desc);

create table if not exists shift_assignments (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references shift_blocks(id) on delete cascade,
  worker_user_id uuid not null references users(id) on delete cascade,
  status text not null default 'invited', -- invited | accepted | declined | checked_in | checked_out | completed | no_show | cancelled
  invited_at timestamptz,
  responded_at timestamptz,
  check_in_at timestamptz,
  check_out_at timestamptz,
  completed_at timestamptz,
  no_show_confirmed_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shift_id, worker_user_id)
);

create index if not exists shift_assignments_shift_idx on shift_assignments(shift_id, updated_at desc);
create index if not exists shift_assignments_worker_idx on shift_assignments(worker_user_id, updated_at desc);

-- Attendance ledger (v1): event-based.
create table if not exists attendance_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  shift_id uuid not null references shift_blocks(id) on delete cascade,
  worker_user_id uuid not null references users(id) on delete cascade,
  kind text not null,   -- check_in | check_out
  method text not null, -- self | employer_confirm | geo | qr
  lat numeric,
  lng numeric,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists attendance_events_company_idx on attendance_events(company_id, created_at desc);
create index if not exists attendance_events_shift_idx on attendance_events(shift_id, created_at desc);

