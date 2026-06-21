# VisionPrime OS — Development Workflow

## 1. Phase Order

Development proceeds strictly in phases. Each phase builds on the
previous one and must be completed (per `definition-of-done.md`) before
the next phase begins.

- **Phase 00 — Governance** ✅: architecture, conventions,
  permissions model, Definition of Done, workflow rules. No feature code.
- **Phase 01 — Foundation** ✅: monorepo skeleton (`apps/*`,
  `packages/*`); `shared`, `config`, `logger`, `validation`,
  `permissions`, `database`, `audit`, `jobs`, `integrations`,
  `api-client`, `ui`, `admin-crud` package skeletons; `apps/api`
  bootstrap (config loading, env validation, logger, global error
  filter, response helper, request context, `/api/health`,
  `/api/version`); `apps/admin`/`apps/club` base layouts and
  placeholder pages (no real auth yet); `apps/wordpress-plugin`
  bootstrap file; docker-compose (Postgres + Redis). See
  `docs/phase-01-foundation.md`.
- **Phase 02 — Customer 360**: customer entity, profile views, basic
  CRUD.
- **Phase 03 — Orders**: order entity, WooCommerce order sync
  (read path).
- **Phase 04 — Wallet Ledger**: append-only wallet ledger, balance
  derivation, admin credit/debit UI.
- **Phase 05 — Loyalty / Points / Rewards**: points ledger, reward
  catalog, redemption flow.
- **Phase 06 — Segments**: segment definitions and evaluation against
  Customer 360/Orders/Wallet/Loyalty data.
- **Phase 07 — Campaigns**: campaign creation targeting segments.
- **Phase 08 — Automations**: event-triggered workflows.
- **Phase 09 — Reports**: read-only reporting across modules.
- **Phase 10 — AI Recommendations**: recommendation services.
- **Phase 11 — WordPress Plugin Integration**: AJAX plugin actions,
  webhook handling, storefront wallet/points UX.

Later phases may be reordered or split with explicit user agreement, but
the **no-skipping rule** below always applies.

## 2. Branching Rules

- Each unit of work happens on a dedicated feature branch named for the
  phase/feature (e.g. `claude/phase-01-foundation`).
- Never push directly to `main`/`master` without explicit instruction.
- Commits are scoped and descriptive; avoid bundling unrelated changes
  from different phases in one commit.
- Do not force-push or rewrite shared history without explicit
  permission.

## 3. Code Review Checklist

- [ ] Matches the relevant phase scope — no unrequested future-phase
      features included.
- [ ] Passes the applicable sections of `definition-of-done.md`.
- [ ] No forbidden concepts introduced (organizations, brands, branches,
      multi-tenant, POS/cashier features).
- [ ] Shared packages used instead of duplicated logic.
- [ ] Standard API response envelope used consistently.
- [ ] No secrets, no raw error leakage, no direct UI `fetch` calls.
- [ ] Tests included and passing.
- [ ] Docs updated if conventions/behavior changed.

## 4. Testing Expectations

- New backend logic ships with tests (unit and/or integration).
- Financial/ledger logic includes edge-case tests (see
  `definition-of-done.md`).
- UI changes are manually verified against the golden path and key edge
  cases (loading/empty/error) before being reported complete.
- Test commands and expected results are documented in the phase's demo
  instructions.

## 5. How to Report Phase Completion

When a phase is complete, report:

1. **Scope** — what was built, mapped to the phase definition.
2. **Files changed/created** — list of key files, grouped by
   apps/packages.
3. **Definition of Done** — explicit checklist from
   `definition-of-done.md` with each applicable item marked done.
4. **Demo instructions** — concrete steps to run/see the feature working.
5. **Explicitly confirm**: no forbidden concepts (organizations, brands,
   branches, multi-tenant, POS) were introduced.
6. **What is intentionally out of scope** for this phase (deferred to a
   later phase).

## 6. No Skipping Phases

- A phase may not begin until the previous phase has been reported
  complete per the checklist above.
- If a request seems to require functionality from a later phase (e.g.
  campaigns work asking for wallet logic before Phase 04 exists), this
  must be flagged to the user rather than silently building it early.
- Exception: trivial, clearly-scoped bug fixes to already-completed
  phases do not require a new "phase" — they are patches, not new
  phases.
