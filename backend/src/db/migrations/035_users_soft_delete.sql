alter table if exists users
add column if not exists deleted_at timestamptz;

create index if not exists idx_users_deleted_at on users(deleted_at);


