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

## How to Run Locally (Phase 01)

```bash
cd visionprime-os
cp .env.example .env       # adjust DATABASE_URL/REDIS_URL if needed
docker compose up -d       # starts PostgreSQL + Redis
npm install

npm run dev:api             # http://localhost:4000/api/health, /api/version
npm run dev:admin            # http://localhost:3000  (Admin OS shell)
npm run dev:club             # http://localhost:3001  (Customer Club)

npm run test --workspaces --if-present
```

As of Phase 01, `apps/admin` and `apps/club` are placeholder shells with
no real auth, and `apps/wordpress-plugin/visionprime-connector` is a
bootstrap-only plugin file. See
[`docs/phase-01-foundation.md`](docs/phase-01-foundation.md) for the
full Phase 01 completion report.

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
- [`docs/phase-01-foundation.md`](docs/phase-01-foundation.md) — Phase 01
  completion report (monorepo skeleton, foundation infra, health/version
  endpoints, base layouts).

## Phase Order

1. Phase 00 — Governance: docs, conventions, DoD, workflow. ✅
2. **Phase 01 — Foundation** (current): monorepo skeleton, shared
   packages, API bootstrap (health/version), base app shells. ✅
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
