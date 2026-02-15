-- Add geo fields for artisan service area so we can compute distance-based matching

alter table if exists artisans
add column if not exists service_place_id text,
add column if not exists service_lat numeric,
add column if not exists service_lng numeric;

create index if not exists idx_artisans_service_lat on artisans(service_lat);
create index if not exists idx_artisans_service_lng on artisans(service_lng);


