-- Comment reporting + keyword-based moderation signals

create table if not exists moderation_keyword_filters (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  action text not null default 'block', -- 'block' | 'flag'
  enabled boolean not null default true,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uniq_moderation_keyword_filters_keyword on moderation_keyword_filters(lower(keyword));
create index if not exists idx_moderation_keyword_filters_enabled on moderation_keyword_filters(enabled, action, updated_at desc);

create table if not exists user_post_comment_reports (
  comment_id uuid not null references user_post_comments(id) on delete cascade,
  reporter_user_id uuid not null references users(id) on delete cascade,
  reason text not null,
  details text,
  support_ticket_id uuid references support_tickets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (comment_id, reporter_user_id)
);

create index if not exists idx_comment_reports_comment on user_post_comment_reports(comment_id, updated_at desc);
create index if not exists idx_comment_reports_ticket on user_post_comment_reports(support_ticket_id);

create table if not exists user_post_comment_flags (
  comment_id uuid not null references user_post_comments(id) on delete cascade,
  rule_id uuid not null references moderation_keyword_filters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, rule_id)
);

create index if not exists idx_comment_flags_comment on user_post_comment_flags(comment_id, created_at desc);

