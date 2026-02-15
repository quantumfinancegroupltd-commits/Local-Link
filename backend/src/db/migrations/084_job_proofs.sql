-- Job proof-of-work uploads (before/after photos, notes) for Trust + disputes

create table if not exists job_proofs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  created_by_user_id uuid references users(id) on delete set null,
  kind text not null default 'other', -- before | after | other
  note text,
  media jsonb, -- [{url, kind, mime, size}]
  created_at timestamptz not null default now()
);

create index if not exists idx_job_proofs_job_created on job_proofs(job_id, created_at desc);
create index if not exists idx_job_proofs_created_by on job_proofs(created_by_user_id, created_at desc);

