-- Dispatch: store suggested (nearest) driver for a delivery; admin/ops can use for auto-assign later
alter table deliveries
  add column if not exists suggested_driver_user_id uuid references users(id) on delete set null,
  add column if not exists suggested_at timestamptz;

create index if not exists idx_deliveries_suggested on deliveries(suggested_driver_user_id) where suggested_driver_user_id is not null;
