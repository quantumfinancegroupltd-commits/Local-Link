-- Add image_url to artisan services for display on profile.

alter table artisan_services add column if not exists image_url text;
