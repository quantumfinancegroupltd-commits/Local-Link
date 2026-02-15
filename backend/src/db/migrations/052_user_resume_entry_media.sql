-- Allow attaching proof images (certificates, qualifications, education docs) to resume entries.
-- Media is stored as JSON (output from /api/uploads/media).

alter table user_resume_entries
  add column if not exists media jsonb;

