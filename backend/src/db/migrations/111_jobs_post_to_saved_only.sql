-- Private job: post only to buyer's saved (vetted) providers.
alter table jobs add column if not exists post_to_saved_only boolean not null default false;

comment on column jobs.post_to_saved_only is 'When true, only artisans in the buyer_saved_providers list for this buyer can see the job in open listings.';
