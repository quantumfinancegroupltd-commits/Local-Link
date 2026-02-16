-- Artisan productized services (like company job posts, shown on profile).
-- Artisans can list fixed-price services that buyers can book directly.

create table if not exists artisan_services (
  id uuid primary key default gen_random_uuid(),
  artisan_user_id uuid not null references users(id) on delete cascade,
  title text not null,
  description text,
  price numeric not null,
  currency text not null default 'GHS',
  duration_minutes int,
  category text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_artisan_services_artisan on artisan_services(artisan_user_id, sort_order);

create trigger set_artisan_services_updated_at
  before update on artisan_services
  for each row execute function set_updated_at();

-- Artisan availability: dates when they're available for bookings.
-- Simple day-level for MVP; buyer picks a date, creates job with scheduled_at.

create table if not exists artisan_availability (
  id uuid primary key default gen_random_uuid(),
  artisan_user_id uuid not null references users(id) on delete cascade,
  date date not null,
  created_at timestamptz default now(),
  unique(artisan_user_id, date)
);

create index if not exists idx_artisan_availability_artisan_date on artisan_availability(artisan_user_id, date);

-- Jobs can be "directed" to a specific artisan (from service booking).
-- When set, only that artisan sees the job in their pipeline.

alter table jobs add column if not exists invited_artisan_id uuid references artisans(id) on delete set null;
create index if not exists idx_jobs_invited_artisan on jobs(invited_artisan_id) where invited_artisan_id is not null;
