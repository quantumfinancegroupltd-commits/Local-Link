-- Feed post types: link posts to produce, jobs, or services for marketplace CTAs (Buy, Hire, Apply)
alter table user_posts
  add column if not exists type text not null default 'update',
  add column if not exists related_type text,
  add column if not exists related_id uuid,
  add column if not exists sponsored boolean not null default false;

comment on column user_posts.type is 'update | produce | job | service';
comment on column user_posts.related_type is 'product | job | artisan_service — table name for related_id';
comment on column user_posts.related_id is 'uuid of row in products, jobs, or artisan_services';
comment on column user_posts.sponsored is 'true for boosted/sponsored posts';

create index if not exists idx_user_posts_type on user_posts(type) where type <> 'update';
create index if not exists idx_user_posts_related on user_posts(related_type, related_id) where related_id is not null;
