-- Add pay period (per month/week/hour/etc) for job posts.

alter table job_posts
  add column if not exists pay_period text;

-- Backfill sensible defaults for existing rows.
update job_posts
set pay_period = case
  when employment_type = 'shift' then 'shift'
  else 'month'
end
where pay_period is null;

