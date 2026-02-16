-- Optional date when buyer wants delivery (e.g. florist occasion)
alter table orders
add column if not exists requested_delivery_date date;

create index if not exists idx_orders_requested_delivery_date on orders(requested_delivery_date);
