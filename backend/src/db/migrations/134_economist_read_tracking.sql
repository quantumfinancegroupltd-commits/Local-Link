-- Read analytics for LocalLink Economist (for investors / product).

create table if not exists economist_read_tracking (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references economist_issues(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  pages_viewed int not null default 0,
  time_spent_seconds int not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_economist_read_tracking_issue on economist_read_tracking(issue_id);
create index if not exists idx_economist_read_tracking_created on economist_read_tracking(created_at desc);
