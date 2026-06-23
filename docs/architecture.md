# VisionPrime OS — Architecture

## 1. Product Definition

VisionPrime OS is a **single-business customer operating system** for one
online store/business. It unifies:

- Admin OS (internal operations console)
- Customer Club (customer-facing portal)
- WooCommerce native sync
- A fully AJAX-based WordPress plugin (storefront integration)
- Customer 360
- Orders
- Wallet ledger
- Loyalty, Points, Rewards
- Segments, Campaigns, Automations
- Reports
- AI recommendations

VisionPrime OS is **not** a SaaS product. It is built and operated for one
business only.

## 2. Single-Business Architecture

There is exactly one business context for the entire system. Every record
(customer, order, wallet, segment, campaign, etc.) belongs implicitly to
that one business. There is no concept of "which business does this row
belong to" anywhere in the schema, API, or UI.

### Explicitly Forbidden Concepts

The following must **never** be introduced, at any phase, for any reason:

- Organizations
- Brands
- Branches / branch managers / branch-scoped data
- Cashiers / POS sessions / physical point-of-sale features
- Multi-tenant SaaS architecture (tenant IDs, tenant isolation, per-tenant
  billing, per-tenant config, etc.)
- Any "workspace switcher" or "select your store" UX

If a future request implies one of the above, it must be flagged and
clarified with the user before implementation — never assumed.

## 3. Main Apps (`apps/`)

| App | Purpose |
|---|---|
| `api` | Backend API (NestJS-style modular service). Owns all business logic, persistence access, RBAC enforcement, audit logging. |
| `admin` | Admin OS — internal staff console (orders, customers, wallet, loyalty, campaigns, reports). |
| `club` | Customer Club — customer-facing portal (profile, wallet, points, rewards, orders). |
| `wordpress-plugin` | WordPress/WooCommerce plugin. Fully AJAX-based. Talks to `api` via authenticated server-to-server calls; never exposes secrets to the browser. |

## 4. Main Packages (`packages/`)

| Package | Purpose |
|---|---|
| `database` | Schema, migrations, ORM client, seed scripts. Single source of truth for data shape. |
| `shared` | Cross-cutting types, constants, enums, error codes used by both API and frontends. |
| `config` | Environment/config loading and validation (no secrets committed). |
| `ui` | Shared design-system React components (Admin OS + Customer Club). |
| `admin-crud` | Reusable CRUD scaffolding (list/detail/form patterns) for Admin OS modules. |
| `api-client` | The **only** sanctioned way for any UI to call the API. No raw `fetch` in pages. |
| `validation` | Shared schema validation (request DTOs, form validation) used on both client and server. |
| `permissions` | RBAC definitions, permission constants, guards/decorators. |
| `logger` | Structured logging used across apps/services. |
| `audit` | Audit log writer/reader for sensitive actions. |
| `jobs` | Background job/queue definitions (sync workers, scheduled tasks). |
| `integrations` | Third-party integrations (WooCommerce REST, webhooks, AI providers). |

## 5. Module Map

```
Customer 360 ──┬─ Orders
               ├─ Wallet (ledger)
               ├─ Loyalty / Points / Rewards
               └─ Segments (computed from customer + order + wallet data)

Campaigns ── targets ── Segments
Automations ── triggers on ── Orders / Wallet / Loyalty events
Reports ── reads (read-only) ── Orders / Wallet / Loyalty / Campaigns
AI Recommendations ── reads (read-only) ── Customer 360 / Orders

WooCommerce Sync ── idempotent upsert ── Customers / Orders / Products
WordPress Plugin (AJAX) ── server-to-server ── API
```

No module mutates another module's data directly. Cross-module effects
happen through services in `api`, never through direct table writes from
another module.

## 6. Request Lifecycle

1. **Client** (Admin OS, Customer Club, or WordPress plugin AJAX handler)
   calls the shared `api-client`.
2. **API Gateway layer** authenticates the request (session/JWT for
   Admin/Club; verified nonce + server secret for the WordPress plugin).
3. **RBAC guard** checks the caller's permissions for the requested action.
4. **Validation layer** (`packages/validation`) validates input against a
   shared schema before any business logic runs.
5. **Service layer** executes business logic, using the `database` package
   for persistence. Sensitive actions write to the **audit log**.
6. **Response** is shaped into the standard success/error envelope (see
   `api-conventions.md`) and returned.
7. **Sync/async side effects** (e.g. WooCommerce sync, notifications) are
   dispatched via `packages/jobs`, never performed inline in the request
   path when they are slow or external.

## 7. Security Principles

- RBAC is enforced **server-side only**. Hiding a button in the UI is never
  sufficient (see `permissions.md`).
- All sensitive actions (wallet adjustments, points changes, permission
  changes, refunds, manual order edits) are written to an **immutable audit
  log**.
- No raw database errors are ever returned to a client.
- No secrets are hardcoded in source. All secrets come from environment
  configuration (`packages/config`).
- The WordPress plugin secret (API key) lives only in PHP server-side code
  and is **never** sent to the browser/JS.
- All inbound webhooks are signature-verified before being trusted.

## 8. Sync Principles (WooCommerce)

- All sync operations (customers, orders, products) are **idempotent** —
  re-running a sync for the same external entity must not create
  duplicates or corrupt state.
- Sync uses a stable external-ID mapping (WooCommerce ID ↔ VisionPrime ID)
  stored in `database`.
- Webhooks are verified (signature), stored (raw payload + dedupe key),
  and deduplicated before processing.
- Sync failures are logged and retryable; they never silently drop data.

## 9. Wallet Ledger Principles

- The wallet balance is **never mutated directly**. It is always a
  **derived value** computed from an append-only ledger of transactions.
- Every wallet change is a new ledger row (credit/debit), never an update
  to an existing row.
- Ledger rows are immutable once written (no UPDATE/DELETE in normal
  operation).
- Points follow the same ledger principle as wallet currency.

## 10. WordPress Plugin AJAX Principles

- The plugin is **fully AJAX-based**: all plugin actions happen via
  `wp_ajax_*` handlers, with no full page reloads.
- Every AJAX handler verifies a WordPress **nonce** before executing.
- Plugin secrets (API keys) are stored server-side (PHP) and never
  serialized into JavaScript or page markup.
- AJAX handlers call the VisionPrime `api` over a server-to-server
  connection authenticated with the plugin secret.
