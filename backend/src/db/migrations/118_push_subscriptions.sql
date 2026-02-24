-- Web Push: store browser push subscriptions per user so we can send push when in-app notifications are created.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique(endpoint)
);

create index if not exists idx_push_subscriptions_user_id on push_subscriptions(user_id);
