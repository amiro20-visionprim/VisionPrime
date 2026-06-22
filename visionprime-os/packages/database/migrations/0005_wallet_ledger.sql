-- Phase 07: production-safe ledger-based wallet core. See
-- /docs/database-conventions.md §6/§7/§9 and /docs/phase-07-wallet-ledger.md.
-- No WordPress checkout wallet, no points, no rewards/redemption this phase.
--
-- The wallet balance is NEVER a directly-mutable column anywhere in this
-- schema. It is always SUM(credits) - SUM(debits) over
-- wallet_ledger_entries. wallet_balance_snapshots is an append-only,
-- non-authoritative cache written alongside each ledger entry purely for
-- fast historical lookups/reports — it is never read as the source of
-- truth and never updated/deleted.

create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references customers(id),
  currency text not null default 'USD',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wallets_customer_id on wallets(customer_id);

-- Append-only: no updated_at/deleted_at, no UPDATE/DELETE in application
-- code, ever. Corrections are made by inserting a reversal row (see
-- reversed_entry_id) — never by editing or removing a row.
create table if not exists wallet_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references wallets(id),
  customer_id uuid not null references customers(id),
  type text not null,
  direction text not null check (direction in ('credit', 'debit')),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null,
  reason text not null,
  internal_note text,
  reference_type text,
  reference_id text,
  idempotency_key text,
  reversed_entry_id uuid references wallet_ledger_entries(id),
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_wallet_ledger_wallet_id on wallet_ledger_entries(wallet_id, created_at);
create index if not exists idx_wallet_ledger_customer_id on wallet_ledger_entries(customer_id, created_at);
create index if not exists idx_wallet_ledger_reference on wallet_ledger_entries(reference_type, reference_id);
create index if not exists idx_wallet_ledger_reversed_entry_id on wallet_ledger_entries(reversed_entry_id);
-- Enforces "each WooCommerce order cashback is created once" and "all
-- financial actions are idempotent if reference_id is provided" at the
-- database level, not just in application code.
create unique index if not exists idx_wallet_ledger_idempotency_key
  on wallet_ledger_entries(idempotency_key) where idempotency_key is not null;

-- Append-only cache, one row per ledger entry, recording the resulting
-- balance at that point in time. Never the source of truth for balance.
create table if not exists wallet_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references wallets(id),
  ledger_entry_id uuid not null references wallet_ledger_entries(id),
  balance_cents bigint not null,
  currency text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_wallet_balance_snapshots_wallet_id on wallet_balance_snapshots(wallet_id, created_at);

-- Base cashback-rule configuration. Phase 07 ships a single percentage-of-
-- order-total rule type; no rule editing UI/API this phase.
create table if not exists wallet_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rule_type text not null,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Base expiration tracking for credited amounts. No expiration cron job
-- ships this phase — this only records intent so a later phase can sweep
-- `status = 'pending'` rows that are past `expires_at`.
create table if not exists wallet_expirations (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references wallets(id),
  ledger_entry_id uuid not null references wallet_ledger_entries(id),
  amount_cents bigint not null,
  currency text not null,
  expires_at timestamptz not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists idx_wallet_expirations_wallet_id on wallet_expirations(wallet_id);
create index if not exists idx_wallet_expirations_expires_at on wallet_expirations(expires_at) where status = 'pending';

-- Disabled by default (percentage 0) — a later phase/admin action turns
-- this on with a real percentage. Seeding it active-with-a-rate-by-default
-- would create real money on every order without anyone deciding to.
insert into wallet_rules (name, rule_type, config, is_active)
select 'Default order cashback', 'cashback_percentage', '{"percentage": 0}'::jsonb, false
where not exists (select 1 from wallet_rules where rule_type = 'cashback_percentage');

-- System-defined permissions (see /docs/permissions.md). Not creatable via API.
insert into permissions (key, description) values
  ('wallet:view', 'View customer wallets and ledger entries'),
  ('wallet:manual_credit', 'Issue a manual wallet credit'),
  ('wallet:manual_debit', 'Issue a manual wallet debit'),
  ('wallet:reverse', 'Reverse a wallet ledger entry'),
  ('wallet:report:view', 'View wallet liability reports')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.name = 'Super Admin'
and p.key in ('wallet:view', 'wallet:manual_credit', 'wallet:manual_debit', 'wallet:reverse', 'wallet:report:view')
on conflict do nothing;
