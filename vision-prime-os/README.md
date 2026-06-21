# VisionPrime OS

WordPress plugin implementing the VisionPrime OS multi-tenant Brand Customer
Operating System. Independent of, and unrelated to, the VisionPrime Suite
(SEO/content) plugin in this repo.

## Architecture

- **Tenancy**: WordPress Multisite. Each site (`blog_id`) **is** a Brand —
  data isolation between brands is physical (separate `$wpdb->prefix`
  tables per site), not a `WHERE brand_id = ?` filter. `Organization` is a
  network-level concept (tables in `$wpdb->base_prefix`, main site only).
  `Branch` is a per-site table scoped with `branch_id`.
- **Request context**: `VPOS_Context::resolve()` is the WordPress
  equivalent of the spec's `resolveRequestContext()` — current site =
  active brand, plus the user's branch scope and permissions.
- **Base layer** (`includes/core/`), used by every feature module so each
  module stays thin:
  - `VPOS_Migrator` — declarative table registration + `dbDelta`, network vs. site scope.
  - `VPOS_Repository` — CRUD, pagination, soft-delete, branch-scoping.
  - `VPOS_REST_Controller` — route base, permission gate, validation, standard responses.
  - `VPOS_RBAC` — action-based permissions (`resource:action`), WP roles as permission bags.
  - `VPOS_Audit` — append-only audit log.
  - `VPOS_Ledger` (trait) — append-only financial/points ledgers; balances are always derived, never stored as an editable field.
  - `VPOS_Jobs` — Action Scheduler wrapper (WP-Cron fallback) for background work.
- **Customer Club**: server-rendered WordPress front end (shortcodes/templates),
  not a separate SPA.

## Phases

| Phase | Scope |
|---|---|
| P0 (this commit) | Plugin skeleton, base layer, RBAC roles, audit log, admin shell |
| P1 | Organization/Brand/Branch, brand_settings, full role/permission set |
| P2 | Customer Data Platform, Customer 360, Order Engine |
| P3 | Wallet Ledger Engine |
| P4 | Loyalty, Rewards, Customer Club |
| P5 | Segments, Campaigns, Notifications |
| P6 | Automation Engine |
| P7 | Integrations, Reports, AI Intelligence Layer |

Standing rules (non-negotiable across all phases): no direct wallet balance
mutation, no cross-brand data access, soft delete for business-critical
records, audit log for sensitive actions, AI never executes financial
actions automatically, every list endpoint paginated.
