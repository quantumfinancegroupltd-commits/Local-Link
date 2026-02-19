-- Package/bundle: one service can list included items (e.g. "3-room clean", "iron", "laundry").
alter table artisan_services add column if not exists bundle_items text[];

comment on column artisan_services.bundle_items is 'Optional list of items included in this package (e.g. "3-room clean", "iron", "laundry") for display as a bundle.';
