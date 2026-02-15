-- Corporate mode: company profiles + job board + applications.

do $$
begin
  -- Add company role to enum (idempotent)
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = 'company'
  ) then
    alter type user_role add value 'company';
  end if;
end $$;

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid unique references users(id) on delete cascade,
  slug text unique,
  name text not null,
  industry text,
  size_range text, -- e.g. "1-10", "11-50", "51-200", "200+"
  website text,
  location text,
  description text,
  logo_url text,
  cover_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_companies_owner on companies(owner_user_id);

create table if not exists job_posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  title text not null,
  description text not null,
  location text,
  employment_type text, -- full_time | part_time | contract | shift | internship
  work_mode text, -- onsite | remote | hybrid
  pay_min numeric,
  pay_max numeric,
  currency text default 'GHS',
  tags text[],
  status text not null default 'open', -- open | closed | draft
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  closes_at timestamptz
);

create index if not exists idx_job_posts_status on job_posts(status, created_at desc);
create index if not exists idx_job_posts_company on job_posts(company_id, created_at desc);

create table if not exists job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references job_posts(id) on delete cascade,
  applicant_user_id uuid references users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  cover_letter text,
  resume_snapshot jsonb, -- optional snapshot of profile/resume at time of apply
  status text not null default 'submitted', -- submitted | shortlisted | contacted | rejected | hired | withdrawn
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists uq_job_applications_job_applicant on job_applications(job_id, applicant_user_id);
create index if not exists idx_job_applications_job on job_applications(job_id, created_at desc);
create index if not exists idx_job_applications_applicant on job_applications(applicant_user_id, created_at desc);

