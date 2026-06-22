-- Phase 09: checkout wallet + reward reservation model. See
-- /docs/phase-09-checkout-wallet-reward-reservations.md.
--
-- Reservations are how the checkout flow holds a customer's intent to
-- spend wallet credit (or, eventually, a reward) on a specific
-- cart/order before the order is actually placed/paid. A reservation
-- NEVER mutates the wallet balance by itself — only `confirm` does
-- that, by writing a normal wallet_ledger_entries debit row (see
-- 0005_wallet_ledger.sql). `release` only ever changes a reservation's
-- own status; it never touches the ledger.

create table if not exists wallet_reservations (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references wallets(id),
  customer_id uuid not null references customers(id),
  -- Identifies the WooCommerce cart/session (and, once placed, the
  -- order) this reservation belongs to. Drives the "no duplicate active
  -- reservation per cart" rule below.
  cart_key text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null,
  status text not null default 'active' check (status in ('active', 'confirmed', 'released', 'expired')),
  woocommerce_order_id text,
  -- Set only once confirm() succeeds — the ledger entry that actually
  -- moved money. Never set by release()/expiry.
  ledger_entry_id uuid references wallet_ledger_entries(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wallet_reservations_customer_id on wallet_reservations(customer_id, created_at);
create index if not exists idx_wallet_reservations_cart_key on wallet_reservations(cart_key);
create index if not exists idx_wallet_reservations_wallet_id on wallet_reservations(wallet_id);
-- Enforces "same cart cannot have duplicate active reservation" at the
-- database level, not just in application code.
create unique index if not exists idx_wallet_reservations_active_cart_key
  on wallet_reservations(cart_key) where status = 'active';

-- Base structure only — no reward catalog/redemption module exists yet.
-- reward_id is a free-form text placeholder until a real rewards module
-- defines its own identifier scheme.
create table if not exists reward_reservations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  cart_key text not null,
  reward_id text,
  status text not null default 'active' check (status in ('active', 'confirmed', 'released', 'expired')),
  woocommerce_order_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_reward_reservations_customer_id on reward_reservations(customer_id, created_at);
create index if not exists idx_reward_reservations_cart_key on reward_reservations(cart_key);
create unique index if not exists idx_reward_reservations_active_cart_key
  on reward_reservations(cart_key) where status = 'active';

-- System-defined permissions (see /docs/permissions.md). Not creatable via API.
insert into permissions (key, description) values
  ('wallet_reservation:view', 'View customer wallet checkout reservations'),
  ('reward_reservation:view', 'View customer reward checkout reservations')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.name = 'Super Admin'
and p.key in ('wallet_reservation:view', 'reward_reservation:view')
on conflict do nothing;
