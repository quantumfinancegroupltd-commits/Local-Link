-- Job post card image (optional) for landing and jobs board.

alter table job_posts
  add column if not exists image_url text;

comment on column job_posts.image_url is 'Optional image URL for the job listing card (e.g. /api/uploads/xxx or external URL).';
