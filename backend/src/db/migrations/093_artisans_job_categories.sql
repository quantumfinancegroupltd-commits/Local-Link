-- Artisans can indicate which job categories they serve (Events & Catering, Domestic Services, etc.)
alter table if exists artisans
  add column if not exists job_categories text[];

comment on column artisans.job_categories is 'Job categories this artisan serves (e.g. Events & Catering, Domestic Services, Plumbing).';
