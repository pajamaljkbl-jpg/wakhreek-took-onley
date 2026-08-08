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
  latitude double precision,
  longitude double precision,
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
  description text,
  image_url text,
  category text,
  price integer default 0,   -- en FCFA, 0 = prix à définir
  stock integer default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- Utilisateurs (acheteurs) — doit exister avant la table orders
create table buyers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  phone text not null,
  created_at timestamptz default now()
);

-- Commandes passées par les clients
create table orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references buyers(id),
  shop_id uuid references shops(id),
  customer_name text not null,
  customer_phone text not null,
  delivery_address text not null,
  total integer not null default 0,
  status text not null default 'pending',
  created_at timestamptz default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  product_name text not null,
  unit_price integer not null,
  quantity integer not null check (quantity > 0)
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
create index on orders (shop_id, status);
create index on order_items (order_id);
alter table orders add constraint orders_status_check check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'));

-- Sécurité et cohérence des données
alter table messages add constraint messages_sender_check check (sender in ('buyer', 'shop'));
alter table payments add constraint payments_type_check check (type in ('subscription', 'entry_fee'));
alter table payments add constraint payments_status_check check (status in ('pending', 'approved', 'rejected'));
