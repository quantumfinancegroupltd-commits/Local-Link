-- Artisan "profession" display name (e.g., Electrician) used across UX.
-- Safe additive migration.

alter table artisans
  add column if not exists primary_skill text;


