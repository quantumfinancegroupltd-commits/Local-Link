-- Support editing and soft-deleting post comments without breaking threads.

alter table user_post_comments
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_post_comments_post_created_at on user_post_comments(post_id, created_at asc);

