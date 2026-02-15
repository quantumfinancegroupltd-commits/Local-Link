-- Attach reviews to job/order contexts and prevent duplicates

alter table if exists reviews
add column if not exists job_id uuid references jobs(id) on delete cascade,
add column if not exists order_id uuid references orders(id) on delete cascade;

-- One job review per reviewer (buyer) per job
create unique index if not exists uq_reviews_job_reviewer
on reviews(reviewer_id, job_id)
where job_id is not null;

-- One order review per reviewer per target (allows buyer to review farmer + driver separately)
create unique index if not exists uq_reviews_order_reviewer_target
on reviews(reviewer_id, order_id, target_id)
where order_id is not null;

create index if not exists idx_reviews_target on reviews(target_id, created_at desc);


