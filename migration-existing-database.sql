-- À exécuter UNE FOIS dans Supabase SQL Editor si schema.sql avait déjà été exécuté.
alter table shops add column if not exists latitude double precision;
alter table shops add column if not exists longitude double precision;
alter table products add column if not exists description text;
alter table products add column if not exists image_url text;
alter table products add column if not exists category text;
alter table products add column if not exists stock integer default 0;
alter table products add column if not exists active boolean default true;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(), buyer_id uuid references buyers(id),
  shop_id uuid references shops(id), customer_name text not null,
  customer_phone text not null, delivery_address text not null,
  total integer not null default 0, status text not null default 'pending',
  created_at timestamptz default now()
);
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id), product_name text not null,
  unit_price integer not null, quantity integer not null check (quantity > 0)
);
create index if not exists orders_shop_status_idx on orders (shop_id, status);
create index if not exists order_items_order_idx on order_items (order_id);

do $$ begin
  alter table messages add constraint messages_sender_check check (sender in ('buyer', 'shop'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table payments add constraint payments_type_check check (type in ('subscription', 'entry_fee'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table payments add constraint payments_status_check check (status in ('pending', 'approved', 'rejected'));
exception when duplicate_object then null; end $$;
