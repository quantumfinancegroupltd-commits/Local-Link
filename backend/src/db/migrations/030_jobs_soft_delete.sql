-- Soft-delete jobs (never hard delete because escrow_transactions references jobs ON DELETE CASCADE)

alter table if exists jobs
add column if not exists deleted_at timestamptz;

alter table if exists jobs
add column if not exists deleted_by uuid references users(id) on delete set null;

create index if not exists idx_jobs_deleted_at on jobs(deleted_at);


