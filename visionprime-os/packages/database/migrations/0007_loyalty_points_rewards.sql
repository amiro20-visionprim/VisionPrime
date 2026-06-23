-- Phase 10: loyalty programs/tiers, points ledger, and reward catalog/
-- claim/redemption. See /docs/phase-10-loyalty-points-rewards.md.
--
-- Points, like the wallet, are NEVER a directly-mutable balance column —
-- balance is always derived from points_ledger_entries (append-only,
-- same conventions as wallet_ledger_entries in 0005_wallet_ledger.sql).
-- coins_ledger_entries is a second, independent ledger currency reserved
-- for a future phase; it ships as base structure only (no rule writes to
-- it yet), mirroring how wallet_rules shipped inactive-by-default in 0005.

create table if not exists loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default false,
  points_per_currency_unit numeric not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists loyalty_tiers (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references loyalty_programs(id),
  name text not null,
  -- Lifetime points required to reach (and remain in, for downgrade
  -- evaluation) this tier. Tiers are ordered by this threshold.
  min_lifetime_points bigint not null check (min_lifetime_points >= 0),
  sort_order int not null default 0,
  benefits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_loyalty_tiers_program_id on loyalty_tiers(program_id, min_lifetime_points);

-- Base structure for configurable earn rules beyond the program's flat
-- points_per_currency_unit (e.g. category bonuses). No rule types are
-- evaluated yet — the active rate always comes from loyalty_programs.
create table if not exists loyalty_rules (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references loyalty_programs(id),
  name text not null,
  rule_type text not null,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_loyalty_rules_program_id on loyalty_rules(program_id);

-- One row per customer: their current tier + the lifetime points total
-- that placed them there. Tier *changes* are logged via the audit log
-- (action loyalty.tier_change), not a separate history table.
create table if not exists customer_loyalty_status (
  customer_id uuid primary key references customers(id),
  program_id uuid references loyalty_programs(id),
  current_tier_id uuid references loyalty_tiers(id),
  lifetime_points bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-only, identical conventions to wallet_ledger_entries: no
-- balance column anywhere; balance = sum(credit) - sum(debit). Corrected
-- only by inserting a reversal row referencing reversed_entry_id.
create table if not exists points_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  type text not null,
  direction text not null check (direction in ('credit', 'debit')),
  points bigint not null check (points > 0),
  reason text not null,
  reference_type text,
  reference_id text,
  idempotency_key text,
  reversed_entry_id uuid references points_ledger_entries(id),
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_points_ledger_customer_id on points_ledger_entries(customer_id, created_at);
create index if not exists idx_points_ledger_reference on points_ledger_entries(reference_type, reference_id);
create index if not exists idx_points_ledger_reversed_entry_id on points_ledger_entries(reversed_entry_id);
-- Enforces "points from the same order must not duplicate" at the
-- database level, not just in application code.
create unique index if not exists idx_points_ledger_idempotency_key
  on points_ledger_entries(idempotency_key) where idempotency_key is not null;

-- Base structure only, same shape as points_ledger_entries — no coins
-- are issued by any rule yet.
create table if not exists coins_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  type text not null,
  direction text not null check (direction in ('credit', 'debit')),
  coins bigint not null check (coins > 0),
  reason text not null,
  reference_type text,
  reference_id text,
  idempotency_key text,
  reversed_entry_id uuid references coins_ledger_entries(id),
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_coins_ledger_customer_id on coins_ledger_entries(customer_id, created_at);
create unique index if not exists idx_coins_ledger_idempotency_key
  on coins_ledger_entries(idempotency_key) where idempotency_key is not null;

create table if not exists rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  reward_type text not null check (reward_type in ('coupon', 'free_item', 'other')),
  points_cost bigint not null default 0 check (points_cost >= 0),
  -- For reward_type = 'coupon': how the resulting WooCommerce coupon is
  -- generated (e.g. {"discountType": "percent", "amount": "10"}).
  coupon_config jsonb not null default '{}'::jsonb,
  -- How long a claimed-but-not-yet-redeemed reward stays valid for.
  claim_validity_days int not null default 30 check (claim_validity_days > 0),
  is_active boolean not null default true,
  -- Total claims allowed across all customers; null = unlimited.
  max_claims int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Base structure for configurable earn/eligibility rules per reward
-- (e.g. minimum tier required). No rule types are evaluated yet.
create table if not exists reward_rules (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references rewards(id),
  rule_type text not null,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_reward_rules_reward_id on reward_rules(reward_id);

-- A claim is the customer taking ownership of one unit of a reward
-- (points already deducted, if any). It must be redeemed before
-- expires_at; redeeming flips status to 'redeemed' and writes a
-- reward_redemptions row — a claim is never redeemed twice.
create table if not exists reward_claims (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references rewards(id),
  customer_id uuid not null references customers(id),
  status text not null default 'claimed' check (status in ('claimed', 'redeemed', 'expired', 'cancelled')),
  points_ledger_entry_id uuid references points_ledger_entries(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_reward_claims_customer_id on reward_claims(customer_id, created_at);
create index if not exists idx_reward_claims_reward_id on reward_claims(reward_id);

create table if not exists reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_claim_id uuid not null references reward_claims(id),
  reward_id uuid not null references rewards(id),
  customer_id uuid not null references customers(id),
  -- Set when redeemed at WooCommerce checkout via the reservation model
  -- (see reward_reservations in 0006_checkout_reservations.sql); null
  -- for a reward redeemed outside checkout (e.g. a free-item voucher).
  cart_key text,
  woocommerce_order_id text,
  reward_code_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_reward_redemptions_customer_id on reward_redemptions(customer_id, created_at);
create index if not exists idx_reward_redemptions_claim_id on reward_redemptions(reward_claim_id);
-- "Redeemed reward cannot be reused": one redemption per claim, enforced
-- at the database level, not just in application code.
create unique index if not exists idx_reward_redemptions_claim_id_unique on reward_redemptions(reward_claim_id);

-- The actual WooCommerce coupon code minted for a coupon-type reward
-- redemption. One row per redemption; the code itself is generated by
-- the application (not WooCommerce) and pushed to WooCommerce as a
-- coupon via the existing WooCommerce API client.
create table if not exists reward_codes (
  id uuid primary key default gen_random_uuid(),
  reward_redemption_id uuid not null references reward_redemptions(id),
  code text not null unique,
  woocommerce_coupon_id text,
  status text not null default 'issued' check (status in ('issued', 'synced', 'failed')),
  created_at timestamptz not null default now()
);
create index if not exists idx_reward_codes_redemption_id on reward_codes(reward_redemption_id);

alter table reward_redemptions
  add constraint reward_redemptions_reward_code_id_fkey
  foreign key (reward_code_id) references reward_codes(id);

-- System-defined permissions (see /docs/permissions.md). Not creatable via API.
insert into permissions (key, description) values
  ('loyalty:view', 'View loyalty programs, tiers, and rules'),
  ('loyalty:manage', 'Create/update/delete loyalty programs, tiers, and rules'),
  ('points:view', 'View customer points balances and ledger entries'),
  ('reward:view', 'View the reward catalog'),
  ('reward:create', 'Create a reward catalog entry'),
  ('reward:update', 'Update a reward catalog entry'),
  ('reward:delete', 'Delete a reward catalog entry'),
  ('reward_claim:view', 'View customer reward claims'),
  ('reward_redemption:view', 'View customer reward redemptions')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.name = 'Super Admin'
and p.key in (
  'loyalty:view', 'loyalty:manage', 'points:view',
  'reward:view', 'reward:create', 'reward:update', 'reward:delete',
  'reward_claim:view', 'reward_redemption:view'
)
on conflict do nothing;
