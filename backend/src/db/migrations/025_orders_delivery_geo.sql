-- Store delivery geo to enable delivery fee quotes + ETA

alter table if exists orders
add column if not exists delivery_place_id text,
add column if not exists delivery_lat numeric,
add column if not exists delivery_lng numeric;

alter table if exists deliveries
add column if not exists dropoff_place_id text,
add column if not exists dropoff_lat numeric,
add column if not exists dropoff_lng numeric;

create index if not exists idx_orders_delivery_lat on orders(delivery_lat);
create index if not exists idx_orders_delivery_lng on orders(delivery_lng);
create index if not exists idx_deliveries_dropoff_lat on deliveries(dropoff_lat);
create index if not exists idx_deliveries_dropoff_lng on deliveries(dropoff_lng);


