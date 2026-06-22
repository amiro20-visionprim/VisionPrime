# VisionPrime OS — UI/UX Guidelines

## 0. Shared Component Library (`packages/ui`)

Every Admin OS (and Customer Club) screen is built exclusively from this
shared library — no module defines its own button, table, modal, or form
control styling.

- **Design tokens** (`tokens.ts`): `colors`, `statusColors`, `spacing`,
  `radius`, `typography`, `shadows`, `breakpoints`.
- **Actions**: `Button`, `IconButton`.
- **Form primitives** (`form/`): `Input`, `Textarea`, `Select`,
  `MultiSelect`, `Switch`, `Checkbox`, `Radio`, `FormField`.
- **Display**: `Badge`, `StatusBadge`, `Card`, `MetricCard`, `Skeleton`.
- **States**: `LoadingState`, `EmptyState`, `ErrorState`.
- **Navigation/structure**: `PageHeader`, `Tabs`, `DataTable`,
  `Pagination`, `FilterBar`.
- **Overlays**: `Modal`, `ConfirmDialog`, `Drawer`, `Tooltip`,
  `DropdownMenu`, `ToastProvider`/`useToast`.
- **Permissions**: `Can` — placeholder UI gate that hides actions based
  on a permission string (`userPermissions` prop); real auth-backed
  enforcement lands in Phase 03 per `docs/permissions.md`.

All of the above are exported from `@visionprime/ui`'s root entry point.
The `/design-system` page in `apps/admin` renders every component live
for visual verification.

## 1. Admin OS UX Principles

- Admin OS is an internal operations tool: optimize for speed and clarity
  over decoration.
- Every screen answers: "what am I looking at, what can I do, what
  happened." (context, actions, feedback)
- Destructive or financial actions always require explicit confirmation.
- No raw API/network errors are ever shown to the admin user; always a
  friendly, actionable message derived from the standard error envelope.

## 2. Layout Rules

- Consistent shell: sidebar navigation + top bar + content area, shared
  across all Admin OS modules via `packages/ui`.
- Content area uses a consistent max-width and spacing scale — no
  per-page bespoke layout primitives.
- Every page is composed from shared `packages/ui` components; no
  one-off layout components per module.

## 3. PageHeader Rules

- Every Admin OS page starts with a `PageHeader` containing:
  - Title
  - Optional description/subtitle
  - Primary action(s) (e.g. "New Campaign") right-aligned
  - Breadcrumb when nested more than one level deep
- `PageHeader` is a single shared component from `packages/ui`; pages
  never hand-roll their own header markup.

## 4. DataTable Rules

- All list views use the shared `DataTable` component from `packages/ui`.
- `DataTable` always supports: pagination (matching API pagination
  format), sorting, loading state, empty state, and error state.
- Row actions are consistent (icon button menu) across modules.
- No table fetches data directly — it receives data via the shared
  `api-client`, never a raw `fetch` call in page code.

## 5. Form Rules

- All forms use shared form components + the shared `validation` schemas
  (same schema used by the API).
- Inline field-level errors map directly to `error.details` from the API
  validation response — no re-deriving error text on the client.
- Submit buttons show a loading state and are disabled during submission
  to prevent double-submits (critical for financial actions).

## 6. Financial UX Rules

- Money is always displayed formatted with currency symbol and correct
  decimal places, derived from integer minor-unit values — never display
  raw integer cents.
- Any action that moves wallet/points balance (credit, debit, award,
  redeem) requires a confirmation step showing: customer, amount,
  direction (credit/debit), and reason.
- After a financial action succeeds, the UI shows the resulting ledger
  entry, not just a generic success toast.
- Financial list views (ledger, transactions) are read-only displays of
  ledger history — there is no "edit" action on a ledger row, only "add a
  new entry."

## 7. Loading / Empty / Error State Rules

- Every data-driven view defines all three states explicitly:
  - **Loading**: skeleton or spinner, never a blank screen.
  - **Empty**: a clear message + relevant primary action (e.g. "No
    campaigns yet — Create one").
  - **Error**: human-readable message (from the standard error envelope)
    + retry action where applicable. Never show raw error objects.
- These three states are implemented once in shared `packages/ui`
  components and reused, not re-implemented per page.

## 8. WordPress Plugin AJAX UX Rules

- All plugin admin/storefront actions happen without a full page reload.
- Every AJAX action shows: a loading indicator on the triggering element,
  a success indication, and a friendly error message on failure.
- Forms in the plugin are progressively enhanced — they still degrade
  sensibly, but the primary path is AJAX.
- Nonces are refreshed/handled transparently to the user; a stale nonce
  produces a friendly "please refresh and try again" message, never a
  raw PHP/WordPress error.

## 9. Checkout UX Rules

- Wallet/points redemption at checkout is always shown with a clear
  before/after total.
- Any balance shown at checkout is fetched live (via the plugin's
  server-to-server call to the API) at the time of checkout — never
  cached/stale client-side state used for the final calculated amount.
- Checkout never lets the client supply the final discount/redemption
  amount — the server always recomputes and validates it.
