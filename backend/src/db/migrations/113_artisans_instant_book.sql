-- Instant-book: artisan can offer immediate confirmation at a set price when buyer invites them.
alter table artisans add column if not exists instant_book_enabled boolean not null default false;
alter table artisans add column if not exists instant_book_amount numeric;

comment on column artisans.instant_book_enabled is 'When true and job is created with this artisan invited, a quote is auto-created and accepted at instant_book_amount.';
comment on column artisans.instant_book_amount is 'Default quote amount (GHS) for instant-book when buyer invites this artisan.';
