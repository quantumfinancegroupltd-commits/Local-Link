-- Web analytics: page views and events for admin dashboard.

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null default 'page_view',
  path text,
  referrer text,
  title text,
  user_id uuid references users(id) on delete set null,
  session_id text,
  user_agent text,
  country text,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_created_at on analytics_events (created_at desc);
create index if not exists idx_analytics_events_event_type on analytics_events (event_type);
create index if not exists idx_analytics_events_path on analytics_events (path);
create index if not exists idx_analytics_events_session_id on analytics_events (session_id);
