# VisionPrime OS — Database Conventions

## 1. Table Naming Rules

- `snake_case`, plural: `customers`, `orders`, `wallet_ledger_entries`.
- Join/lookup tables: `<a>_<b>` in alphabetical/logical order, e.g.
  `customer_segments`.
- No business/brand/tenant prefix on table names (single-business system).

## 2. Column Naming Rules

- `snake_case` columns: `created_at`, `customer_id`, `is_active`.
- Foreign keys: `<referenced_table_singular>_id`, e.g. `customer_id`,
  `order_id`.
- Boolean columns prefixed `is_`/`has_`: `is_active`, `has_synced`.
- Avoid abbreviations unless industry-standard (`id`, `url`, `sku`).

## 3. UUID IDs

- Every table's primary key is a UUID (`id uuid primary key default
  gen_random_uuid()` or equivalent), not an auto-increment integer.
- External system IDs (e.g. WooCommerce order ID) are stored in a
  dedicated column (e.g. `woo_order_id`), never reused as the primary key.

## 4. Timestamps

- Every table has `created_at timestamptz not null default now()`.
- Every mutable table has `updated_at timestamptz not null default
  now()`, maintained on every update.
- Append-only/ledger tables omit `updated_at` (rows are never updated).

## 5. Soft Delete Rules

- Mutable entity tables (customers, orders, segments, campaigns, etc.) use
  soft delete: `deleted_at timestamptz null`.
- Default queries exclude rows where `deleted_at is not null`.
- Hard deletes are not used for business entities. Ledger and audit tables
  are never deleted at all (see below).

## 6. Append-Only Table Rules

- Tables representing an immutable history of events (wallet ledger,
  points ledger, audit log, webhook event log) are **append-only**:
  - No `UPDATE` statements against existing rows in normal operation.
  - No `DELETE` statements against existing rows, ever.
  - No `updated_at` or `deleted_at` columns — once written, a row is
    permanent.
- Corrections are made by appending a new, opposite/compensating row —
  never by editing history.

## 7. Ledger Table Rules

- Wallet and points balances are **derived**, never stored as a mutable
  column that gets directly updated.
- Ledger tables (`wallet_ledger_entries`, `points_ledger_entries`) include
  at minimum:
  - `id` (uuid)
  - `customer_id`
  - `type` (`credit` | `debit`)
  - `amount` (see money storage rules)
  - `reason` / `source` (e.g. `order_refund`, `manual_admin_adjustment`,
    `loyalty_reward`)
  - `reference_id` (nullable — e.g. related order id)
  - `created_by` (admin user id, or `system`)
  - `created_at`
- Current balance is computed as `SUM(credits) - SUM(debits)` (or
  maintained via a read-optimized materialized/aggregate view that is
  itself rebuilt from the ledger — never hand-edited).
- Direct mutation of a "balance" column on the customer/wallet table is
  forbidden.

## 8. Index Rules

- Every foreign key column is indexed.
- Every column used in default list-view filtering/sorting (e.g.
  `created_at`, `status`, `deleted_at`) is indexed.
- Composite indexes are added for known hot query patterns (e.g.
  `(customer_id, created_at)` on ledger tables) rather than relying on
  multiple single-column indexes.
- Unique constraints are used (not just indexes) wherever uniqueness is a
  business rule (e.g. `woo_order_id` unique per sync source).

## 9. Money Storage Rules

- All monetary amounts are stored as **integers in the smallest currency
  unit** (e.g. cents), never as floating point.
- Column type: `bigint` (or `numeric(12,0)` if the DB lacks bigint), named
  with a unit-explicit suffix where helpful (e.g. `amount_cents`).
- Currency is explicit: every money-bearing table includes a `currency`
  column (ISO 4217, e.g. `USD`) even in a single-currency system, to avoid
  ambiguity if that ever changes.
- All arithmetic on money happens in application/service code using
  integer math — never in floating point, never relying on client-supplied
  totals without server-side recomputation.
