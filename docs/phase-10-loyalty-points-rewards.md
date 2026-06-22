# Phase 10 — Loyalty, Points, Tiers & Rewards

Status: **Complete**

## Scope

Implements a full loyalty program: points earned per order, tier
progression based on lifetime points, a reward catalog redeemable
with points, and a reward claim/redeem/checkout-apply lifecycle that
mirrors the existing wallet reservation model. Covers backend
modules, admin UI, WordPress plugin AJAX + checkout integration, and
tests.

Core invariants carried over from prior phases: points are
ledger-based (idempotent by key, reversible via reversal entries,
never mutated in place); reward application at checkout only ever
**reserves** intent — the points/claim state is only mutated on
reservation **confirm** (payment success), never on apply.

## 1. Migrations

`0007_loyalty_points_rewards.sql` adds:

- `loyalty_programs` — `id`, `name`, `description`, `is_active`,
  `points_per_currency_unit`, `config` (jsonb).
- `loyalty_tiers` — `id`, `program_id`, `name`,
  `min_lifetime_points`, `sort_order`, `benefits` (jsonb).
- `loyalty_rules` — `id`, `program_id`, `name`, `rule_type`, `config`
  (jsonb), `is_active` — extensible hooks for bonus-point rules
  beyond the base per-currency-unit rate.
- `points_ledger` — append-only ledger: `id`, `customer_id`, `type`
  (`purchase` | `manual` | `reward_claim` | `reversal`), `direction`
  (`credit`/`debit`), `points`, `reason`, `reference_type`,
  `reference_id`, `reversed_entry_id`, `idempotency_key`,
  `created_at`. Balance and lifetime points are derived by summing
  the ledger, never stored as a separately-mutated column.
- `rewards` — catalog: `id`, `name`, `description`, `reward_type`
  (`coupon` | `free_item` | `other`), `points_cost`,
  `coupon_config` (jsonb), `claim_validity_days`, `is_active`,
  `max_claims`.
- `reward_claims` — `id`, `reward_id`, `customer_id`, `status`
  (`claimed` | `redeemed` | `expired` | `cancelled`), `expires_at`.
- `reward_redemptions` — `id`, `reward_claim_id`, `reward_id`,
  `customer_id`, `cart_key`, `woocommerce_order_id`, `created_at`.

## 2. Backend modules & APIs

Three new modules (`loyalty`, `points`, `rewards`) under
`apps/api/src/modules`, each following the established
`*.types.ts`/`*.repository.ts`/`*.service.ts`/`*.controller.ts`/`*.dto.ts`
composition.

Admin routes (`/api/admin/...`):

- `loyalty/programs` — `GET`, `POST`, `PATCH /:id` (gated by
  `loyalty:view` / `loyalty:manage`).
- `loyalty/tiers` — `GET`, `POST`, `PATCH /:id`, `DELETE /:id`.
- `loyalty/rules` — `GET`, `POST`, `PATCH /:id`, `DELETE /:id`.
- `loyalty/customer/:customerId/status` — a customer's current tier,
  next tier, lifetime points, and points-to-next-tier (gated by
  `loyalty:view`).
- `points/customer/:customerId` — current balance + lifetime points
  (gated by `points:view`).
- `points/customer/:customerId/ledger` — paginated ledger entries.
- `rewards` — `GET`, `POST`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
  (gated by `reward:view` / `reward:create` / `reward:update` /
  `reward:delete`).
- `reward-claims` — `GET` (optional `customerId` filter), gated by
  `reward_claim:view`.
- `reward-redemptions` — `GET` (optional `customerId` filter), gated
  by `reward_redemption:view`.

Plugin-facing routes (`/api/wp-plugin/...`, HMAC-signed via the
existing Phase 08 `requirePluginAuth` middleware):

- `rewards/:id/claim` — debits points, creates a claim with
  `expiresAt` derived from `claimValidityDays`.
- `rewards/:id/redeem` — redeems a claim directly (non-checkout
  path); rejects expired (`409 REWARD_CLAIM_EXPIRED`), already
  redeemed (`409 REWARD_ALREADY_REDEEMED`), or claims owned by a
  different customer (`403 REWARD_OWNERSHIP_INVALID`).
- `checkout/reward/{validate,reserve,release,confirm}` — reservation
  lifecycle for applying a claimed reward at WooCommerce checkout,
  structurally identical to the wallet reservation endpoints from
  Phase 09.

Order sync (`orders.sync-from-wordpress`) was extended to award
points on completed orders and reverse them on refund/cancel,
re-evaluating the customer's tier after each change — all
idempotent across repeated syncs via the ledger's idempotency key.

## 3. Plugin AJAX & checkout integration

`class-vp-ajax.php` adds customer-facing AJAX actions, each behind
`VP_Auth::require_customer_ajax()` plus the relevant
`VP_Settings::is_*_enabled()` feature flag:

- `vp_get_points`, `vp_get_rewards`, `vp_get_tier` — read-only
  fetches (already existed; verified/fixed response handling this
  phase).
- `vp_claim_reward` — claims a reward by id.
- `vp_redeem_reward` — redeems an existing claim by id.

`class-vp-checkout.php` extends the wallet reservation pattern to
rewards:

- `vp_apply_reward_to_cart` — validates then reserves a claimed
  reward against a cart key, storing the reservation in
  `WC()->session`.
- `vp_remove_reward_from_cart` — releases the reservation and clears
  session state.
- `woocommerce_cart_calculate_fees` → `apply_reward_fee()` adds a
  zero-amount fee line marking the applied state in cart totals.
- `woocommerce_checkout_create_order` → stamps
  `_vp_reward_cart_key` / `_vp_reward_reservation_id` order meta.
- `woocommerce_payment_complete` → confirms the reservation
  (failure is logged + added as an order note, never blocks
  checkout).
- `woocommerce_order_status_cancelled` / `_failed` → releases the
  reservation.

`assets/js/visionprime-public.js`:

- Fixed `renderComponent()` to read the actual backend response
  field names for wallet (`availableBalanceCents`), points
  (`balance`, `lifetimePoints`), and tier (`currentTierName`) — a
  pre-existing mismatch from the earlier stub implementation.
- Added `renderRewardsList()` rendering claimed and available
  rewards (claim/redeem buttons), with all customer-controlled text
  passed through `vpEscapeHtml()`.
- Added `claimReward()` / `redeemReward()`, wired to
  `.vp-reward-claim` / `.vp-reward-redeem` click handlers in the
  page-ready init block, calling `vp_claim_reward` / `vp_redeem_reward`
  and refreshing the component on success.

No secrets are ever localized to JS; all signed backend calls happen
server-side through `VP_Api_Client`.

## 4. Admin UI

- `/loyalty` — "Programs", "Tiers", and "Rules" tabs. Create/edit
  programs (name, description, points-per-currency-unit, active);
  create/delete tiers (program, name, minimum lifetime points);
  create/edit/delete points rules (program, name, rule type,
  active). All mutation actions gated by `Can permission="loyalty:manage"`.
- `/rewards` — "Catalog", "Claims", "Redemptions", and "Analytics"
  tabs. Catalog: create/edit/delete rewards (name, description,
  type, points cost, claim validity, max claims, active), gated by
  `reward:create`/`reward:update`/`reward:delete`. Claims and
  Redemptions: paginated read-only `DataTable`s gated by
  `reward_claim:view`/`reward_redemption:view`. Analytics: metric
  cards (rewards in catalog, active rewards, total claims, total
  redemptions) computed from existing list/count endpoints — no new
  analytics endpoint was needed.
- Customer 360 (`/customers/[id]`) — new "Loyalty" tab: points
  balance + lifetime points metric cards, current/next tier and
  points-to-next-tier, and the customer's reward claims with status
  badges. Gated by `points:view`/`loyalty:view`/`reward_claim:view`.

## 5. Permissions

`loyalty:view`, `loyalty:manage`, `points:view`, `reward:view`,
`reward:create`, `reward:update`, `reward:delete`,
`reward_claim:view`, `reward_redemption:view` — all enforced
server-side via `requirePermission()` on every route; the admin UI
only hides controls it has no permission to use (defense in depth,
never the sole guard).

## 6. Audit events

Loyalty program/tier/rule create/update/delete, reward
create/update/delete, and tier-change events (`loyalty.tier_change`)
are all written to the audit log via the existing `AuditService`,
following the same pattern as every other admin mutation in the
system.

## 7. Tests

`apps/api/src/modules/rewards/phase10.controller.spec.ts` (12 tests,
all passing) covers, through the real HTTP + plugin-auth surface:

- An order creates points exactly once, even on re-sync.
- A refund/cancel reverses previously-awarded points.
- A customer crossing the tier threshold is upgraded (with an audit
  log entry).
- A reward can be claimed and debits points from the customer's
  ledger.
- An expired reward claim cannot be redeemed (`409
  REWARD_CLAIM_EXPIRED`).
- A redeemed reward claim cannot be redeemed a second time (`409
  REWARD_ALREADY_REDEEMED`).
- A claim cannot be redeemed by a customer who doesn't own it (`403
  REWARD_OWNERSHIP_INVALID`).
- A duplicate concurrent claim attempt does not produce two point
  debits for the same claim (idempotency keys differ per claim).
- A reward can be applied to a cart via the checkout reservation
  flow (reserve → confirm → the underlying claim cannot then be
  redeemed again directly).
- Admin can fetch a customer's loyalty status via the dedicated
  endpoint.
- `reward:create` / `loyalty:manage` are denied to callers lacking
  the permission.

Full backend suite: 15 suites / 104 tests passing. `apps/admin`
builds cleanly (`tsc --noEmit`); all touched PHP files pass `php -l`;
the edited plugin JS passes `node --check`.

## 8. Demo steps

1. In the admin app, go to `/loyalty` → create a program with a
   points-per-currency-unit rate, then add two tiers (e.g. Bronze at
   0 points, Silver at 100 lifetime points).
2. Go to `/rewards` → create a reward (e.g. "Free Coffee", 10 points,
   30-day claim validity).
3. Sync an order for a customer from `/orders` (or trigger
   `orders/sync-from-wordpress`) — points are credited once; re-sync
   to confirm no duplicate credit.
4. View the customer's 360 page → "Loyalty" tab — see the points
   balance, current tier, and lifetime points.
5. As that customer, view `[visionprime_points]`/`[visionprime_rewards]`
   shortcodes on the WordPress site — claim the reward via AJAX (no
   page reload); the claim appears in the rendered list.
6. At WooCommerce checkout, apply the claimed reward — verify the
   cart fee line and no full reload; complete payment to confirm the
   reservation.
7. Back in the admin app, `/rewards` → "Redemptions" tab shows the
   confirmed redemption linked to the WooCommerce order id; check the
   "Analytics" tab for updated totals.

## 9. Phase 10 completion report

- **Migrations**: `loyalty_programs`, `loyalty_tiers`,
  `loyalty_rules`, `points_ledger`, `rewards`, `reward_claims`,
  `reward_redemptions` added via `0007_loyalty_points_rewards.sql`.
- **Backend APIs**: full admin CRUD for programs/tiers/rules/rewards,
  customer status/balance/ledger reads, claims/redemptions lists, plus
  plugin-facing claim/redeem and checkout reservation endpoints —
  all under existing auth middleware patterns.
- **Plugin AJAX updates**: `vp_claim_reward`, `vp_redeem_reward`,
  `vp_apply_reward_to_cart`, `vp_remove_reward_from_cart` fully
  implemented; rewards/points/tier rendering fixed to match real
  backend response shapes; reward claim/redeem buttons wired to
  their handlers in the public JS.
- **Admin UI**: Loyalty (Programs/Tiers/Rules), Rewards
  (Catalog/Claims/Redemptions/Analytics), and a new Customer 360
  "Loyalty" tab.
- **Permissions**: 9 new permissions, enforced server-side on every
  route, mirrored by UI gating via `Can`.
- **Audit events**: program/tier/rule/reward mutations and
  `loyalty.tier_change` events recorded.
- **Tests**: 12 backend tests covering the full points/tier/reward
  lifecycle; full suite (104 tests / 15 suites) green; admin app
  type-checks cleanly; plugin PHP/JS verified syntactically.
- **Demo steps**: documented above.
- Never debits points outside the ledger, never mutates a claim on
  checkout *apply* (only on *confirm*), never allows redeeming an
  expired/already-redeemed/not-owned claim, and never duplicates a
  point award on repeated order syncs — all verified by the test
  suite and code review of the reservation/ledger wiring.
