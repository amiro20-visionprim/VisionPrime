# Phase 04 — WordPress/WooCommerce Connection Management

Status: **Complete**

## Scope

Builds secure connection management for the future WordPress/WooCommerce
integration: saving and testing credentials, base sync job/log storage,
and webhook registration status. No full customer/product/order sync,
no wallet/rewards/checkout logic, and no plugin customer dashboard were
implemented — all reserved for Phase 05/06. No organizations, brands,
branches, or POS/cashier concepts were introduced.

## 1. Database Migrations

`packages/database/migrations/0002_wordpress_connection.sql` — applied
via the same `runMigrations` runner as Phase 03. Creates:

- `wordpress_connections` — a single-row singleton (mirrors
  `business_settings`): site URL, encrypted consumer key/secret, encrypted
  shared secret, hashed plugin API key, connection status, last-test
  result, webhook registration status, free-form `settings` jsonb.
- `wordpress_sync_jobs` — mutable job records (`queued`/`running`/
  `succeeded`/`failed`), has `updated_at` since status changes over time.
- `wordpress_sync_logs` — append-only, per-job log lines.
- `wordpress_entity_mappings` — placeholder structure for the future
  WooCommerce-ID ↔ VisionPrime-ID mapping table (Phase 05/06).
- `wordpress_webhook_events` — append-only registration-attempt/event
  metadata (no live webhook payload processing this phase).
- Seeds the 7 new permissions and grants them to the Super Admin role;
  seeds a single empty/disconnected `wordpress_connections` row.

## 2. API Endpoints

All mounted under `/api/admin/integrations/wordpress/*` in
`apps/api/src/app.ts`.

| Method | Path | Permission |
|---|---|---|
| GET | `/status` | `wordpress:view` |
| POST | `/connect` | `wordpress:connect` |
| PATCH | `/settings` | `wordpress:update` |
| POST | `/test-connection` | `wordpress:test` |
| POST | `/webhooks/register` | `wordpress:webhook_register` |
| GET | `/sync/jobs` | `wordpress:sync_job:view` |
| GET | `/sync/logs` | `wordpress:sync_log:view` |

Every route runs through `requireAuth` + `requirePermission(key)`, same
as every other `/api/admin/*` route (`apps/api/src/modules/wordpress/wordpress.controller.ts`).

## 3. Admin UI

`apps/admin/app/(shell)/wordpress-sync/page.tsx` rebuilt with 8 tabs via
the shared `Tabs` component: **Connection**, **Settings**, Manual Sync
(disabled placeholder), **Sync Jobs**, **Sync Logs**, **Webhooks**,
Mappings (placeholder), Errors (placeholder). Only the bolded tabs are
functionally active this phase. Built entirely from `@visionprime/ui`
(`PageHeader`, `Tabs`, `DataTable`, `FormField`/`Input`, `StatusBadge`,
`Toast`, `EmptyState`, `ErrorState`, `LoadingState`) and
`@visionprime/api-client` — no page calls `fetch` directly. Secret input
fields are always password-masked and never pre-filled with a saved
value (only a "already saved" hint is shown); the API response never
includes the secret itself, so there is nothing to leak into the DOM.

## 4. Permissions Added

7 new permissions (`packages/permissions/src/index.ts`,
`/docs/permissions.md` §2): `wordpress:view`, `wordpress:connect`,
`wordpress:update`, `wordpress:test`, `wordpress:webhook_register`,
`wordpress:sync_job:view`, `wordpress:sync_log:view`. Seeded by the
migration and granted to the Super Admin role.

## 5. Audit Events Added

`audit_logs` rows are written for: `wordpress_connection.connect`,
`wordpress_connection.update`, `wordpress_connection.webhook_register`.
Audit payloads only ever record **whether** a secret field changed
(`{siteUrl: true, consumerKey: true, ...}`), never the value. A lighter
`activity_logs` entry (`wordpress_connection.test`) records connection
test attempts with only a `success` boolean.

## 6. Security Rules Implemented

- Consumer key, consumer secret, and the shared webhook secret are
  encrypted at rest with AES-256-GCM (`apps/api/src/common/crypto.ts`),
  keyed by the env-only `INTEGRATION_ENCRYPTION_KEY` (min 32 chars,
  `packages/config/src/env-schema.ts` — the app fails to start without
  it, same pattern as `JWT_ACCESS_SECRET`).
- The plugin API key is one-way hashed with the same scrypt format used
  for admin passwords (`hashPluginApiKey`, re-exported from
  `common/auth/password.ts`) — it is verified, never decrypted/displayed.
- The API never returns a secret value: `PublicWordPressConnection`
  (`wordpress.types.ts`) exposes only `hasConsumerKey`/`hasConsumerSecret`/
  `hasSharedSecret`/`hasPluginApiKey` booleans, never the underlying
  ciphertext or hash.
- `testConnection` and `registerWebhook` catch every upstream/network
  error and translate it into a generic, non-leaking message — the raw
  HTTP status, hostname-resolution error, or WooCommerce error body is
  never surfaced to the caller.
- Every connect/update/webhook-register call is permission-checked
  server-side (`requirePermission`) and writes an audit log.
- The UI never receives or displays a secret value.

## 7. Tests Added

`apps/api/src/modules/wordpress/wordpress.controller.spec.ts` — 5 tests,
using the in-memory fake repository pattern established in Phase 03:

- Saving a connection never returns the raw secrets in the response.
- Test connection against an unreachable site returns a generic masked
  error/status, never the raw network error.
- `wordpress:update` is denied (403 `PERMISSION_DENIED`) to a caller
  lacking the permission.
- Updating the connection writes an audit log attributable to the actor.
- `/sync/jobs` and `/sync/logs` both return the standard
  `{page, pageSize, totalItems, totalPages}` pagination meta.

All 7 `apps/api` suites / 26 tests pass (up from 6 suites / 21 tests in
Phase 03).

## 8. Demo Steps

```bash
cd visionprime-os
npm install

# 1. Configure environment (adds INTEGRATION_ENCRYPTION_KEY on top of Phase 03 vars)
cp .env.example .env

# 2. Apply the schema (runs 0001 then 0002)
npm run migrate --workspace=packages/database

# 3. Start the API and Admin app
npm run dev --workspace=apps/api
npm run dev --workspace=apps/admin
# sign in, then open http://localhost:3000/wordpress-sync
```

From the Admin UI: open the **Connection** tab, enter a WooCommerce site
URL + consumer key/secret (+ optional shared secret), save, then click
**Test Connection** (will fail safely against a non-real site in this
sandbox — that's the masked-error path being exercised). Visit
**Settings** to edit the site URL alone, **Webhooks** to attempt
registration once a shared secret is saved, and **Sync Jobs**/**Sync
Logs** to see the (currently empty) paginated lists.

## 9. Verification Performed

- `npm run build --workspace=packages/config` — clean; `npm run test
  --workspace=packages/config` — 4/4 passing against the
  `INTEGRATION_ENCRYPTION_KEY`-extended schema.
- `npm run build --workspace=packages/permissions` — clean.
- `npm run build --workspace=packages/shared` — clean.
- `npm run build --workspace=packages/database` — clean.
- `npm run build --workspace=apps/api` — clean; `npm run test
  --workspace=apps/api` — 7 suites / 26 tests passing.
- `npm run build --workspace=apps/admin` — clean (`next build`, all 29
  routes compiled, including the rebuilt `/wordpress-sync`).

## 10. Known Limitations / Explicitly Out of Scope

- **No live Postgres or live WooCommerce site in this environment.**
  The migration's SQL has not been exercised against a live database;
  `testConnection`/`registerWebhook` call a real WooCommerce REST
  endpoint over `fetch` but have only been exercised against
  unreachable hosts in tests (the masked-failure path) — they should be
  smoke-tested against a real WooCommerce store before production use.
- **No full sync.** `wordpress_sync_jobs`/`wordpress_sync_logs` exist as
  storage only; nothing currently creates a job or writes a log line —
  that lands with the sync engine in Phase 05/06.
- **`wordpress_entity_mappings` is unused this phase** — schema only,
  reserved for the future ID-mapping needs of full sync.
- **Webhook registration is a best-effort POST to a conventional plugin
  endpoint** (`/wp-json/visionprime/v1/webhooks/register`); the actual
  WordPress plugin side of this handshake does not exist yet and is out
  of scope for this phase — this phase only builds the admin-side
  registration attempt, status tracking, and event logging.
- No customers, orders, wallet, loyalty, rewards, or other plugin
  business logic was implemented.

## Confirmation

No organizations, brands, branches, multi-tenant constructs, or
POS/cashier concepts were introduced anywhere in this phase. No secrets
are ever returned by the API or rendered in the UI; every connection
change is permission-checked server-side and audit-logged; all upstream
WooCommerce errors are masked before reaching the client.
