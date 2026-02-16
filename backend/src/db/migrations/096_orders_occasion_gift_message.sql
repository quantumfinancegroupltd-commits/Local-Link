-- Florist/gift: occasion and card message (e.g. Valentine's, sympathy, message on card)
alter table orders
add column if not exists occasion varchar(80),
add column if not exists gift_message text;

comment on column orders.occasion is 'Occasion for the order (e.g. Valentine''s, Birthday, Sympathy).';
comment on column orders.gift_message is 'Gift card or delivery message from the buyer.';
