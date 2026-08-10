-- WAKH REEK — fondation espace membres.
-- Exécuter UNE FOIS dans Supabase > SQL Editor.
-- Les appels, messages et médias restent hébergés dans Wakh Reek.

alter table profiles add column if not exists terms_accepted_at timestamptz;
alter table profiles add column if not exists terms_version text;
alter table profiles add column if not exists blocked_at timestamptz;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, phone, terms_accepted_at, terms_version)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.raw_user_meta_data ->> 'role' in ('buyer', 'seller') then new.raw_user_meta_data ->> 'role' else 'buyer' end,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    now(),
    '2026-08-09'
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = coalesce(excluded.phone, profiles.phone),
    terms_accepted_at = coalesce(profiles.terms_accepted_at, excluded.terms_accepted_at),
    terms_version = coalesce(profiles.terms_version, excluded.terms_version);
  return new;
end;
$$;

create table if not exists member_contacts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, member_id),
  check (owner_id <> member_id)
);

create table if not exists member_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists member_conversations (
  id uuid primary key default gen_random_uuid(),
  member_one_id uuid not null references auth.users(id) on delete cascade,
  member_two_id uuid not null references auth.users(id) on delete cascade,
  pair_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (member_one_id <> member_two_id)
);

create index if not exists member_conversations_member_one_idx on member_conversations(member_one_id, updated_at desc);
create index if not exists member_conversations_member_two_idx on member_conversations(member_two_id, updated_at desc);

create table if not exists member_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references member_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text,
  message_type text not null default 'text' check (message_type in ('text', 'image', 'audio', 'video')),
  media_url text,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  check (coalesce(length(trim(content)), 0) > 0 or media_url is not null)
);
create index if not exists member_messages_conversation_idx on member_messages(conversation_id, created_at asc);

create table if not exists member_stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  media_url text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  caption text,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);
create index if not exists member_stories_author_expires_idx on member_stories(author_id, expires_at desc);

create table if not exists member_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('member', 'message', 'story', 'shop', 'product')),
  target_id text,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  created_at timestamptz not null default now()
);

-- Les signaux servent à aider un humain à examiner un contenu ou un comportement.
-- Ils ne déclenchent jamais une sanction automatique.
create table if not exists moderation_signals (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid references auth.users(id) on delete set null,
  signal_type text not null,
  severity text not null default 'low' check (severity in ('low', 'medium', 'high')),
  source text not null default 'report' check (source in ('report', 'admin', 'ai_assist')),
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved')),
  created_at timestamptz not null default now()
);

alter table member_contacts enable row level security;
alter table member_blocks enable row level security;
alter table member_conversations enable row level security;
alter table member_messages enable row level security;
alter table member_stories enable row level security;
alter table member_reports enable row level security;
alter table moderation_signals enable row level security;

-- Toutes les écritures passent par les API serveur Wakh Reek (service role).
-- Aucune policy publique n'est créée ici.
