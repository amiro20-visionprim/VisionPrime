# Phase 05 — Customer/Product Modules + WooCommerce Customer/Product Sync

Status: **Complete**

## Scope

Builds the customer and product modules and extends the Phase 04
WordPress/WooCommerce connection with idempotent customer and product
sync. Manual customer creation, customer 360 (notes/tags/identities/
events), duplicate detection, and merge are implemented. Products are
read-only in VisionPrime — WooCommerce is the single source of truth,
synced via `POST /sync/products`. No order sync, no wallet, no loyalty/
rewards, and no branch/brand/organization concepts were introduced.

## 1. Database Migrations

`packages/database/migrations/0003_customer_product.sql` — applied via
the same `runMigrations` runner as Phases 03/04. Creates 9 tables:

- `customers` — primary record, soft-deletable (`deleted_at`), indexed
  on `primary_email`, `primary_mobile`, `wordpress_user_id`,
  `woocommerce_customer_id`.
- `customer_identities` — secondary identities, `unique(identity_type, identity_value)`.
- `customer_profiles` — single-row-per-customer free-form `attributes` jsonb.
- `customer_tags` — `unique(customer_id, tag)`.
- `customer_notes` — append-only.
- `customer_events` — append-only Customer 360 timeline source.
- `customer_merge_logs` — append-only, full pre-merge snapshot of the
  merged-away customer for audit.
- `product_categories` — `woocommerce_category_id` unique.
- `products` — `woocommerce_product_id` unique, nullable `sku`,
  `category_woocommerce_ids` jsonb array, `raw` jsonb.

Reuses the Phase 04 `wordpress_connections`, `wordpress_sync_jobs`,
`wordpress_sync_logs`, and `wordpress_entity_mappings` tables — no new
sync-infrastructure tables were added. Seeds the 10 new permissions
below and grants them to the Super Admin role.

## 2. API Endpoints

### Customers — `/api/admin/customers`

| Method | Path | Permission |
|---|---|---|
| GET | `/` | `customer:view` |
| POST | `/` | `customer:create` |
| POST | `/merge` | `customer:merge` |
| GET | `/:id` | `customer:view` |
| GET | `/:id/360` | `customer:view` |
| PATCH | `/:id` | `customer:update` |
| DELETE | `/:id` (soft delete) | `customer:delete` |
| POST | `/:id/notes` | `customer:note:create` |
| POST | `/:id/tags` | `customer:tag:update` |

### Products — `/api/admin/products`, `/api/admin/product-categories`

| Method | Path | Permission |
|---|---|---|
| GET | `/api/admin/products` | `product:view` |
| GET | `/api/admin/products/:id` | `product:view` |
| GET | `/api/admin/product-categories` | `product:view` |

### Sync — `/api/admin/integrations/wordpress/sync/*`

| Method | Path | Permission |
|---|---|---|
| POST | `/sync/customers` | `wordpress:sync_customer` |
| POST | `/sync/products` | `wordpress:sync_product` |
| POST | `/sync/incremental` | both `wordpress:sync_customer` and `wordpress:sync_product` |

Each sync route returns `{ job, counts }`, where `counts` is
`{created, updated, failed, total}` and `job` is the persisted
`wordpress_sync_jobs` row (with the same counts stored in `job.metadata`).

## 3. Customer Matching & Sync Logic

Customer matching priority — checked in this exact order and never
reordered (`CustomersRepository.findByMatchPriority`,
`apps/api/src/modules/customers/customers.repository.db.ts`):

1. `primary_mobile`
2. `primary_email`
3. `wordpress_user_id`
4. `woocommerce_customer_id`

Manual creation (`CustomersService.create`) and customer sync
(`WordPressSyncService.syncCustomers`) both use this lookup before
deciding to create vs. update, so a customer can never be duplicated by
mobile or email match from either path.

Product sync (`WordPressSyncService.syncProducts`) is keyed on
`woocommerce_product_id` via `ProductsRepository.upsert`, an
`insert ... on conflict (woocommerce_product_id) do update`, making
re-running the sync idempotent (same record updates in place, never
duplicates).

Each remote record (customer or product) is processed inside its own
try/catch in the sync loop: a failure increments the job's `failed`
counter and writes a `wordpress_sync_logs` row (`level: "error"`), but
the loop continues to the next record — one bad record never aborts the
job. `wordpress_entity_mappings` (reused from Phase 04, keyed on
`unique(entity_type, remote_id)`) records a `customer`/`product`
mapping per successfully synced record, upserted so reruns stay
idempotent there too.

## 4. Customer Merge

`POST /api/admin/customers/merge` (`CustomersService.merge`,
`CustomersRepository.merge`) re-points `customer_notes`,
`customer_tags`, `customer_identities`, `customer_events`, and
`wordpress_entity_mappings.local_id` from the merged-away customer to
the survivor, writes a full pre-merge JSON snapshot to
`customer_merge_logs`, then soft-deletes the merged-away customer. The
survivor retains the union of both customers' notes/tags/identities/
events; the merged customer is no longer returned by `findById`.

## 5. Admin UI

- `/customers` — list with pagination, links to `/customers/new` (gated
  on `customer:create`) and to each customer's detail page.
- `/customers/new` — manual creation form (full name + email/mobile).
- `/customers/[id]` — Customer 360 view with tabs (Overview, Notes,
  Tags, Identities, Events) backed by `GET /:id/360`; note/tag
  add-forms gated on `customer:note:create`/`customer:tag:update`.
- `/products` — read-only list with pagination, links to detail.
- `/products/[id]` — read-only product detail (SKU, price, status,
  WooCommerce category IDs).
- `/wordpress-sync` — Manual Sync tab now has working "Sync Customers"/
  "Sync Products" buttons (gated on `wordpress:sync_customer`/
  `wordpress:sync_product`); Sync Jobs tab now shows a Counts column
  (`created/updated/failed`) sourced from `job.metadata`.

All built from `@visionprime/ui` (`PageHeader`, `DataTable`, `Tabs`,
`FormField`/`Input`, `StatusBadge`, `Badge`, `Button`, `Can`,
`LoadingState`/`ErrorState`, `Toast`) and `@visionprime/api-client` —
no page calls `fetch` directly.

## 6. Permissions Added

10 new permissions (`packages/permissions/src/index.ts`,
`/docs/permissions.md`): `customer:view`, `customer:create`,
`customer:update`, `customer:delete`, `customer:merge`,
`customer:note:create`, `customer:tag:update`, `product:view`,
`wordpress:sync_customer`, `wordpress:sync_product`. Seeded by the
migration and granted to the Super Admin role.

## 7. Audit Events Added

`audit_logs` rows are written for: `customer.create`, `customer.update`,
`customer.delete`, `customer.note.create`, `customer.tag.update`,
`customer.merge` (records both the merged-away and survivor customer
IDs). Sync runs are not individually audit-logged as a single event per
call (they are job/log records instead), but every per-item sync
failure writes a `wordpress_sync_logs` error row.

## 8. Tests Added

`apps/api/src/modules/customers/customers.controller.spec.ts` — 4 tests:
manual create; duplicate-by-email rejected with 409 (no duplicate row
created); merge preserves notes/tags/identities/events on the survivor
and soft-deletes the loser; `customer:create` denied (403) without the
permission.

`apps/api/src/modules/wordpress/wordpress-sync.controller.spec.ts` — 7
tests: existing customer matched and updated by email during sync (no
duplicate); existing customer matched and updated by mobile during sync
(no duplicate); product sync creates then idempotently updates the same
record on re-sync; a deliberately broken record doesn't abort the
customer sync job and all counts sum to the total; sync job `metadata`
stores the exact `{created, updated, failed, total}` counts with
`status: "succeeded"`; `wordpress:sync_customer` denied (403) without
the permission; `product:view` denied (403) without the permission.

All 9 `apps/api` suites / 37 tests pass (up from 7 suites / 26 tests in
Phase 04).

## 9. Demo Steps

```bash
cd visionprime-os
npm install

# 1. Configure environment (same vars as Phase 04)
cp .env.example .env

# 2. Apply the schema (runs 0001, 0002, then 0003)
npm run migrate --workspace=packages/database

# 3. Start the API and Admin app
npm run dev --workspace=apps/api
npm run dev --workspace=apps/admin
# sign in, then open http://localhost:3000/customers or /products
```

From the Admin UI: open **Customers**, click **New Customer** to create
one manually (trying to create a second customer with the same email
will be rejected with a 409). Open a customer to see the Customer 360
tabs and add notes/tags. Open **WordPress Sync → Manual Sync** and click
**Sync Customers** / **Sync Products** (against a real connected
WooCommerce site — this sandbox has no live WooCommerce store, so this
exercises the masked-error/zero-counts path). Check **Sync Jobs** to see
the resulting job and its created/updated/failed counts.

## 10. Verification Performed

- `npm run build --workspace=packages/database` — clean.
- `npm run build --workspace=packages/permissions` — clean.
- `npm run build --workspace=packages/shared` — clean.
- `npm run build --workspace=apps/api` — clean.
- `npm run test --workspace=apps/api` — 9 suites / 37 tests passing.
- `npm run build --workspace=apps/admin` — clean (`next build`, all
  routes compiled, including the new `/customers`, `/customers/new`,
  `/customers/[id]`, `/products`, `/products/[id]` routes and the
  extended `/wordpress-sync`).
- **No live Postgres or live WooCommerce site in this environment** —
  the migration's SQL and the sync engine's HTTP calls have not been
  exercised against real infrastructure; tests use the in-memory
  repository fakes and an injectable `WooCommerceApiClient` fake.
- **No browser-based UI verification was possible in this sandbox.**
  The new pages were verified via `next build` type-checking only, not
  by exercising them in a running browser — they should be manually
  smoke-tested in a real browser before considering the UI fully done.

## 11. Known Limitations / Explicitly Out of Scope

- No order sync — `wordpress_entity_mappings` only stores `customer`/
  `product` mappings this phase.
- No wallet, loyalty, or rewards logic.
- No organizations, brands, branches, or POS/cashier concepts.
- Raw WooCommerce/upstream errors are never surfaced to the UI — sync
  failures are masked into generic log messages, matching the Phase 04
  `testConnection` discipline.
- `customer_profiles` (free-form `attributes` jsonb) exists in the
  schema but has no API surface yet — reserved for a future phase.

## Confirmation

No organizations, brands, branches, multi-tenant constructs, order
sync, wallet, or loyalty/rewards logic were introduced anywhere in this
phase. Customer matching always follows the fixed
mobile → email → wordpress_user_id → woocommerce_customer_id priority
order. Every sync run is idempotent and per-item failures never abort
the job. Every customer/product/sync endpoint is permission-checked
server-side and sensitive customer mutations are audit-logged.
