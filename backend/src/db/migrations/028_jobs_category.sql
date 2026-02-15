-- Add job category metadata (for vertical unlocks without new systems)

alter table if exists jobs
add column if not exists category text;

create index if not exists idx_jobs_category on jobs(category);


