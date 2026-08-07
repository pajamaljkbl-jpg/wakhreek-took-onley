-- ============================================================
-- SCHEMA WAKH REEK — à exécuter dans Supabase (SQL Editor)
-- ============================================================

-- Boutiques (remplace le tableau codé en dur dans le front-end)
create table shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  quartier text,
  category text,
  wave_number text,          -- numéro Wave perso du commerçant
  om_number text,             -- numéro Orange Money perso
  qr_code_url text,           -- image du QR code Wave perso, pour paiement direct par l'acheteur
  description text,
  status text default 'actif',        -- 'actif' | 'pause'
  subscription_active boolean default false,
  subscription_expires_at timestamptz,
  created_at timestamptz default now()
);

-- Produits d'une boutique
create table products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) on delete cascade,
  name text not null,
  price integer default 0,   -- en FCFA, 0 = prix à définir
  created_at timestamptz default now()
);

-- Utilisateurs (acheteurs) — remplace localStorage
create table buyers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  phone text not null,
  created_at timestamptz default now()
);

-- Conversations entre un acheteur et une boutique
create table conversations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references buyers(id) on delete cascade,
  shop_id uuid references shops(id) on delete cascade,
  entry_fee_paid boolean default false,   -- le "10F" d'entrée
  created_at timestamptz default now(),
  unique (buyer_id, shop_id)
);

-- Messages dans une conversation (remplace le chat simulé)
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender text not null,        -- 'buyer' | 'shop'
  content text not null,
  created_at timestamptz default now()
);

-- Paiements (abonnement 6000F ou frais d'entrée 10F) — vérifiés MANUELLEMENT
-- par l'admin via une capture d'écran, pas par webhook automatique.
create table payments (
  id uuid primary key default gen_random_uuid(),
  type text not null,             -- 'subscription' (6000F) | 'entry_fee' (10F)
  amount integer not null,
  proof_image_url text not null,  -- capture d'écran envoyée comme preuve de paiement
  shop_id uuid references shops(id),
  conversation_id uuid references conversations(id),
  status text default 'pending',  -- 'pending' | 'approved' | 'rejected'
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

create index on messages (conversation_id);
create index on products (shop_id);
create index on payments (status);
