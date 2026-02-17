-- Full-text search: tsvector columns and triggers for products, users (provider search), and job categories
alter table products
  add column if not exists search_vector tsvector;

alter table users
  add column if not exists search_vector tsvector;

create index if not exists idx_products_search on products using gin(search_vector);
create index if not exists idx_users_search on users using gin(search_vector);

-- Products: name, category
create or replace function products_search_trigger() returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.category, '')), 'B');
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_search_update on products;
create trigger products_search_update
  before insert or update of name, category on products
  for each row execute function products_search_trigger();

update products set search_vector =
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(category, '')), 'B')
where search_vector is null;

-- Users: name (for provider discovery)
create or replace function users_search_trigger() returns trigger as $$
begin
  new.search_vector := setweight(to_tsvector('english', coalesce(new.name, '')), 'A');
  return new;
end;
$$ language plpgsql;

drop trigger if exists users_search_update on users;
create trigger users_search_update
  before insert or update of name on users
  for each row execute function users_search_trigger();

update users set search_vector = setweight(to_tsvector('english', coalesce(name, '')), 'A') where search_vector is null;
