-- Server-side storage for YAO assistant conversations
create table if not exists assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assistant_conversations_user on assistant_conversations(user_id);

create table if not exists assistant_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references assistant_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_messages_convo on assistant_messages(conversation_id, created_at);
