-- Allow multiple media assets per job (images/videos)
alter table if exists jobs
add column if not exists media jsonb;


