alter table if exists users
add column if not exists must_change_password boolean not null default false;

create index if not exists idx_users_must_change_password on users(must_change_password);


