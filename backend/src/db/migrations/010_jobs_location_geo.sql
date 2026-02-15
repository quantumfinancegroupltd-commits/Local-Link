alter table if exists jobs
add column if not exists location_place_id text,
add column if not exists location_lat numeric,
add column if not exists location_lng numeric;

create index if not exists idx_jobs_location_lat on jobs(location_lat);
create index if not exists idx_jobs_location_lng on jobs(location_lng);


