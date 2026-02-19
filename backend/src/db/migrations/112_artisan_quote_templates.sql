-- Artisan quote templates: reuse message, amount, availability, warranty, etc.
create table if not exists quote_templates (
  id uuid primary key default gen_random_uuid(),
  artisan_id uuid not null references artisans(id) on delete cascade,
  name varchar(120) not null,
  message text,
  quote_amount numeric,
  availability_text varchar(200),
  start_within_days int,
  warranty_days int,
  includes_materials boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_quote_templates_artisan on quote_templates(artisan_id, created_at desc);
