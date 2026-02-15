-- Support ticket event attachments (e.g. evidence photos/videos)
alter table support_ticket_events
  add column if not exists attachments jsonb;


