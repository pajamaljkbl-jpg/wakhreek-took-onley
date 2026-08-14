-- WAKH REEK — appels audio/vidéo entre membres
-- Exécuter UNE FOIS dans Supabase > SQL Editor.

create table if not exists member_call_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references member_conversations(id) on delete cascade,
  call_type text not null check (call_type in ('audio', 'video')),
  status text not null default 'ringing' check (status in ('ringing', 'connected', 'ended')),
  offer jsonb,
  answer jsonb,
  caller_candidates jsonb not null default '[]'::jsonb,
  callee_candidates jsonb not null default '[]'::jsonb,
  answered_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists member_call_sessions_conversation_idx
  on member_call_sessions(conversation_id, created_at desc);

alter table member_call_sessions enable row level security;

-- Les lectures/écritures passent uniquement par l'API serveur Wakh Reek (service role).
