-- Florist: bouquet recipe / contents (e.g. stems per product)
alter table products
add column if not exists recipe text;

comment on column products.recipe is 'Bouquet or product contents (e.g. "12 roses, 4 eucalyptus, ribbon"). Optional; useful for flowers.';
