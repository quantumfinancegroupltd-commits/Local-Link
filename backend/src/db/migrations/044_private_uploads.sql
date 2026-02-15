-- Private uploads (e.g., Ghana Card images, selfies) that must not be publicly accessible.
-- Stored using the existing upload dir, but only retrievable via authenticated API endpoints.

create table if not exists private_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  purpose text not null, -- e.g. 'id_verification'
  storage text not null default 'local',
  storage_key text not null, -- local filename or object storage key
  mime text not null,
  kind text not null default 'image', -- image | video | other (MVP: image only)
  size_bytes bigint,
  original_name text,
  created_at timestamptz default now()
);

create index if not exists idx_private_uploads_user on private_uploads(user_id, created_at desc);
create index if not exists idx_private_uploads_purpose on private_uploads(purpose, created_at desc);

