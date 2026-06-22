# Phase 06 — WooCommerce Order Sync, Order Webhooks, Order List/Detail, Customer Purchase Metrics

Status: **Complete**

## Scope

Adds the orders module and extends the Phase 04/05 WordPress/WooCommerce
integration with idempotent order sync, signed order webhooks, and
customer purchase metrics. No wallet ledger, no cashback, no points/
rewards, and no checkout integration were introduced this phase — those
are explicitly deferred to later phases.

## 1. Database Migrations

`packages/database/migrations/0004_order_sync.sql`:

- Adds 5 purchase-metrics columns to the existing `customers` table:
  `purchase_count`, `total_spent`, `average_order_value`,
  `last_purchase_at`, `lifetime_value`. Maintained only by order sync
  and order webhooks.
- Adds a nullable `delivery_id` column (with a partial unique index) to
  the existing `wordpress_webhook_events` table, used to dedup
  WooCommerce webhook redeliveries.
- Creates `orders` (`woocommerce_order_id unique`, `customer_id`
  references `customers`), `order_items` (cascade-deletes with its
  order), and append-only `order_events`.
- Reuses `customers`, `wordpress_connections`, `wordpress_entity_mappings`,
  `wordpress_sync_jobs`, `wordpress_sync_logs`, and
  `wordpress_webhook_events` — no duplicate sync infrastructure was
  created.
- Seeds `order:view`, `order:sync`, `wordpress:webhook:view` and grants
  them to Super Admin.

## 2. API Endpoints

### Orders — `/api/admin/orders`

| Method | Path | Permission |
|---|---|---|
| GET | `/` | `order:view` |
| GET | `/:id` | `order:view` |
| POST | `/sync-from-wordpress` | `order:sync` |

`GET /:id` returns `{ order, items, events }`.
`POST /sync-from-wordpress` returns `{ job, counts }`, matching the
Phase 05 sync-route response shape.

### Webhooks — `/api/webhooks/wordpress`

| Method | Path |
|---|---|
| POST | `/order-created` |
| POST | `/order-updated` |
| POST | `/order-deleted` |

These are unauthenticated (no admin JWT) but require a valid HMAC
signature header, verified against the connection's shared secret.

### Webhook events list (existing Phase 04 route, gated with the new permission)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/admin/integrations/wordpress/webhooks/events` | `wordpress:webhook:view` |

## 3. Sync & Webhook Logic

- **Idempotent sync**: `OrdersSyncService`/sync extension creates a
  `wordpress_sync_jobs` row, fetches remote orders (fetch errors are
  caught and masked at the job level), then loops per-record in its own
  try/catch — a single bad record increments `counts.failed` and never
  aborts the run. The job is only marked `"failed"` when every record
  failed.
- **Order upsert**: keyed on `woocommerce_order_id` via
  `insert ... on conflict (woocommerce_order_id) do update ...` — re-
  syncing the same WooCommerce order updates it in place, never
  duplicates it.
- **Customer resolution**: reuses the Phase 05 match priority (mobile →
  email → wordpress_user_id → woocommerce_customer_id). If no existing
  customer matches, a new one is created from the order's billing
  email/mobile before the order is attached.
- **Purchase metrics**: `metricEffect(status)` classifies an order
  status as `"positive"` (completed/processing), `"negative"`
  (cancelled/refunded), or `"none"`. A metrics delta is applied only on
  a *transition* between effect categories (e.g. processing → refunded
  reverses the metrics; refunded → refunded again is a no-op) — this is
  what makes repeated syncs and webhook redeliveries idempotent for
  metrics, not just for the order row itself. Deltas update
  `purchase_count`, `total_spent`, `lifetime_value`, recompute
  `average_order_value`, and clamp at zero.
- **Webhook signature verification**: HMAC-SHA256 over the raw request
  body using the connection's shared secret, compared with
  `timingSafeEqual`. The raw body is captured via a `verify` callback on
  an `express.json()` instance scoped to the webhook router only,
  mounted before the global JSON body parser in both `app.ts` and the
  test harness.
- **Stored before processing**: every webhook delivery is inserted into
  `wordpress_webhook_events` (status `"received"` or `"rejected"`)
  before any business logic runs. Invalid signatures are stored as
  `"rejected"` and the request is answered with 401; valid signatures
  are processed and always acked 200 to avoid WooCommerce retry storms.
- **Duplicate/retry-safety**: `X-WC-Webhook-Delivery-ID` is looked up
  via `findByDeliveryId` before processing — a duplicate delivery ID is
  ignored outright. Redelivery of the same order payload under a
  *different* delivery ID is also safe because the order upsert and the
  metrics-transition logic are both idempotent.
- **`order-deleted`**: reverses the order's prior metrics effect (if
  any) without deleting the order row, then records an `order_events`
  entry.

## 4. Admin UI

- **Orders list** (`/orders`) — paginated `DataTable` of synced orders
  with `StatusBadge` and a "View" row action.
- **Order detail** (`/orders/[id]`) — order summary, an `order_items`
  `DataTable`, and an `order_events` `Timeline`.
- **Order sync button** — added to the WordPress Sync page's Manual
  Sync tab, gated on `order:sync`, calling
  `POST /api/admin/orders/sync-from-wordpress`.
- **Webhook events list** — added to the WordPress Sync page's
  Webhooks tab, gated on `wordpress:webhook:view`, paginated `DataTable`
  of `wordpress_webhook_events`.
- **Customer 360 extension** — new "Metrics" tab (`MetricCard`s for all
  5 purchase metrics) and new "Orders" tab (order history `DataTable`)
  added to the existing customer detail page.
- Sidebar's "Orders" link is now gated on `order:view` (previously
  always visible).

All UI gating is presentation-only — every endpoint above enforces its
permission server-side regardless of what the frontend shows or hides.

## 5. Permissions Added

| Key | Grants access to |
|---|---|
| `order:view` | `GET /api/admin/orders`, `GET /api/admin/orders/:id` |
| `order:sync` | `POST /api/admin/orders/sync-from-wordpress` |
| `wordpress:webhook:view` | `GET /api/admin/integrations/wordpress/webhooks/events` |

All three are seeded as system permissions and granted to Super Admin
by the migration; see `/docs/permissions.md` for the full catalog.

## 6. Audit / Webhook Events Added

- `order_events` rows are appended on every sync-driven create/update
  and on every webhook-driven create/update/delete, recording the
  triggering status transition in `metadata`.
- `wordpress_webhook_events` rows are appended for every inbound
  delivery (valid or rejected), independent of whether it was a
  duplicate.

## 7. Tests Added

`apps/api/src/modules/orders/orders.controller.spec.ts` (9 tests):
order sync creates an order; re-syncing the same WooCommerce order does
not duplicate it; order links to an existing customer; a missing
customer is created; a status change on re-sync updates the existing
order; customer purchase metrics update on a completed order; metrics
reverse when an order becomes refunded; `order:view` is denied without
the permission; `order:sync` is denied without the permission.

`apps/api/src/modules/wordpress/wordpress-webhooks.controller.spec.ts`
(5 tests): an invalid signature is rejected (401, stored as
`"rejected"`); a valid `order-created` webhook creates the order; a
duplicate delivery ID is ignored without reprocessing; a redelivery with
a different delivery ID is retry-safe (no duplicate order, no
double-counted metrics); an `order-deleted` webhook reverses purchase
metrics.

All 51 `apps/api` tests pass (`npm run test --workspace=apps/api`).

## 8. Demo Steps

1. Connect a WordPress/WooCommerce site on the WordPress Sync page
   (Connection tab) and register webhooks (Webhooks tab).
2. On the Manual Sync tab, click **Sync Orders** — orders are fetched
   from WooCommerce and inserted/updated, with customers resolved or
   created automatically.
3. Visit **Orders** in the sidebar to see the synced list; click
   **View** on a row to see its items and event timeline.
4. Open a customer's detail page and check the new **Metrics** tab
   (purchase count, total spent, average order value, lifetime value,
   last purchase) and **Orders** tab (that customer's order history).
5. Trigger a WooCommerce order webhook (create/update/delete) and
   confirm it appears in the Webhooks tab's event list, and that
   re-sending the same delivery does not create a duplicate order.

## 9. Verification Performed

- `npm run build --workspace=packages/ui` — clean.
- `npm run build --workspace=apps/admin` — clean (`next build`,
  including type checking).
- `npm run test --workspace=apps/api` — 51/51 tests pass.

## 10. Known Limitations

- No wallet ledger, cashback, points, rewards, or checkout integration
  — explicitly out of scope for this phase.
- Order webhook routes are unauthenticated by design (signature-only)
  to match WooCommerce's webhook delivery model; they are not protected
  by the admin JWT middleware.

## Confirmation

Phase 06 is implemented end-to-end per spec: orders module, order sync,
signed/deduped webhooks, customer purchase metrics, admin UI, permissions,
and tests are all in place, with no wallet/points/rewards/checkout code
introduced.
