-- Buyer job templates: reuse past job details (e.g. "house cleaning every week").
create table if not exists job_templates (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references users(id) on delete cascade,
  name text not null,
  title text not null,
  description text,
  location text,
  location_place_id text,
  location_lat numeric,
  location_lng numeric,
  category text,
  budget numeric,
  recurring_frequency text,
  recurring_end_date date,
  access_instructions text,
  event_head_count text,
  event_menu_notes text,
  event_equipment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_job_templates_buyer on job_templates(buyer_id, created_at desc);
