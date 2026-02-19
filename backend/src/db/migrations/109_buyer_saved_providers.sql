-- Buyer saved/favourite providers ("my trusted providers").
create table if not exists buyer_saved_providers (
  buyer_id uuid not null references users(id) on delete cascade,
  artisan_user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (buyer_id, artisan_user_id),
  constraint buyer_saved_providers_no_self check (buyer_id <> artisan_user_id)
);

create index if not exists idx_buyer_saved_providers_buyer on buyer_saved_providers(buyer_id, created_at desc);
