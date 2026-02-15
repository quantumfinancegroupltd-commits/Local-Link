-- Corporate messaging: allow job-post based messaging threads (company <-> applicant).

alter table messages
  add column if not exists job_post_id uuid references job_posts(id) on delete cascade;

create index if not exists idx_messages_job_post on messages(job_post_id, created_at asc);

