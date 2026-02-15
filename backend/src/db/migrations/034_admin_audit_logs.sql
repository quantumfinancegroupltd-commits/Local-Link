create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  meta jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_created_at on admin_audit_logs(created_at desc);
create index if not exists idx_admin_audit_logs_admin_user_id on admin_audit_logs(admin_user_id, created_at desc);


