-- Phase 06: WooCommerce order sync, order webhooks, order list/detail, and
-- customer purchase metrics. See /docs/database-conventions.md for
-- naming/UUID/timestamp/soft-delete rules and /docs/phase-06-order-sync.md.
-- No wallet ledger, no cashback, no points/rewards, no checkout integration
-- this phase.

-- Customer purchase metrics, maintained by order sync/webhooks only.
alter table customers add column if not exists purchase_count integer not null default 0;
alter table customers add column if not exists total_spent numeric(14, 2) not null default 0;
alter table customers add column if not exists average_order_value numeric(14, 2) not null default 0;
alter table customers add column if not exists last_purchase_at timestamptz;
alter table customers add column if not exists lifetime_value numeric(14, 2) not null default 0;

-- Dedup key for incoming webhook deliveries (WooCommerce sends a
-- per-delivery ID header). Nullable + partial unique index so existing
-- Phase 04 rows (registration attempts, no delivery id) are unaffected.
alter table wordpress_webhook_events add column if not exists delivery_id text;
create unique index if not exists idx_wordpress_webhook_events_delivery_id
  on wordpress_webhook_events(delivery_id) where delivery_id is not null;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  woocommerce_order_id text not null unique,
  status text not null,
  currency text,
  total numeric(14, 2) not null default 0,
  raw jsonb not null default '{}'::jsonb,
  ordered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_orders_customer_id on orders(customer_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_ordered_at on orders(ordered_at);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  woocommerce_product_id text,
  name text not null,
  quantity integer not null default 1,
  price numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_order_items_order_id on order_items(order_id);

-- Append-only: no updated_at/deleted_at — see database-conventions.md §6.
create table if not exists order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_order_events_order_id on order_events(order_id);
create index if not exists idx_order_events_created_at on order_events(created_at);

-- System-defined permissions (see /docs/permissions.md). Not creatable via API.
insert into permissions (key, description) values
  ('order:view', 'View orders, order detail, and order events'),
  ('order:sync', 'Trigger a WooCommerce order sync'),
  ('wordpress:webhook:view', 'View WordPress/WooCommerce webhook events')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.name = 'Super Admin'
and p.key in ('order:view', 'order:sync', 'wordpress:webhook:view')
on conflict do nothing;
