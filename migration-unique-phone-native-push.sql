-- Wakhreek: un seul compte par numéro + jetons Android natifs.
-- Exécuter UNE FOIS dans Supabase > SQL Editor.

-- Normalise les numéros pour comparer +221771234567 et +221 77 123 45 67.
create or replace function public.normalize_phone(value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g'), '');
$$;

-- IMPORTANT: si des doublons historiques existent, cette requête les affiche.
-- Il faut garder le bon compte et supprimer/corriger les doublons avant de créer l'index.
select public.normalize_phone(phone) as phone_normalise, count(*)
from public.profiles
where public.normalize_phone(phone) is not null
group by public.normalize_phone(phone)
having count(*) > 1;

-- Une fois les doublons historiques nettoyés, cette contrainte bloque définitivement
-- la création de plusieurs profils avec le même numéro, même si l'écriture diffère.
create unique index if not exists profiles_phone_unique_normalized
on public.profiles (public.normalize_phone(phone))
where public.normalize_phone(phone) is not null;

create table if not exists public.native_push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists native_push_tokens_user_idx on public.native_push_tokens(user_id);
alter table public.native_push_tokens enable row level security;
