alter table if exists farmers
add column if not exists farm_place_id text,
add column if not exists farm_lat numeric,
add column if not exists farm_lng numeric;

create index if not exists idx_farmers_farm_lat on farmers(farm_lat);
create index if not exists idx_farmers_farm_lng on farmers(farm_lng);


