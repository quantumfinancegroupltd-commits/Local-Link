-- Inventory: restock notifications when product comes back in stock (quantity decremented on order in app logic)
do $$
begin
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'product_status' and e.enumlabel = 'out_of_stock') then
    alter type product_status add value 'out_of_stock';
  end if;
end $$;

create table if not exists product_restock_notifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz default now(),
  notified_at timestamptz,
  unique(product_id, user_id)
);

create index if not exists idx_restock_notifications_product on product_restock_notifications(product_id);
create index if not exists idx_restock_notifications_user on product_restock_notifications(user_id);
