# VisionPrime OS — Permissions (RBAC)

> Updated in Phase 03 to reflect the implemented system. The dot-separated
> `module.action` convention described in earlier drafts of this document
> was never implemented and is superseded by the colon-separated
> convention below, which is what the API actually enforces.

## 1. Permission Naming Convention

- Format: `resource:action`, lowercase, colon-separated:
  `user:view`, `user:create`, `user:update`, `user:delete`,
  `role:view`, `role:create`, `role:update`, `role:delete`,
  `permission:view`, `settings:view`, `settings:manage`,
  `audit:view`, `security_event:view`, `auth:login`.
- `resource` matches the functional resource (`user`, `role`,
  `permission`, `settings`, `audit`, `security_event`, `auth`).
- `action` is a verb: `view`, `create`, `update`, `delete`, `manage`,
  `login`.
- No business/brand/branch scoping segment in the permission key — this
  is a single-business system.
- The full catalog is defined once, in code, as `SYSTEM_PERMISSIONS` in
  `packages/permissions/src/index.ts` — it is the single source of truth.
  This document must stay in sync with that constant.

## 2. System Permission Catalog (Phase 03)

| Permission | Used by |
|---|---|
| `auth:login` | Documents the unauthenticated login entry point; no guard needed on the login route itself. |
| `user:view` | `GET /api/admin/users`, `GET /api/admin/users/:id` |
| `user:create` | `POST /api/admin/users` |
| `user:update` | `PATCH /api/admin/users/:id` |
| `user:delete` | `DELETE /api/admin/users/:id` |
| `role:view` | `GET /api/admin/roles`, `GET /api/admin/roles/:id` |
| `role:create` | `POST /api/admin/roles` |
| `role:update` | `PATCH /api/admin/roles/:id` |
| `role:delete` | `DELETE /api/admin/roles/:id` |
| `permission:view` | `GET /api/admin/permissions` |
| `settings:view` | `GET /api/admin/settings/business` |
| `settings:manage` | `PATCH /api/admin/settings/business`, `/features`, `/appearance` |
| `audit:view` | `GET /api/admin/audit-logs`, `GET /api/admin/activity-logs` |
| `security_event:view` | `GET /api/admin/security-events` |

Permissions are **system-defined**: they are seeded once via the
`0001_auth_rbac_settings_audit.sql` migration and are immutable through
the API — there is no create/update/delete endpoint for permissions
themselves, only the read-only `GET /api/admin/permissions` catalog.

## 3. Roles

- A **role** (`roles` table) is a named, mutable collection of
  permissions, assignable to admin users via `user_roles`.
- The seeded **Super Admin** role (`is_system = true`) is granted every
  permission and cannot be deleted or have its permissions changed
  (`CANNOT_MODIFY_SYSTEM_ROLE`). A user's `is_super_admin` flag also
  independently grants every permission regardless of role assignment —
  this is the one bootstrap-safe path that can never be locked out.
- Custom roles can be created/edited/deleted by anyone holding
  `role:create`/`role:update`/`role:delete`, but always compose from the
  same atomic `resource:action` permissions in `SYSTEM_PERMISSIONS` —
  never a parallel ad-hoc access system.
- A role cannot be deleted while still assigned to any user
  (`ROLE_IN_USE`).

### Critical permissions

`CRITICAL_PERMISSIONS` (`packages/permissions/src/index.ts`):
`user:update`, `role:update`, `permission:view`.

If a role update would strip any of these from a role the **acting**
user currently holds, and the acting user has no other role granting
that permission, and the acting user is not a super admin, the request
is rejected with `CANNOT_REMOVE_CRITICAL_PERMISSION`. This prevents an
admin from accidentally locking themselves out of user/role management.

## 4. Frontend Hiding Is Not Enough

Hiding a button, menu item, or page in the Admin OS UI based on the
current user's permissions (via the `Can` component, now wired to the
real authenticated session as of Phase 03) is a **UX convenience only**.
It is **never** a security control by itself.

## 5. Backend Must Enforce All Permissions

- Every `/api/admin/*` endpoint declares its required permission and
  enforces it server-side via the `requirePermission(key)` middleware
  (`apps/api/src/common/auth/auth-middleware.ts`), which checks the
  caller's JWT-derived permission set (`hasPermission` from
  `packages/permissions`) before the handler executes.
- An endpoint with no declared permission requirement is a bug, not a
  valid "public" endpoint, unless explicitly designed and reviewed as
  public (e.g. health check, login, refresh, logout).
- Permission checks cannot be bypassed by calling the API directly,
  crafting requests, or manipulating client state — the server is the
  single source of truth for authorization.
- Sensitive actions (user/role CRUD, permission assignment changes,
  business settings updates, login, logout) are both permission-checked
  **and** audit-logged; failed logins are recorded as security events.
  See `/docs/phase-03-auth-rbac-settings-audit.md`.
