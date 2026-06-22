# Phase 09 — WooCommerce Checkout Integration: Wallet & Reward Reservations

Status: **Complete** (wallet checkout fully implemented; reward checkout is base structure only)

## Scope

Implements the reservation-based checkout model for applying wallet
credit at WooCommerce checkout via AJAX, with full WordPress plugin
integration. Reward checkout endpoints/AJAX actions exist as the same
disabled base structure used elsewhere in the system (`{ enabled:
false }`), ready for a future phase to complete.

Core invariant: a reservation only ever **holds** intent. The wallet
ledger is debited exactly once, only when a reservation is
**confirmed** (payment success). Releasing a reservation (removal,
payment failure/cancellation, expiry) never touches the ledger.

## 1. Migrations

`wallet_reservations` and `reward_reservations` tables (migration
`0006_checkout_reservations.sql`):

- `id`, `customer_id`, `wallet_id`, `cart_key`, `amount_cents`,
  `currency`, `status` (`active` | `confirmed` | `released` |
  `expired`), `expires_at`, `woocommerce_order_id`, `created_at`,
  `updated_at`.
- A partial unique index on `(cart_key)` where `status = 'active'`
  enforces "no duplicate active reservation per cart" at the database
  level, in addition to the service-level idempotency check.

## 2. Backend checkout APIs (`apps/api/src/modules/checkout`)

Eight plugin-facing endpoints, mounted at `/api/wp-plugin/checkout`,
all POST, all protected by the same Phase 08 `requirePluginAuth`
HMAC/nonce middleware (no new auth mechanism was introduced):

- `/checkout/wallet/validate` — recomputes available balance from the
  ledger and checks the requested amount; never trusts the
  frontend-submitted amount.
- `/checkout/wallet/reserve` — creates (or, for a duplicate click with
  the same cart key + amount, returns the existing) active
  reservation. Returns `409 INSUFFICIENT_BALANCE` style errors via
  `422` when the amount exceeds available balance.
- `/checkout/wallet/release` — moves an active reservation to
  `released`; no ledger write.
- `/checkout/wallet/confirm` — transactional (`db.withTransaction` +
  `select ... for update` row lock): writes a wallet ledger debit and
  marks the reservation `confirmed`. Rejects with `409
  RESERVATION_EXPIRED` if past `expires_at`, and returns `404` if the
  cart has no active reservation (covers "cannot confirm twice").
- `/checkout/reward/{validate,reserve,release,confirm}` — disabled
  base-structure endpoints, mirroring the rewards `{ enabled: false }`
  pattern used in Phase 08.

Three admin-facing read endpoints, gated by `wallet_reservation:view`
/ `reward_reservation:view` permissions, mounted at
`/api/admin/wallet-reservations` and `/api/admin/reward-reservations`:

- `GET /` — paginated list.
- `GET /:id` — single reservation.
- `GET /customer/:customerId` — a customer's reservation history (used
  by the Customer 360 "Reservations" tab).

## 3. Plugin checkout AJAX implementation

`class-vp-checkout.php` registers five AJAX actions (always wired,
each guarded by `VP_Auth::require_customer_ajax()` — nonce + logged-in
check on every call):

- `vp_apply_wallet_credit` — validates then reserves via the backend,
  storing the reservation in `WC()->session`.
- `vp_remove_wallet_credit` — releases the active reservation and
  clears session state.
- `vp_apply_reward_to_cart`, `vp_remove_reward_from_cart`,
  `vp_validate_checkout_reward` — base-structure placeholders
  returning a disabled response.

No secrets (plugin API key, shared secret) are ever localized to JS;
all signed backend calls happen server-side through the existing
`VP_Api_Client`.

## 4. WooCommerce hook integration

Wired only when `enable_checkout_wallet` is turned on in plugin
settings:

- `woocommerce_cart_calculate_fees` → `apply_wallet_fee()` adds a
  negative `WC_Cart::add_fee()` for the active reservation amount,
  so WooCommerce's own totals math reflects the wallet credit.
- `woocommerce_checkout_create_order` → `stamp_order_with_reservation()`
  persists `_vp_wallet_cart_key` / `_vp_wallet_reservation_id` as
  order meta, since later lifecycle hooks may run outside the original
  PHP session.
- `woocommerce_payment_complete` → `confirm_reservation_for_order()`
  calls `/checkout/wallet/confirm`; failure is logged and added as an
  order note but never blocks checkout completion.
- `woocommerce_order_status_cancelled` / `woocommerce_order_status_failed`
  → `release_reservation_for_order()` calls `/checkout/wallet/release`.

Totals refresh without a full page reload: the public JS apply/remove
handlers call `$(document.body).trigger('update_checkout')` after a
successful AJAX call, which invokes WooCommerce's own native
`update_order_review` AJAX cycle — `apply_wallet_fee()` is re-invoked
by WooCommerce as part of that cycle, so the refreshed totals
automatically include the wallet fee with no custom refresh endpoint.

The checkout widget (`render_wallet_widget()`, `.vp-checkout-wallet`)
shows balance, max usable amount, applied amount, a remove button,
the reservation/applied message, and inline errors — all sourced from
existing AJAX calls plus the new apply/remove actions.

## 5. Admin reservation visibility

- `/wallet-reservations` — paginated list (cart key, amount, status,
  order, expires, created), gated by `wallet_reservation:view` in the
  sidebar and route.
- `/wallet-reservations/[id]` — single reservation detail.
- Customer 360 (`/customers/[id]`) — new "Reservations" tab listing a
  customer's reservation history, gated the same way.

## 6. Tests

`apps/api/src/modules/checkout/checkout.controller.spec.ts` (14 tests,
all passing) covers, through the real HTTP + plugin-auth surface:

- Applying a wallet amount creates an active reservation.
- Removing (releasing) clears the reservation with no ledger debit.
- Payment success (confirm) writes a ledger debit and marks the
  reservation confirmed.
- Payment failure (release) leaves the wallet balance untouched.
- A duplicate click with the same amount does not duplicate the
  reservation.
- Reserving more than the available balance fails
  (`422 INSUFFICIENT_BALANCE`).
- An expired reservation cannot be confirmed
  (`409 RESERVATION_EXPIRED`).
- A reservation cannot be confirmed twice (second confirm → `404`,
  since no active reservation remains for the cart).
- Missing plugin auth headers (no nonce/signature) → `401`.
- Invalid plugin credentials (unresolvable customer) → `401`.
- Non-positive amount fails validation (`400 VALIDATION_FAILED`).
- Admin with `wallet_reservation:view` can list reservations;
  admin without it gets `403`.
- Reward checkout endpoints return the disabled base-structure
  response.

"Checkout total refreshes without reload" and "missing
nonce/logged-out customer fails" are satisfied by code design (the
native WooCommerce `update_checkout` event mechanism, and the reused
Phase 08 `require_customer_ajax()` guard) but have no dedicated
automated test, as this repo has no PHPUnit harness for the plugin.

Full backend suite: 14 suites / 92 tests passing. `apps/api` and
`apps/admin` both build cleanly; all touched PHP files pass `php -l`;
the edited plugin JS passes `node --check`.

## 7. Demo steps

1. Enable "Enable Checkout Wallet" in the VisionPrime Connector
   settings page in WP admin.
2. As a logged-in customer with wallet balance, go to WooCommerce
   checkout — the wallet widget shows the available balance.
3. Enter an amount and click Apply — an AJAX call validates and
   reserves the amount; the cart fee (and totals) update via
   WooCommerce's native `update_checkout` refresh, no page reload.
4. Click Remove — the reservation is released, the fee is removed,
   totals refresh again via AJAX.
5. Re-apply, then complete payment — `woocommerce_payment_complete`
   confirms the reservation, writing a single wallet ledger debit.
6. In the admin app, view `/wallet-reservations` (or the customer's
   360 "Reservations" tab) to see the reservation's final
   `confirmed` status and linked WooCommerce order id.
7. Repeat with a cancelled/failed order to observe the reservation
   move to `released` with no ledger debit.

## 8. Phase 09 completion report

- **Migrations**: `wallet_reservations`, `reward_reservations` tables
  added, with a partial unique index enforcing one active reservation
  per cart key.
- **Backend checkout APIs**: 8 plugin-facing endpoints
  (`/api/wp-plugin/checkout/{wallet,reward}/{validate,reserve,release,confirm}`)
  plus 3 admin read endpoints per reservation type, all under existing
  auth middleware.
- **Plugin checkout AJAX implementation**: 5 AJAX actions
  (`vp_apply_wallet_credit`, `vp_remove_wallet_credit`,
  `vp_apply_reward_to_cart`, `vp_remove_reward_from_cart`,
  `vp_validate_checkout_reward`), wallet fully wired, rewards as base
  structure, no secrets exposed to JS.
- **WooCommerce hook integration**: cart fee calculation, order meta
  stamping, payment-complete confirm, cancelled/failed release, AJAX
  totals refresh via native `update_checkout` — no full page reloads.
- **Admin reservation visibility**: global list, detail page, and
  Customer 360 history tab, gated by `wallet_reservation:view`.
- **Tests**: 14 new backend tests covering every reservation rule in
  the spec that's testable without a plugin-side test harness; full
  suite (92 tests / 14 suites) green.
- **Demo steps**: documented above.
- Never directly debits the wallet before order confirmation, never
  mutates balance outside `confirm`, never skips the reservation step,
  never reloads the page, and never duplicates a financial action on
  repeated clicks — all verified by the test suite and code review of
  the hook wiring.
