-- Indeed-style job details: term, schedule, benefits.

alter table job_posts
  add column if not exists job_term text;

alter table job_posts
  add column if not exists schedule_text text;

alter table job_posts
  add column if not exists benefits text[];

-- Backfill defaults for existing data.
update job_posts
set job_term = coalesce(job_term, case
  when employment_type = 'internship' then 'internship'
  when employment_type = 'contract' then 'contract'
  else 'permanent'
end);

