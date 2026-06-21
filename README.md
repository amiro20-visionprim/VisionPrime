# VisionPrime OS v2.0

VisionPrime OS is a **single-business customer operating system** for one
online store/business. It is not a multi-tenant SaaS product — there is
exactly one business context for the entire system.

It includes:

- Admin OS
- Customer Club
- WooCommerce native sync
- A fully AJAX-based WordPress plugin
- Customer 360
- Orders
- Wallet ledger
- Loyalty, Points, Rewards
- Segments
- Campaigns
- Automations
- Reports
- AI recommendations

## Architecture Rules (non-negotiable)

- No organizations, brands, or branches.
- No multi-tenant SaaS architecture.
- No branch managers, cashiers, POS sessions, or physical branch features.

See [`docs/architecture.md`](docs/architecture.md) for full details.

## Project Structure

```
visionprime-os/
  apps/
    api/                # Backend API
    admin/               # Admin OS
    club/                # Customer Club
    wordpress-plugin/    # AJAX-based WordPress/WooCommerce plugin
  packages/
    database/
    shared/
    config/
    ui/
    admin-crud/
    api-client/
    validation/
    permissions/
    logger/
    audit/
    jobs/
    integrations/
```

> Note: this repository currently also contains `vision-prime-suite/`, a
> pre-existing WordPress SEO/content plugin unrelated to VisionPrime OS.
> It is left untouched; the `visionprime-os/` structure above is scaffolded
> separately as phases proceed.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — product definition,
  apps/packages, module map, request lifecycle, security/sync/wallet/AJAX
  principles.
- [`docs/api-conventions.md`](docs/api-conventions.md) — request/response
  envelope, pagination, error codes, validation, auth/permissions.
- [`docs/database-conventions.md`](docs/database-conventions.md) — naming,
  IDs, timestamps, soft delete, append-only/ledger rules, money storage.
- [`docs/ui-ux-guidelines.md`](docs/ui-ux-guidelines.md) — Admin OS layout,
  shared components, financial UX, plugin AJAX UX.
- [`docs/permissions.md`](docs/permissions.md) — RBAC naming, permission
  matrix, roles, enforcement rules.
- [`docs/definition-of-done.md`](docs/definition-of-done.md) — per-area
  completion checklists.
- [`docs/development-workflow.md`](docs/development-workflow.md) — phase
  order, branching, review checklist, phase completion reporting.

## Phase Order

1. **Phase 00 — Governance** (current): docs, conventions, DoD, workflow.
2. Phase 01 — Foundation (packages skeletons, API bootstrap, auth).
3. Phase 02 — Customer 360.
4. Phase 03 — Orders.
5. Phase 04 — Wallet Ledger.
6. Phase 05 — Loyalty / Points / Rewards.
7. Phase 06 — Segments.
8. Phase 07 — Campaigns.
9. Phase 08 — Automations.
10. Phase 09 — Reports.
11. Phase 10 — AI Recommendations.
12. Phase 11 — WordPress Plugin Integration.

Phases are not skipped. See `docs/development-workflow.md` for the full
rules and how each phase's completion is reported.
