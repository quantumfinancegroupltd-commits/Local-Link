-- Job alerts: users can subscribe to be notified when new job posts match their criteria.
create table if not exists job_alert_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text,
  q text,
  location text,
  employment_type text,
  work_mode text,
  created_at timestamptz default now()
);

create index if not exists idx_job_alert_subscriptions_user on job_alert_subscriptions(user_id);
comment on table job_alert_subscriptions is 'Saved job search criteria; user is notified when new job_posts match.';
