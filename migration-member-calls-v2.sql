-- WAKH REEK — correction réception des appels
-- Exécuter UNE FOIS dans Supabase > SQL Editor.

alter table public.member_call_sessions
add column if not exists caller_id uuid references auth.users(id) on delete cascade;

create index if not exists member_call_sessions_caller_status_idx
on public.member_call_sessions(caller_id, status, created_at desc);
