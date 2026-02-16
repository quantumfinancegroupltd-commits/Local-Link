-- Unlock Events & Catering and Domestic & Recurring on the front page
update feature_flags
set enabled = true, updated_at = now()
where key in ('vertical_events', 'vertical_domestic');
