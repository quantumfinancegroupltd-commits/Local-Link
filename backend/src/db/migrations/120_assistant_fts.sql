-- Full-text search for artisan_services and job_posts (assistant + search)
alter table artisan_services
  add column if not exists search_vector tsvector;

create index if not exists idx_artisan_services_search on artisan_services using gin(search_vector);

create or replace function artisan_services_search_trigger() returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'C');
  return new;
end;
$$ language plpgsql;

drop trigger if exists artisan_services_search_update on artisan_services;
create trigger artisan_services_search_update
  before insert or update of title, category, description on artisan_services
  for each row execute function artisan_services_search_trigger();

update artisan_services set search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'C')
where search_vector is null;

-- job_posts
alter table job_posts
  add column if not exists search_vector tsvector;

create index if not exists idx_job_posts_search on job_posts using gin(search_vector);

create or replace function job_posts_search_trigger() returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.location, '')), 'C');
  return new;
end;
$$ language plpgsql;

drop trigger if exists job_posts_search_update on job_posts;
create trigger job_posts_search_update
  before insert or update of title, description, location on job_posts
  for each row execute function job_posts_search_trigger();

update job_posts set search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(location, '')), 'C')
where search_vector is null;
