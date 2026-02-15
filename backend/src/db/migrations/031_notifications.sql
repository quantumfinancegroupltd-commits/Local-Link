create table if not exists notifications (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  meta jsonb,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created_at on notifications(user_id, created_at desc);
create index if not exists idx_notifications_user_unread on notifications(user_id) where read_at is null;
create index if not exists idx_notifications_user_type_created_at on notifications(user_id, type, created_at desc);
create index if not exists idx_notifications_user_type_dedupe_key_created_at on notifications(user_id, type, dedupe_key, created_at desc)
  where dedupe_key is not null;


