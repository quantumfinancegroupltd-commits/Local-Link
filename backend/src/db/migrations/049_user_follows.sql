-- Follow graph for social feed

create table if not exists user_follows (
  follower_id uuid not null references users(id) on delete cascade,
  following_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);

create index if not exists user_follows_following_idx on user_follows(following_id, created_at desc);

