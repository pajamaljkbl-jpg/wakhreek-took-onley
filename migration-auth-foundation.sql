-- WAKH REEK — fondation comptes client / vendeur.
-- Exécuter une seule fois dans Supabase > SQL Editor.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  phone text,
  created_at timestamptz not null default now()
);

alter table shops add column if not exists owner_id uuid references auth.users(id) on delete set null;
create index if not exists shops_owner_id_idx on shops(owner_id);

alter table profiles enable row level security;

create policy "profiles: read own profile" on profiles for select using (auth.uid() = id);
create policy "profiles: update own profile" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.raw_user_meta_data ->> 'role' in ('buyer', 'seller') then new.raw_user_meta_data ->> 'role' else 'buyer' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
