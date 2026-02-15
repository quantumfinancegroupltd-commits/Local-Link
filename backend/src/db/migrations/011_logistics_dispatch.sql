-- Logistics Layer (Phase 1): drivers + deliveries (status-based, no live maps)

do $$
begin
  -- Add driver role to enum
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = 'driver'
  ) then
    alter type user_role add value 'driver';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'driver_status') then
    create type driver_status as enum ('pending','approved','restricted','suspended');
  end if;
  if not exists (select 1 from pg_type where typname = 'delivery_status') then
    create type delivery_status as enum (
      'created',
      'driver_assigned',
      'picked_up',
      'on_the_way',
      'delivered',
      'confirmed',
      'cancelled'
    );
  end if;
end $$;

create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users(id) on delete cascade,
  vehicle_type varchar(32) default 'bike', -- bike/car/van
  area_of_operation text,
  status driver_status not null default 'pending',
  trust_score numeric(3,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique references orders(id) on delete cascade,
  buyer_id uuid references users(id) on delete set null,
  farmer_user_id uuid references users(id) on delete set null,
  driver_user_id uuid references users(id) on delete set null,
  pickup_location text,
  dropoff_location text,
  fee numeric not null default 0,
  status delivery_status not null default 'created',
  meta jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_deliveries_driver on deliveries(driver_user_id);
create index if not exists idx_deliveries_status on deliveries(status);
create index if not exists idx_drivers_status on drivers(status);

-- Store delivery address/fee on order for record-keeping (delivery task is source-of-truth for status)
alter table if exists orders
add column if not exists delivery_address text,
add column if not exists delivery_fee numeric default 0;


