-- Artisan private notes about buyers (one note per artisan–buyer pair).
create table if not exists artisan_client_notes (
  artisan_user_id uuid not null references users(id) on delete cascade,
  buyer_user_id uuid not null references users(id) on delete cascade,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (artisan_user_id, buyer_user_id)
);

create index if not exists idx_artisan_client_notes_artisan on artisan_client_notes(artisan_user_id);

create trigger set_artisan_client_notes_updated_at
  before update on artisan_client_notes
  for each row execute function set_updated_at();
