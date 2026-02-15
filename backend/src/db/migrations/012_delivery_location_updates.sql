-- Phase 2: live tracking (produce deliveries) - store driver GPS pings

create table if not exists delivery_location_updates (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid references deliveries(id) on delete cascade,
  driver_user_id uuid references users(id) on delete set null,
  lat numeric not null,
  lng numeric not null,
  accuracy numeric,
  created_at timestamptz default now()
);

create index if not exists idx_delivery_loc_delivery on delivery_location_updates(delivery_id, created_at desc);
create index if not exists idx_delivery_loc_driver on delivery_location_updates(driver_user_id, created_at desc);


