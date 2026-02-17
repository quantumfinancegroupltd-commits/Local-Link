-- Recurring jobs: link generated follow-up job to the one that triggered it
alter table jobs
  add column if not exists parent_job_id uuid references jobs(id) on delete set null;

create index if not exists idx_jobs_parent on jobs(parent_job_id) where parent_job_id is not null;
