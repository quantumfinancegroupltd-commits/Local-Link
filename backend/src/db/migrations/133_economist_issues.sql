-- LocalLink Economist: monthly digital magazine issues (PDF + cover, slider on /news, flipbook reader).

create table if not exists economist_issues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  volume_number int not null,
  issue_date date not null,
  theme text,
  title text not null,
  summary text,
  pdf_url text,
  cover_image_url text,
  page_count int,
  featured_headline_1 text,
  featured_headline_2 text,
  featured_headline_3 text,
  is_published boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_economist_issues_published_date on economist_issues(is_published, issue_date desc);
create index if not exists idx_economist_issues_slug on economist_issues(slug);
