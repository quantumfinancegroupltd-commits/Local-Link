-- Track key lifecycle timestamps (used for auto-release rules)

alter table if exists jobs
add column if not exists started_at timestamptz,
add column if not exists provider_completed_at timestamptz,
add column if not exists buyer_confirmed_at timestamptz;

alter table if exists deliveries
add column if not exists picked_up_at timestamptz,
add column if not exists on_the_way_at timestamptz,
add column if not exists delivered_at timestamptz,
add column if not exists confirmed_at timestamptz;


