alter table if exists quotes
add column if not exists availability_text text,
add column if not exists start_within_days int,
add column if not exists warranty_days int,
add column if not exists includes_materials boolean,
add column if not exists updated_at timestamptz default now();

create index if not exists idx_quotes_job_created_at on quotes(job_id, created_at desc);


