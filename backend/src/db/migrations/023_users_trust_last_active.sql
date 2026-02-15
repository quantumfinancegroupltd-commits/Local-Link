-- Trust + activity tracking for fair algorithms

alter table if exists users
add column if not exists last_active_at timestamptz,
add column if not exists trust_score numeric(3,2) default 0;

create index if not exists idx_users_last_active on users(last_active_at desc);


