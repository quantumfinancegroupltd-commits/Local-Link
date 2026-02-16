-- Access instructions per job (e.g. key code, gate, entry for cleaners)
alter table jobs
add column if not exists access_instructions text;

comment on column jobs.access_instructions is 'How to access the site: key code, gate, door entry, etc. (e.g. for domestic/cleaning jobs).';
