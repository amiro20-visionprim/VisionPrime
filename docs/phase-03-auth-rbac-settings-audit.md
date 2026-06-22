# Phase 03 — Admin Authentication, RBAC, Business Settings & Audit/Security Logging

Status: **Complete**

## Scope

Builds admin authentication, users, roles, permissions, business
settings, and audit/security logging for VisionPrime OS v2.0. No
customers, orders, wallet, loyalty, rewards, WordPress sync, or other
plugin business logic was implemented. No organizations, brands,
branches, multi-tenant constructs, or POS/cashier concepts were
introduced anywhere.

## 1. Database Migrations

`packages/database/migrations/0001_auth_rbac_settings_audit.sql` —
single transactional migration, applied via the new
`packages/database/src/migrate.ts` runner (tracked in
`schema_migrations`). Creates:

- `users`, `roles`, `permissions`, `role_permissions`, `user_roles` —
  the core RBAC graph (UUID PKs, `snake_case`, soft-delete via
  `deleted_at` on `users`/`roles`).
- `sessions` — refresh-token sessions, storing only a SHA-256 hash of
  the opaque refresh token, `revoked_at`/`expires_at` for revocation.
- `business_settings` — a single-row singleton (`general`, `features`,
  `appearance` jsonb columns).
- `audit_logs`, `activity_logs`, `security_events` — append-only
  (no `updated_at`/`deleted_at`, no UPDATE/DELETE statement anywhere in
  the codebase touches them).
- Seed data: the 14 system permissions, the `Super Admin` system role
  (granted every permission), and a default `business_settings` row.

The first Super Admin **user** is never seeded by migration — it is
created only via the explicit, manual `npm run seed --workspace=packages/database`
script (`packages/database/src/run-seed.ts`), reading
`SEED_SUPER_ADMIN_EMAIL`/`SEED_SUPER_ADMIN_PASSWORD`/`SEED_SUPER_ADMIN_NAME`
from the environment. No credentials are ever hardcoded.

## 2. API Endpoints

All mounted under `/api/admin/*` in `apps/api/src/app.ts`.

| Method | Path | Permission |
|---|---|---|
| POST | `/auth/login` | none (public) |
| POST | `/auth/refresh` | none (public) |
| POST | `/auth/logout` | none (public; revokes the supplied session) |
| GET | `/auth/me` | authenticated only |
| GET | `/users` | `user:view` |
| POST | `/users` | `user:create` |
| GET | `/users/:id` | `user:view` |
| PATCH | `/users/:id` | `user:update` |
| DELETE | `/users/:id` | `user:delete` |
| GET | `/roles` | `role:view` |
| POST | `/roles` | `role:create` |
| GET | `/roles/:id` | `role:view` |
| PATCH | `/roles/:id` | `role:update` |
| DELETE | `/roles/:id` | `role:delete` |
| GET | `/permissions` | `permission:view` |
| GET | `/settings/business` | `settings:view` |
| PATCH | `/settings/business` | `settings:manage` |
| PATCH | `/settings/features` | `settings:manage` |
| PATCH | `/settings/appearance` | `settings:manage` |
| GET | `/audit-logs` | `audit:view` |
| GET | `/activity-logs` | `audit:view` |
| GET | `/security-events` | `security_event:view` |

Every protected route runs through `requireAuth` (verifies the access
JWT, populates `req.context.auth`) and then `requirePermission(key)`
(`apps/api/src/common/auth/auth-middleware.ts`), which checks the
caller's permission set via `hasPermission` from `@visionprime/permissions`.

## 3. UI Pages

All under `apps/admin/app/`, built from `@visionprime/ui` shared
components only — no page calls `fetch` directly, all go through the
extended `@visionprime/api-client`.

- `login/page.tsx` — real login form, client + server validation,
  redirects to the shell on success.
- `(shell)/layout.tsx` — auth-gated; redirects to `/login` if no valid
  session; shows a loading skeleton while resolving.
- `components/Topbar.tsx` — current user name, Super Admin badge, sign
  out.
- `components/Sidebar.tsx` — nav links for Users/Roles/Permissions/
  Settings/Audit Logs/Activity Logs/Security Events, each gated by `Can`
  with the real permission set from the authenticated session.
- `(shell)/users/page.tsx`, `users/new/page.tsx`, `users/[id]/page.tsx`,
  `users/UserForm.tsx` — paginated list, create/edit form (email,
  password on create, full name, active toggle, role multi-select),
  delete via `ConfirmDialog`.
- `(shell)/roles/page.tsx`, `roles/new/page.tsx`, `roles/[id]/page.tsx`,
  `roles/RoleForm.tsx` — list with system-role badge, create/edit form
  with a permission checklist sourced from `GET /permissions`, delete via
  `ConfirmDialog`.
- `(shell)/permissions/page.tsx` — read-only catalog display.
- `(shell)/settings/page.tsx` — tabbed Business Info / Features /
  Appearance forms, each bound to its own PATCH endpoint.
- `(shell)/audit-logs/page.tsx`, `activity-logs/page.tsx`,
  `security-events/page.tsx` — paginated, recency-ordered lists.

## 4. Permissions Added

The 14 system permissions listed in `/docs/permissions.md` §2, defined
once in `packages/permissions/src/index.ts` (`SYSTEM_PERMISSIONS`) and
seeded by the migration. See that document for the full convention,
critical-permission rules, and enforcement guarantees.

## 5. Audit Events Added

Audit logs (`audit_logs`, before/after snapshots) are written for:
user create/update/delete, role create/update/permissions-update/delete,
business settings update, login, logout.

Security events (`security_events`, with `severity`) are written for:
failed login attempts (never reveals whether the email exists).

A lighter `activity_logs` trail exists for broader activity alongside
the sensitive-action `audit_logs`. All three tables are append-only at
the repository level — only `insert`/`list` methods exist, with a test
(`audit.repository.spec.ts`) asserting this.

## 6. Security Rules Implemented

- Passwords hashed with `crypto.scryptSync` (`scrypt:<salt>:<hash>`,
  random 16-byte salt), verified with a timing-safe comparison.
- JWT access secret and refresh secret are required, non-defaulted
  environment variables (`packages/config/src/env-schema.ts`) — the app
  fails to start without them.
- Refresh tokens are opaque random strings; only their SHA-256 hash is
  persisted (`sessions.refresh_token_hash`); every refresh call rotates
  the session (old revoked, new issued).
- Failed login writes a `security_events` row.
- Logout revokes the matching session.
- A user cannot delete their own account (`CANNOT_DELETE_SELF`).
- A non-super-admin cannot delete a super admin (`CANNOT_DELETE_SUPER_ADMIN`).
- A user cannot strip their own critical permissions via a role edit
  (`CANNOT_REMOVE_CRITICAL_PERMISSION`).
- Permissions are system-defined and immutable via the API.
- Every rule above is enforced server-side in the relevant service
  layer — the UI mirrors the same checks only for UX, never as the
  actual control.

## 7. Tests Added

`apps/api` — 6 Jest suites, 21 tests, all using in-memory fake
repositories (see "Known Limitations" below):

- `auth.controller.spec.ts` — login success, login failure writes a
  security event, refresh rotates the session, logout revokes it.
- `users.controller.spec.ts` — full CRUD, self-delete guard,
  super-admin-delete guard, permission-denial envelope.
- `roles.controller.spec.ts` — permission assignment, system-role
  protection, critical-permission-removal guard.
- `business-settings.controller.spec.ts` — settings update writes an
  audit log.
- `audit.repository.spec.ts` — append-only guarantee (no update/delete
  method exists on the repository interface).
- `app.spec.ts` — existing Phase 01 smoke test, still passing against
  the now-larger app.

## 8. Demo Steps

```bash
cd visionprime-os
npm install

# 1. Configure environment
cp .env.example .env
# edit .env: set DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
# SEED_SUPER_ADMIN_EMAIL, SEED_SUPER_ADMIN_PASSWORD

# 2. Apply the schema
npm run migrate --workspace=packages/database

# 3. Create the first Super Admin user (manual, env-driven, never automatic)
npm run seed --workspace=packages/database

# 4. Start the API and Admin app
npm run dev --workspace=apps/api
npm run dev --workspace=apps/admin
# open http://localhost:3000/login, sign in with the seeded credentials
```

From the Admin UI you can then: create a user, assign a role, edit a
role's permissions, view the permission catalog, edit business settings,
and review the audit/activity/security-event trails.

## 9. Verification Performed

- `npm run build --workspace=packages/database` — clean.
- `npm run build --workspace=packages/permissions` — clean.
- `npm run build --workspace=apps/api` — clean; `npm run test --workspace=apps/api`
  — 6 suites / 21 tests passing.
- `npm run build --workspace=packages/api-client` — clean.
- `npm run build --workspace=apps/admin` — clean (`next build`, all 29
  routes compiled); manually curled every new route (`/login`,
  `/dashboard`, `/users`, `/users/new`, `/roles`, `/roles/new`,
  `/permissions`, `/settings`, `/audit-logs`, `/activity-logs`,
  `/security-events`) with no server-side exceptions.
- `npm run test --workspace=packages/config` — 4 tests passing against
  the now-required `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` schema.

## 10. Known Limitations / Explicitly Out of Scope

- **No live Postgres in this environment.** Every module's tests run
  against an in-memory fake implementing the same repository interface
  as the real `pg`-backed implementation, rather than a real database —
  a deliberate, documented choice, not a shortcut. The SQL in each
  `*.repository.db.ts` has not been exercised against a live database in
  this sandbox; it should be smoke-tested against a real Postgres
  instance before production use.
- **Access token claims can go stale.** The JWT access token embeds the
  user's permissions/`isSuperAdmin` at sign time (avoiding a DB hit per
  request) and is only re-derived on login/refresh/`/auth/me` — a
  permission or role change does not take effect for an already-issued
  access token until it expires (default 15 minutes) or is refreshed.
- **Editing a user's roles in the UI starts from an empty selection.**
  `GET /api/admin/users/:id` returns the public user profile but not
  their current `roleIds`; the edit form always sends a full
  `roleIds` replacement on save. A follow-up phase should either add
  `roleIds` to that response or expose a dedicated endpoint.
- **Business settings (`general`/`features`/`appearance`) are
  free-form JSON** (`z.record(z.unknown())`) at the API layer — there
  is no fixed business schema yet; the UI renders whatever keys exist.
- No customers, orders, wallet, loyalty, rewards, WordPress sync, or
  other plugin business logic was implemented — reserved for future
  phases.

## Confirmation

No organizations, brands, branches, multi-tenant constructs, or
POS/cashier concepts were introduced anywhere in this phase. All
sensitive actions are permission-checked server-side and audit-logged;
no raw database/internal errors are exposed; no secrets are hardcoded.
