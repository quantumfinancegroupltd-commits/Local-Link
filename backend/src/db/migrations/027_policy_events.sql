-- Anti-gaming / policy events (cancellations, phone leakage attempts, no-shows, etc.)

create table if not exists policy_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  kind varchar(64) not null, -- e.g. 'phone_leak', 'late_cancel', 'no_show'
  context_type varchar(16),  -- 'job' | 'order' | 'delivery'
  context_id uuid,
  meta jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_policy_events_user on policy_events(user_id, created_at desc);
create index if not exists idx_policy_events_kind on policy_events(kind, created_at desc);


