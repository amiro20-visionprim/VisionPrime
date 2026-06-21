# VisionPrime OS — Permissions (RBAC)

## 1. Permission Naming Convention

- Format: `module.action`, lowercase, dot-separated:
  `customers.view`, `customers.edit`, `wallet.credit`, `wallet.debit`,
  `loyalty.points.award`, `campaigns.publish`, `reports.view`,
  `settings.manage`, `permissions.manage`.
- `module` matches the functional module (customers, orders, wallet,
  loyalty, segments, campaigns, automations, reports, settings,
  permissions).
- `action` is a verb: `view`, `create`, `edit`, `delete`, `credit`,
  `debit`, `award`, `redeem`, `publish`, `manage`.
- No business/brand/branch scoping segment in the permission key — this
  is a single-business system.

## 2. Initial Permission Matrix

| Permission | Owner | Manager | Support | Viewer |
|---|---|---|---|---|
| `customers.view` | ✅ | ✅ | ✅ | ✅ |
| `customers.edit` | ✅ | ✅ | ✅ | ❌ |
| `orders.view` | ✅ | ✅ | ✅ | ✅ |
| `orders.edit` | ✅ | ✅ | ❌ | ❌ |
| `wallet.view` | ✅ | ✅ | ✅ | ✅ |
| `wallet.credit` | ✅ | ✅ | ❌ | ❌ |
| `wallet.debit` | ✅ | ✅ | ❌ | ❌ |
| `loyalty.points.award` | ✅ | ✅ | ❌ | ❌ |
| `segments.manage` | ✅ | ✅ | ❌ | ❌ |
| `campaigns.manage` | ✅ | ✅ | ❌ | ❌ |
| `campaigns.publish` | ✅ | ✅ | ❌ | ❌ |
| `automations.manage` | ✅ | ✅ | ❌ | ❌ |
| `reports.view` | ✅ | ✅ | ✅ | ✅ |
| `settings.manage` | ✅ | ❌ | ❌ | ❌ |
| `permissions.manage` | ✅ | ❌ | ❌ | ❌ |
| `audit.view` | ✅ | ✅ | ❌ | ❌ |

This matrix is a starting point; later phases extend it per module but
must follow the same naming convention.

## 3. Admin Permission Groups (Roles)

- **Owner** — full access, including permission management and settings.
- **Manager** — full operational access (customers, orders, wallet,
  loyalty, campaigns) excluding system settings and permission
  management.
- **Support** — view + limited edit on customers/orders; no financial or
  campaign write access.
- **Viewer** — read-only across all modules.

Roles are collections of permissions, stored in `packages/permissions`,
and assignable to admin users. Custom roles may be introduced in later
phases but must compose from the same atomic `module.action` permissions
— never as a parallel ad-hoc access system.

## 4. Frontend Hiding Is Not Enough

Hiding a button, menu item, or page in the Admin OS/Customer Club UI based
on the current user's permissions is a **UX convenience only**. It is
**never** a security control by itself.

## 5. Backend Must Enforce All Permissions

- Every API endpoint declares its required permission(s) and enforces
  them via a server-side guard before the handler executes.
- An endpoint with no declared permission requirement is a bug, not a
  valid "public" endpoint, unless explicitly designed and reviewed as
  public (e.g. health check).
- Permission checks cannot be bypassed by calling the API directly,
  crafting requests, or manipulating client state — the server is the
  single source of truth for authorization.
- Sensitive actions are both permission-checked **and** audit-logged (see
  `definition-of-done.md`).
