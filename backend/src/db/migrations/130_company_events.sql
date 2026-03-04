-- Company events (Eventbrite-style): companies can create events; they appear on feed Local Events card.
-- Users can RSVP going / interested.

create table if not exists company_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null,
  description text,
  location text,
  location_url text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  image_url text,
  external_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_company_events_company on company_events(company_id);
create index if not exists idx_company_events_starts on company_events(starts_at);

create table if not exists company_event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references company_events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'interested', -- 'going' | 'interested'
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(event_id, user_id)
);

create index if not exists idx_company_event_rsvps_event on company_event_rsvps(event_id);
create index if not exists idx_company_event_rsvps_user on company_event_rsvps(user_id);
