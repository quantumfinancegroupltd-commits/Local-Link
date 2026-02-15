-- Allow multiple media assets per product listing (images/videos)
alter table if exists products
add column if not exists media jsonb;


