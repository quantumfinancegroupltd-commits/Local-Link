-- Product reviews: buyers can leave a rating and comment per product (e.g. after order delivered).
-- One review per (user, product); optional order_id to mark as "verified purchase".

create table if not exists product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  reviewer_id uuid not null references users(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  rating numeric(2,1) not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz default now(),
  unique(product_id, reviewer_id)
);

create index if not exists idx_product_reviews_product on product_reviews(product_id, created_at desc);
create index if not exists idx_product_reviews_reviewer on product_reviews(reviewer_id);

comment on table product_reviews is 'Buyer reviews for marketplace products; order_id set when review is from a completed order.';
