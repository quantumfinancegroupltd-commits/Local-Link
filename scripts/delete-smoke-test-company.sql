-- One-off: remove "Smoke Test Ltd" companies and their job posts (and cascaded rows).
-- Run when you are done with smoke test data.
--
-- Preview (optional): psql "$DATABASE_URL" -c "select id, name from companies where name = 'Smoke Test Ltd';"
-- Run this script:   psql "$DATABASE_URL" -f scripts/delete-smoke-test-company.sql

delete from companies
where name = 'Smoke Test Ltd';
