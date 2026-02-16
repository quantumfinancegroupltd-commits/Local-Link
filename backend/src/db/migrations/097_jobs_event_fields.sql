-- Events & Catering: head count, menu notes, equipment checklist
alter table jobs
add column if not exists event_head_count int,
add column if not exists event_menu_notes text,
add column if not exists event_equipment text;

comment on column jobs.event_head_count is 'Expected head count for event/catering jobs.';
comment on column jobs.event_menu_notes is 'Menu or catering notes (meals, drinks, dietary requirements).';
comment on column jobs.event_equipment is 'Equipment needed (e.g. chairs, tents, tables) — free text or checklist.';
