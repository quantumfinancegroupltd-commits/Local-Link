-- Optional lat/lng for job posts so the Jobs board map can show pins
alter table job_posts
  add column if not exists location_lat numeric,
  add column if not exists location_lng numeric;

create index if not exists idx_job_posts_location_lat on job_posts(location_lat) where location_lat is not null;
create index if not exists idx_job_posts_location_lng on job_posts(location_lng) where location_lng is not null;
