alter table if exists drivers
add column if not exists is_online boolean not null default false,
add column if not exists last_lat numeric,
add column if not exists last_lng numeric,
add column if not exists last_accuracy numeric,
add column if not exists last_location_at timestamptz;

create index if not exists idx_drivers_is_online on drivers(is_online);
create index if not exists idx_drivers_last_location_at on drivers(last_location_at desc);


