-- Add replies + likes for social post comments.
-- Enables:
-- - Reply threads via parent_id
-- - Like/unlike on comments via join table

alter table user_post_comments
  add column if not exists parent_id uuid references user_post_comments(id) on delete cascade,
  add column if not exists deleted_at timestamptz null;

create index if not exists idx_post_comments_parent on user_post_comments(parent_id, created_at asc);
create index if not exists idx_post_comments_post_parent on user_post_comments(post_id, parent_id, created_at asc);

create table if not exists user_post_comment_likes (
  comment_id uuid references user_post_comments(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (comment_id, user_id)
);

create index if not exists idx_comment_likes_comment on user_post_comment_likes(comment_id, created_at desc);

