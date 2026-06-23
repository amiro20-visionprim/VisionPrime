# VisionPrime OS — Definition of Done (DoD)

A feature/phase is not "done" until every applicable checklist below is
satisfied. Partial completion is not completion.

## General DoD

- [ ] Matches the architecture in `architecture.md` (no organizations,
      brands, branches, or multi-tenant concepts introduced).
- [ ] Follows `api-conventions.md` and `database-conventions.md`.
- [ ] Uses shared packages (`ui`, `api-client`, `validation`,
      `permissions`, `logger`, `audit`) — no parallel/duplicate
      implementations.
- [ ] No hardcoded secrets anywhere in the diff.
- [ ] Documentation updated (this repo's `docs/`) if behavior or
      conventions changed.
- [ ] Demo instructions provided (how to see the feature working).

## Backend DoD

- [ ] Database migrations included for any schema change.
- [ ] All endpoints validate input via shared `validation` schemas.
- [ ] All endpoints enforce permissions via shared `permissions` guards.
- [ ] All list endpoints are paginated per `api-conventions.md`.
- [ ] All responses use the standard success/error envelope.
- [ ] No raw database/internal errors are exposed to clients.
- [ ] Sensitive actions write to the audit log via `packages/audit`.
- [ ] Unit/integration tests cover success, validation failure,
      permission-denied, and not-found paths.

## Frontend DoD

- [ ] All data access goes through `packages/api-client` (no raw
      `fetch`/`axios` in page/component code).
- [ ] Uses shared `ui` components (`PageHeader`, `DataTable`, forms) —
      no bespoke per-page reimplementations.
- [ ] Loading, empty, and error states implemented for every data view.
- [ ] Forms use shared validation schemas matching the backend.
- [ ] Permission-gated UI elements hidden/disabled based on the current
      user's permissions (UX only — backend enforcement is mandatory
      regardless).

## WordPress Plugin DoD

- [ ] All actions are AJAX-based; no full page reloads triggered by
      plugin actions.
- [ ] Every AJAX handler verifies a WordPress nonce.
- [ ] Plugin secrets/API keys exist only in server-side PHP, never
      serialized to JS or markup.
- [ ] AJAX handlers call the VisionPrime API server-to-server, never
      directly from the browser.
- [ ] Friendly error messages shown on AJAX failure (no raw PHP errors).

## Financial Feature DoD

- [ ] Wallet/points balance is never directly mutated — only derived
      from an append-only ledger.
- [ ] All monetary values stored as integer minor units with explicit
      currency, per `database-conventions.md`.
- [ ] All financial calculations are recomputed/validated server-side
      (never trusting client-supplied totals/amounts).
- [ ] Every financial mutation is permission-checked and audit-logged.
- [ ] UI shows a confirmation step before executing the action and
      displays the resulting ledger entry on success.

## Sync Feature DoD

- [ ] Sync operations are idempotent (safe to re-run without
      duplication/corruption).
- [ ] Webhooks are signature-verified before processing.
- [ ] Webhook events are stored and deduplicated before being acted on.
- [ ] Sync failures are logged and retryable, never silently dropped.
- [ ] External-ID ↔ internal-ID mapping is explicit and persisted.

## Security DoD

- [ ] No secrets committed to source control.
- [ ] No raw database errors or stack traces returned to any client.
- [ ] All sensitive actions are permission-checked server-side and
      audit-logged.
- [ ] All external inputs (API requests, webhooks, plugin AJAX calls)
      are validated/verified before use.

## Testing DoD

- [ ] Automated tests exist for new backend logic (unit and/or
      integration as appropriate).
- [ ] Critical financial/ledger logic has explicit test coverage for
      edge cases (zero amounts, double-submits, concurrent writes where
      relevant).
- [ ] Manual demo steps are documented and have been verified to work.
