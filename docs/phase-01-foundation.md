# Phase 01 — Foundation

Status: **Complete**

## Scope

Establishes the monorepo skeleton, shared infrastructure, and the
minimum runnable surface (health/version endpoints, base layouts) for
every app and package described in `docs/architecture.md`. No business
modules (customers, orders, wallet, loyalty, rewards, campaigns,
WooCommerce sync) were implemented — that begins Phase 02.

## What Was Built

### Monorepo

- `visionprime-os/` created at the repo root with npm workspaces
  (`apps/*`, `packages/*`), a shared `tsconfig.base.json`, and a root
  `package.json` with `dev:api` / `dev:admin` / `dev:club` / `build` /
  `test` scripts.

### `apps/api`

- Express + TypeScript app (`src/app.ts`, `src/main.ts`).
- `packages/config`-driven environment loading and validation —
  the process refuses to start and exits non-zero if required env vars
  are missing/invalid (`EnvironmentValidationError`).
- `packages/logger`-based structured logger.
- Global error filter (`src/common/error-filter.ts`) — the only place
  that turns a thrown error into an HTTP response; never leaks raw
  internal errors.
- Standard response helper (`src/common/response.ts`) implementing the
  success/error envelope from `docs/api-conventions.md`.
- Request context middleware (`src/common/request-context.ts`) —
  attaches a `requestId` to every request; placeholder for auth/user
  context added in later phases.
- `GET /api/health` and `GET /api/version` endpoints.
- Standard 404 handling for unmatched routes, in the same error
  envelope shape.

### `apps/admin`

- Next.js (App Router) app.
- Base shell layout (`app/(shell)/layout.tsx`) composing placeholder
  `Sidebar` and `Topbar` components.
- Placeholder pages: `/login` (no real auth), `/dashboard`,
  `/design-system` (renders the shared `packages/ui` components —
  `PageHeader`, `DataTable` in loaded/empty states, `LoadingState`,
  `EmptyState`, `ErrorState`).

### `apps/club`

- Next.js (App Router) app, mobile-first layout (max-width shell).
- Placeholder home page. No real customer auth.

### `apps/wordpress-plugin/visionprime-connector`

- Base plugin file with standard WordPress plugin header only.
- No AJAX handlers, no WooCommerce sync, no wallet/reward/checkout
  logic. No secrets defined or exposed.

### Packages

All packages exist with valid, compiling TypeScript and a `build`
script:

| Package | Phase 01 content |
|---|---|
| `shared` | API envelope types, shared error codes |
| `config` | Zod env schema + `loadConfig()` with fail-fast validation |
| `logger` | Structured logger wrapper (`createLogger`) |
| `validation` | Shared `validate()` helper wrapping Zod |
| `permissions` | RBAC types + `hasPermission()` stub (no real permissions defined yet) |
| `database` | Placeholder connection description; no schema yet |
| `audit` | `AuditLogger` interface + no-op implementation |
| `jobs` | `JobQueue` interface + no-op implementation |
| `integrations` | Reserved package location only |
| `api-client` | `ApiClient` class — the only sanctioned way for `admin`/`club` to call `apps/api` |
| `ui` | `PageHeader`, `DataTable`, `LoadingState`, `EmptyState`, `ErrorState` |
| `admin-crud` | `defineCrudResource()` placeholder shape |

### Docker & Environment

- `docker-compose.yml` — PostgreSQL 16 and Redis 7 services.
- `.env.example` — base variables only (`NODE_ENV`, `PORT`,
  `API_BASE_URL`, `DATABASE_URL`, `REDIS_URL`, `LOG_LEVEL`,
  `NEXT_PUBLIC_API_BASE_URL`). No real secrets committed.

## Validation & Permissions (Phase 01 scope)

- Validation: `apps/api` validates configuration at startup via
  `packages/config`; per-endpoint request validation begins with the
  first real endpoints in Phase 02.
- Permissions: `packages/permissions` defines the shape only
  (`Permission`, `Role`, `hasPermission`). `/api/health` and
  `/api/version` are intentionally public/unauthenticated — the first
  permission-guarded endpoints arrive with Phase 02 modules.

## Audit Logs

- `packages/audit` provides the `AuditLogger` interface with a no-op
  implementation. No sensitive actions exist yet to audit — wired to
  real persistence once Phase 02's database schema exists.

## Tests

- `packages/config/src/load-config.spec.ts`:
  - returns a typed config when all required variables are present
  - throws `EnvironmentValidationError` when `DATABASE_URL` is missing
  - reports the specific missing/invalid keys in `details`
  - applies defaults for optional variables
- `apps/api/src/app.spec.ts`:
  - `GET /api/health` returns a standard success envelope
  - `GET /api/version` returns a standard success envelope
  - `GET /api/does-not-exist` returns a standard 404 error envelope

All suites pass (`npm run test --workspaces --if-present`).

## Manually Verified

- `apps/api` built (`tsc`) and run directly (`node dist/main.js`);
  `curl` against `/api/health`, `/api/version`, and an unknown route
  confirmed the exact envelope shapes.
- `apps/admin` production build (`next build`) succeeded; `next start`
  served `/`, `/login`, `/dashboard`, `/design-system` — all HTTP 200.
- `apps/club` production build succeeded; `next start` served `/` —
  HTTP 200.
- All workspace packages (`shared`, `config`, `logger`, `validation`,
  `permissions`, `database`, `audit`, `jobs`, `integrations`,
  `api-client`, `ui`, `admin-crud`) compile via `tsc`.

## Known Limitations / Explicitly Out of Scope

- No database schema, migrations, or real persistence anywhere.
- No real authentication in `apps/admin` or `apps/club`.
- No AJAX handlers in the WordPress plugin.
- No business modules: customers, orders, wallet, loyalty, points,
  rewards, segments, campaigns, automations, reports, AI
  recommendations.
- No WooCommerce sync or webhook handling.
- `packages/permissions` and `packages/audit` are interfaces/no-ops
  only — no real enforcement or persistence yet, since there is
  nothing sensitive to guard/audit at this phase.

## Confirmation

No organizations, brands, branches, multi-tenant constructs, branch
managers, cashiers, or POS features were introduced anywhere in this
phase.

## Demo Instructions

See "How to Run Locally" in the root `README.md`. Summary:

```bash
cd visionprime-os
cp .env.example .env   # edit DATABASE_URL/REDIS_URL if not using docker-compose
docker compose up -d   # postgres + redis
npm install
npm run dev:api         # http://localhost:4000/api/health, /api/version
npm run dev:admin       # http://localhost:3000
npm run dev:club        # http://localhost:3001
npm run test --workspaces --if-present
```
