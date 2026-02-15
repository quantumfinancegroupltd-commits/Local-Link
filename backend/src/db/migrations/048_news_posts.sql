-- News posts (public updates + admin publishing)

create table if not exists news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  body text not null,
  status text not null default 'draft', -- draft | published
  published_at timestamptz null,
  created_by uuid null references users(id) on delete set null,
  updated_by uuid null references users(id) on delete set null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce slug uniqueness for non-deleted posts.
create unique index if not exists news_posts_slug_unique on news_posts(slug) where deleted_at is null;
create index if not exists news_posts_status_idx on news_posts(status);
create index if not exists news_posts_published_at_idx on news_posts(published_at);

