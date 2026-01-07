-- LocalLink core schema (MVP) + extensions
create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('buyer','artisan','farmer','admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type job_status as enum ('open','assigned','in_progress','completed','cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'quote_status') then
    create type quote_status as enum ('pending','accepted','rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'product_status') then
    create type product_status as enum ('available','sold','pending','cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('pending','paid','failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum ('pending','confirmed','dispatched','delivered','cancelled');
  end if;
end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  email varchar(255) unique not null,
  phone varchar(20),
  password_hash varchar(255) not null,
  role user_role not null,
  verified boolean default false,
  rating numeric(2,1) default 0,
  profile_pic varchar(255),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists artisans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users(id) on delete cascade,
  skills text[],
  portfolio jsonb,
  experience_years int,
  service_area text,
  verified_docs jsonb,
  premium boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists farmers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users(id) on delete cascade,
  farm_location text,
  farm_type text[],
  verified_docs jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references users(id) on delete set null,
  title varchar(255),
  description text,
  location text,
  budget numeric,
  status job_status default 'open',
  assigned_artisan_id uuid references artisans(id) on delete set null,
  accepted_quote numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  artisan_id uuid references artisans(id) on delete cascade,
  quote_amount numeric,
  message text,
  status quote_status default 'pending',
  created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid references farmers(id) on delete set null,
  name varchar(255),
  category varchar(100),
  quantity int,
  unit varchar(50),
  price numeric,
  auction_start_price numeric,
  status product_status default 'available',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  buyer_id uuid references users(id) on delete set null,
  farmer_id uuid references farmers(id) on delete set null,
  quantity int,
  total_price numeric,
  payment_status payment_status default 'pending',
  order_status order_status default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid references users(id) on delete set null,
  target_id uuid references users(id) on delete set null,
  rating numeric(2,1),
  comment text,
  created_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references users(id) on delete set null,
  receiver_id uuid references users(id) on delete set null,
  job_id uuid references jobs(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  message text,
  read boolean default false,
  created_at timestamptz default now()
);

create table if not exists admin (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users(id) on delete cascade,
  role varchar(20) check (role in ('super','moderator')),
  created_at timestamptz default now()
);


