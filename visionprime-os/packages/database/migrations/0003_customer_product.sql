-- Phase 05: customer/product modules + WooCommerce customer/product sync.
-- See /docs/database-conventions.md for naming/UUID/timestamp/soft-delete rules.
-- No order sync, no wallet ledger, no loyalty/rewards this phase — see
-- /docs/phase-05-customer-product-sync.md.

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  primary_email text,
  primary_mobile text,
  wordpress_user_id text,
  woocommerce_customer_id text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_customers_primary_email on customers(primary_email);
create index if not exists idx_customers_primary_mobile on customers(primary_mobile);
create index if not exists idx_customers_wordpress_user_id on customers(wordpress_user_id);
create index if not exists idx_customers_woocommerce_customer_id on customers(woocommerce_customer_id);
create index if not exists idx_customers_deleted_at on customers(deleted_at);

-- Secondary identities (multiple emails/phones/external IDs per customer),
-- used by duplicate detection beyond the primary fields on customers.
create table if not exists customer_identities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  identity_type text not null,
  identity_value text not null,
  created_at timestamptz not null default now(),
  unique (identity_type, identity_value)
);
create index if not exists idx_customer_identities_customer_id on customer_identities(customer_id);

-- Single-row-per-customer extended profile (free-form, grows over future phases).
create table if not exists customer_profiles (
  customer_id uuid primary key references customers(id) on delete cascade,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customer_tags (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  unique (customer_id, tag)
);
create index if not exists idx_customer_tags_customer_id on customer_tags(customer_id);

-- Append-only: no updated_at/deleted_at — see database-conventions.md §6.
create table if not exists customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  author_id uuid references users(id),
  note text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_customer_notes_customer_id on customer_notes(customer_id);

-- Append-only customer activity trail (the "Customer 360" timeline source).
create table if not exists customer_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_customer_events_customer_id on customer_events(customer_id);
create index if not exists idx_customer_events_created_at on customer_events(created_at);

-- Append-only: a record of every merge, preserving full before-state for audit.
create table if not exists customer_merge_logs (
  id uuid primary key default gen_random_uuid(),
  survivor_customer_id uuid not null references customers(id),
  merged_customer_id uuid not null,
  merged_customer_snapshot jsonb not null,
  actor_id uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_customer_merge_logs_survivor on customer_merge_logs(survivor_customer_id);

-- WooCommerce is the source of truth for products — synced, not authored here.
create table if not exists product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  woocommerce_category_id text not null unique,
  parent_woocommerce_category_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  woocommerce_product_id text not null unique,
  sku text,
  name text not null,
  status text not null default 'active',
  price numeric(12, 2),
  category_woocommerce_ids jsonb not null default '[]'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_sku on products(sku);

-- System-defined permissions (see /docs/permissions.md). Not creatable via API.
insert into permissions (key, description) values
  ('customer:view', 'View customers'),
  ('customer:create', 'Create customers'),
  ('customer:update', 'Update customers'),
  ('customer:delete', 'Delete (deactivate) customers'),
  ('customer:merge', 'Merge duplicate customers'),
  ('customer:note:create', 'Add notes to a customer'),
  ('customer:tag:update', 'Add/remove tags on a customer'),
  ('product:view', 'View products and product categories'),
  ('wordpress:sync_customer', 'Trigger a WooCommerce customer sync'),
  ('wordpress:sync_product', 'Trigger a WooCommerce product sync')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.name = 'Super Admin'
and p.key in (
  'customer:view', 'customer:create', 'customer:update', 'customer:delete', 'customer:merge',
  'customer:note:create', 'customer:tag:update', 'product:view',
  'wordpress:sync_customer', 'wordpress:sync_product'
)
on conflict do nothing;
