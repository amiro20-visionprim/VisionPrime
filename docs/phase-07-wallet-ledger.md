# Phase 07 — Wallet Ledger Core

Status: **Complete**

## Scope

Adds a production-safe, ledger-based wallet core. This is a financial
module — every rule below is a hard invariant, not a guideline. No
WordPress checkout wallet, no rewards, and no points integration are
introduced this phase (cashback uses the wallet ledger only, as a base
for a later rewards phase).

## 1. Database Migrations

`packages/database/migrations/0005_wallet_ledger.sql`:

- `wallets` — one row per customer (`customer_id unique`), `currency`,
  `status`. **No balance column.**
- `wallet_ledger_entries` — append-only. `direction` (`credit`/`debit`),
  `amount_cents` (`check (amount_cents > 0)`), `reason` (required),
  `internal_note`, `reference_type`/`reference_id`, `idempotency_key`
  (partial unique index — `where idempotency_key is not null`),
  `reversed_entry_id` (self-reference for reversals), `metadata`,
  `created_by_user_id`. No `updated_at`/`deleted_at` — there is no
  application code path that ever issues `UPDATE`/`DELETE` against this
  table.
- `wallet_balance_snapshots` — append-only cache, one row per ledger
  entry, recording the resulting balance. Never read as the source of
  truth; balance is always recomputed from the ledger.
- `wallet_rules` — base cashback-rule config (`cashback_percentage`),
  seeded inactive (`percentage: 0`) so no real money moves until an
  admin explicitly activates a rate.
- `wallet_expirations` — base table for future credit-expiration
  sweeping; no cron/sweep job ships this phase.
- Seeds the 5 wallet permissions and grants them to Super Admin.

## 2. API Endpoints

`/api/admin/wallets`

| Method | Path | Permission |
|---|---|---|
| GET | `/:customerId` | `wallet:view` |
| GET | `/:customerId/ledger` | `wallet:view` |
| POST | `/:customerId/manual-credit` | `wallet:manual_credit` |
| POST | `/:customerId/manual-debit` | `wallet:manual_debit` |
| POST | `/ledger/:entryId/reverse` | `wallet:reverse` |
| GET | `/reports/liability` | `wallet:report:view` |

Every endpoint internally calls `getOrCreateForCustomer` — there is no
dedicated wallet-creation endpoint; a wallet is provisioned lazily the
first time it's needed.

There is intentionally **no delete/update route** for ledger entries
anywhere in the API surface.

## 3. Business Logic

- **Balance** is always computed as
  `SUM(credit amount_cents) - SUM(debit amount_cents)` over
  `wallet_ledger_entries` for the wallet — never stored, never directly
  set.
- **Manual credit/debit**: require `reason`; debit is rejected with
  `422 INSUFFICIENT_BALANCE` if it would take the balance below zero;
  both write a financial audit log entry (`wallet.manual_credit` /
  `wallet.manual_debit`) and, if a `referenceId` is supplied, an
  idempotency key so retried requests are safe.
- **Reversal**: creates a new, opposite-direction ledger entry pointing
  back at the original via `reversed_entry_id`. A `type: "reversal"`
  entry cannot itself be reversed (`422 CANNOT_REVERSE_REVERSAL`); an
  entry already reversed cannot be reversed again
  (`409 ALREADY_REVERSED`). The original entry is never edited or
  removed.
- **Cashback**: `applyCashbackForOrder` is wired into the WooCommerce
  order sync/webhook path (Phase 06) via optional dependency-injected
  closures, to avoid a circular import between the wallet and
  wordpress-sync modules. It reads the active `cashback_percentage`
  rule, no-ops if none is active or the computed amount is zero, and
  writes a `type: "cashback"` credit idempotency-keyed on the
  WooCommerce order id — re-syncing or redelivering the same order
  webhook never double-credits. If an order transitions from a
  cashback-eligible status to cancelled/refunded,
  `reverseCashbackForOrder` writes the opposite debit reversal entry
  (idempotent — a second cancel/refund is a no-op).
- **Transactionality**: every multi-step ledger write (`recordLedgerEntry`)
  runs inside `Db.withTransaction` — a balance-snapshot insert that fails
  rolls back the ledger insert with it.
- **Liability report**: aggregates the sum of all wallet balances across
  every wallet, plus a wallet count, in a single query.

## 4. Admin UI

- **Wallet overview** (`/wallet`) — liability report (`MetricCard`s,
  gated `wallet:report:view`) plus a customer list with a "View Wallet"
  row action.
- **Wallet detail/ledger** (`/wallet/[customerId]`) — available balance,
  paginated ledger `DataTable`, Manual Credit/Manual Debit buttons
  (gated `wallet:manual_credit`/`wallet:manual_debit`), and a "Reverse"
  row action (gated `wallet:reverse`) using `ConfirmDialog`.
- **Manual credit/debit modal** — customer name, current available
  balance, `MoneyInput` amount, computed balance-after (flagged if it
  would go negative), required reason, optional staff-only internal
  note, an immutability warning banner, and a confirmation checkbox that
  gates the submit button — no one-click financial action is possible.
- **Customer 360 wallet card** — a `MetricCard` showing the customer's
  wallet balance plus a "View Wallet" link, added to the Overview tab
  of the existing customer detail page, gated on `wallet:view`.
- Sidebar's "Wallet" link is gated on `wallet:view`.

All UI gating is presentation-only — every endpoint enforces its
permission server-side regardless of what the frontend shows or hides.

## 5. Permissions Added

| Key | Grants access to |
|---|---|
| `wallet:view` | `GET /:customerId`, `GET /:customerId/ledger` |
| `wallet:manual_credit` | `POST /:customerId/manual-credit` |
| `wallet:manual_debit` | `POST /:customerId/manual-debit` |
| `wallet:reverse` | `POST /ledger/:entryId/reverse` |
| `wallet:report:view` | `GET /reports/liability` |

All five are seeded as system permissions and granted to Super Admin by
the migration; see `/docs/permissions.md` for the full catalog.

## 6. Audit Events Added

Every manual credit, manual debit, and reversal writes a financial audit
log entry (`wallet.manual_credit`, `wallet.manual_debit`,
`wallet.reverse`) via the existing audit service, recording the actor,
amount, reason, and reference. Cashback application/reversal is
system-driven (no human actor) and is not audit-logged the same way —
it is fully traceable via the ledger's `reference_type`/`reference_id`
instead.

## 7. Tests Added

`apps/api/src/modules/wallet/wallet.controller.spec.ts`: balance
calculated from ledger; manual credit creates a credit entry; manual
debit creates a debit entry; debit over balance fails
(`422 INSUFFICIENT_BALANCE`); reason is required (`400`); no delete
route exists for ledger entries; reversal creates an opposite entry;
an entry cannot be reversed twice (`409 ALREADY_REVERSED`); cashback for
the same order is not duplicated on re-sync; cashback is reversed when
an order becomes cancelled/refunded; a financial audit log entry is
created for manual operations; permission checks for all 5 wallet
permissions; liability report sums all wallet balances.

All `apps/api` tests pass (`npm run test --workspace=apps/api` — 68/68).

## 8. Demo Steps

1. Open a customer's 360 page — the Overview tab shows their wallet
   balance with a "View Wallet" link.
2. Click into the wallet detail page; click **Manual Credit**, enter an
   amount and reason, check the confirmation box, and submit — the
   ledger gains a new credit row and the balance updates.
3. Click **Manual Debit** for more than the available balance — the
   request is rejected with an insufficient-balance error.
4. Click **Reverse** on a ledger row, supply a reason, and confirm — a
   new opposite-direction row appears; the original row is unchanged.
5. Sync/receive a WooCommerce order webhook with an active cashback
   rule — a cashback credit appears once; re-syncing the same order
   does not create a second one. Cancelling/refunding that order
   reverses the cashback.
6. Visit `/wallet` to see the liability report (total liability across
   all wallets) and the customer list with "View Wallet" actions.

## 9. Verification Performed

- `npm run build --workspace=packages/database` — clean.
- `npm run build --workspace=packages/permissions` — clean.
- `npm run build --workspace=packages/ui` — clean (added `MoneyInput`).
- `npm run build --workspace=apps/api` — clean.
- `npm run build --workspace=apps/admin` — clean (`next build`,
  including type checking).
- `npm run test --workspace=apps/api` — 68/68 tests pass.
- No live database/Redis credentials are available in this environment,
  so the API could not be booted for manual browser verification this
  phase; verification relies on the build and automated test suite
  above, consistent with prior phases' constraints in this sandbox.

## 10. Known Limitations

- No WordPress checkout wallet integration — explicitly out of scope.
- No rewards/points redemption — explicitly out of scope; cashback is a
  ledger-only base for a later rewards phase.
- `wallet_expirations` is a base table only; no sweep job expires
  pending credits yet.
- The cashback rule is seeded inactive (0%) — no real cashback is
  issued until an admin activates a rule, and there is no admin UI to
  edit `wallet_rules` this phase (base table only, as scoped).

## Confirmation

Phase 07 is implemented end-to-end per spec: ledger-based wallet core
with append-only entries, manual credit/debit, reversal, cashback base
wired to order sync/webhooks, liability reporting, admin UI (wallet
overview, wallet detail, manual entry modals, reversal flow, Customer
360 wallet card), permissions, audit logging, and tests are all in
place. Wallet balance is never directly editable anywhere in this
codebase.
