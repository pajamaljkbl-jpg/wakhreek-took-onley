-- WAKH REEK — signalisation des appels audio et vidéo internes.
-- La vidéo et l'audio ne passent pas par la base : seuls les signaux WebRTC
-- sont conservés ici pour connecter deux personnes dans l'application.
create table if not exists call_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  call_type text not null check (call_type in ('audio', 'video')),
  status text not null default 'ringing' check (status in ('ringing', 'connected', 'ended')),
  offer jsonb,
  answer jsonb,
  caller_candidates jsonb not null default '[]'::jsonb,
  callee_candidates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);

create index if not exists call_sessions_conversation_created_idx
  on call_sessions (conversation_id, created_at desc);
