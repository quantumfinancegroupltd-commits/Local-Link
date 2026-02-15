-- Facebook-like profile fields + simple social posts (with media)

create table if not exists user_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  bio text,
  links jsonb, -- [{ label, url }]
  cover_photo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists user_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  body text,
  media jsonb, -- [{ url, kind, mime, size }]
  created_at timestamptz default now()
);

create index if not exists idx_user_posts_user on user_posts(user_id, created_at desc);

create table if not exists user_post_likes (
  post_id uuid references user_posts(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

create index if not exists idx_post_likes_post on user_post_likes(post_id, created_at desc);

create table if not exists user_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references user_posts(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  body text not null,
  created_at timestamptz default now()
);

create index if not exists idx_post_comments_post on user_post_comments(post_id, created_at asc);


