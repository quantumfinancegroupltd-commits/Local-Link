alter table if exists users
add column if not exists suspended_until timestamptz,
add column if not exists suspended_reason text,
add column if not exists suspended_by_admin_id uuid references users(id) on delete set null;

create index if not exists idx_users_suspended_until on users(suspended_until);


