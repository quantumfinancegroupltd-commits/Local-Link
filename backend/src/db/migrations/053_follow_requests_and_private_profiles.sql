-- Follow requests + private profiles.
-- Enables "private profile" mode where follow requires approval.

alter table user_profiles
  add column if not exists private_profile boolean not null default false;

alter table user_follows
  add column if not exists status text not null default 'accepted',
  add column if not exists requested_at timestamptz,
  add column if not exists accepted_at timestamptz;

-- Backfill timestamps for existing rows (safe to re-run).
update user_follows
set requested_at = coalesce(requested_at, created_at),
    accepted_at = coalesce(accepted_at, case when status = 'accepted' then created_at else null end);

create index if not exists user_follows_status_following_idx on user_follows(following_id, status, created_at desc);
create index if not exists user_follows_status_follower_idx on user_follows(follower_id, status, created_at desc);

