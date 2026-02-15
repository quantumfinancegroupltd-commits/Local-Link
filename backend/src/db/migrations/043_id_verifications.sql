-- Ghana ID verification system for providers (artisans, farmers, drivers)
-- Separate from subscription verification tiers

do $$
begin
  if not exists (select 1 from pg_type where typname = 'id_verification_status') then
    create type id_verification_status as enum ('pending', 'approved', 'rejected', 'needs_correction');
  end if;
  if not exists (select 1 from pg_type where typname = 'id_type') then
    create type id_type as enum ('ghana_card', 'passport', 'drivers_license');
  end if;
end $$;

create table if not exists id_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  
  -- ID document details
  id_type id_type not null default 'ghana_card',
  id_front_url text not null,
  id_back_url text, -- optional for MVP, required later
  selfie_url text not null,
  
  -- Extracted data (from OCR or manual entry)
  extracted_data jsonb, -- { name, id_number, dob, ... }
  
  -- Review workflow
  status id_verification_status not null default 'pending',
  reviewer_id uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text, -- shown to user if rejected/needs_correction
  
  -- Metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Only one active pending verification per user
create unique index if not exists uq_id_verifications_pending_user
on id_verifications(user_id)
where status = 'pending';

-- Index for admin queue
create index if not exists idx_id_verifications_status 
on id_verifications(status, created_at desc);

-- Index for user lookup
create index if not exists idx_id_verifications_user 
on id_verifications(user_id, created_at desc);

-- Add id_verified flag to users (denormalized for performance)
alter table users 
  add column if not exists id_verified boolean default false;

create index if not exists idx_users_id_verified on users(id_verified) where id_verified = true;

