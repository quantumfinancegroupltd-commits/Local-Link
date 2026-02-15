create index if not exists idx_messages_job_created on messages(job_id, created_at);
create index if not exists idx_messages_order_created on messages(order_id, created_at);
create index if not exists idx_messages_receiver_read on messages(receiver_id, read);
create index if not exists idx_messages_sender on messages(sender_id);


