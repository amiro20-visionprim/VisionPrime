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
- **Operator training**: `modules/help/` adds a **VisionPrime OS → آموزش و
  راهنما** submenu — a graphical, Persian-language catalog explaining what
  every other submenu does and how an operator is meant to use it. It is
  pure presentation (no table, no REST route), grouped by onboarding order
  (tenant → customer/order → wallet/loyalty → outreach → automation/
  integrations → reports/AI), and each card names the permission required
  to act on it.

## Phases

| Phase | Scope |
|---|---|
| P0 (done) | Plugin skeleton, base layer, RBAC roles, audit log, admin shell |
| P1 (done) | Organization/Brand/Branch, brand_settings, REST API, admin UI, tests |
| P2 (done) | Customer Data Platform, Customer 360, Order Engine |
| P3 (done) | Wallet Ledger Engine |
| P4 (done) | Loyalty, Rewards, Customer Club |
| P5 (done) | Segments, Campaigns, Notifications |
| P6 (done) | Automation Engine |
| P7 (this commit, final) | Integrations, Reports, AI Intelligence Layer |

Standing rules (non-negotiable across all phases): no direct wallet balance
mutation, no cross-brand data access, soft delete for business-critical
records, audit log for sensitive actions, AI never executes financial
actions automatically, every list endpoint paginated.

## Phase 1 notes

- Creating a Brand provisions a new Multisite site (`wpmu_create_blog`),
  runs the schema on it, and creates its default `brand_settings` row —
  all in one call (`VPOS_Brand_Repository::create_brand`).
- Without Multisite enabled, exactly one brand can exist, bound to the
  current site (development/single-brand fallback).
- REST API: `wp-json/visionprime/v1/admin/{organizations,brands,branches}`
  per Master Spec §11. Branch/Settings endpoints accept a brand id and
  internally `switch_to_blog()` to that brand's site; non-super-admins are
  rejected unless the brand id matches their own site.
- wp-admin UI lives under **VisionPrime OS → Organizations / Brands /
  Brand Settings / Branches** (Organizations and Brands management is
  network-oversight, shown on the main site only; Brand Settings and
  Branches are managed from each brand's own site).
- Tests: `tests/tenant-test.php` (run with `phpunit`, requires the WP
  Multisite test suite — see `tests/bootstrap.php`).

## Phase 2 notes

- Customer Data Platform lives in `modules/customer/`: one repository
  class (`VPOS_Customer_Repository`) owns the customer table plus its
  tightly-related sub-entities (notes, tags, events, merge logs) rather
  than four separate repository classes — duplicate detection is a unique
  key on `primary_mobile`, and because customer tables are per-site
  (per-brand), that uniqueness is automatically brand-scoped.
- Order Engine (`VPOS_Order_Repository`) is branch-scoped and owns its
  line items. Completing/cancelling an order updates the customer's
  rollup metrics (`purchase_count`, `total_spent`, `average_order_value`,
  `lifetime_value`) and fires `vpos_order_completed` / `vpos_order_cancelled`
  hooks so Phase 3 (Wallet) and Phase 4 (Loyalty) can react without this
  module knowing about them.
- Customer 360 (`GET /customers/{id}/360`) aggregates profile, tags,
  notes, events and recent orders into one read-only response, filterable
  via `vpos_customer_360` so later phases can append their own sections
  (wallet balance, loyalty tier, active rewards) without editing this
  controller.
- REST API: `wp-json/visionprime/v1/{customers,orders}` per Master Spec
  §12-14. wp-admin UI lives under **VisionPrime OS → Customers / Customer
  360 / Orders / Order**.
- Tests: `tests/customer-test.php` — duplicate mobile detection, brand-
  scoped duplicate detection (multisite-gated), merge log + metric
  summing, order requires existing customer, completed order updates
  customer metrics, cancelling a completed order reverses those metrics,
  Customer 360 aggregation.

## Phase 3 notes

- Wallet Ledger Engine (`modules/wallet/`) uses the shared `VPOS_Ledger`
  trait so `VPOS_Wallet_Repository` only adds wallet-specific rules on
  top: no overdraft (`debit()` rejects if it would exceed the confirmed
  balance), wallet-enabled gate (reads `brand_settings.wallet_enabled`),
  and reversal entries can't themselves be reversed.
- Order → Wallet integration is hook-based, not a direct dependency:
  `VPOS_Wallet_Module` listens to `vpos_order_completed` (applies
  cashback, rate from `brand_settings.settings.cashback_rate`, 0 =
  disabled) and `vpos_order_cancelled` (reverses any cashback tied to
  that order_id) — `VPOS_Order_Repository` never references Wallet.
- Customer 360 gained a `wallet` section (`balance`, `recent_entries`)
  via the same `vpos_customer_360` filter Phase 2 exposed for this.
- REST: `GET /customers/{id}/wallet`, `POST .../wallet/{credit,debit}`,
  `POST /wallet/entries/{id}/reverse`. wp-admin: **VisionPrime OS →
  Wallet** (lookup by customer id), linked from each customer's 360 page.
- Tests: `tests/wallet-test.php` — credit increases balance, debit can't
  exceed balance, reversal writes an opposite entry instead of mutating,
  a reversal can't itself be reversed, disabled wallet blocks credit,
  order cashback is applied on completion and reversed on cancellation.

## Phase 4 notes

- Loyalty Ledger (`modules/loyalty/class-vpos-loyalty-repository.php`) is
  built on the same `VPOS_Ledger` trait as Wallet, plus a `vpos_loyalty_tiers`
  table. `lifetime_points()` sums credit-direction confirmed entries only,
  so spending points never demotes a customer's tier — `current_tier()` is
  derived from lifetime points, not spendable balance.
- Reward catalog + redemption (`modules/reward/class-vpos-reward-repository.php`)
  is a separate, smaller repository: `redeem()` debits points via
  `VPOS_Loyalty_Repository::spend()` first and bails on `WP_Error` before
  ever touching stock or writing a redemption record, so an insufficient-
  points failure can't leave a dangling redemption or decremented stock.
- Order → Loyalty integration mirrors the Wallet pattern: `VPOS_Loyalty_Module`
  listens to `vpos_order_completed` (awards points from
  `brand_settings.settings.points_rate`, scaled by the customer's current
  tier multiplier) and `vpos_order_cancelled` (reverses any points tied to
  that order_id) — `VPOS_Order_Repository` stays unaware of Loyalty.
- Customer 360 gained `loyalty` (balance, tier) and `rewards` (recent
  redemptions) sections via the same `vpos_customer_360` filter.
- Customer Club is server-rendered WordPress front end, not an SPA:
  `[vpos_club_login]` and `[vpos_club_dashboard]` shortcodes, with OTP-based
  pseudo-session login (`VPOS_Club_Session`) for end customers who aren't WP
  users — a signed cookie (`wp_hash()` HMAC over customer id + expiry)
  stands in for `wp_set_auth_cookie()`. OTP delivery itself is a hook point
  only (`vpos_club_otp_generated`) — actual SMS sending is deferred to the
  Phase 7 integrations layer, and the code is never echoed into the page.
- REST: `GET /customers/{id}/loyalty`, `POST .../loyalty/earn`,
  `GET|POST /loyalty/tiers`, `GET|POST /rewards`, `PATCH /rewards/{id}`,
  `POST /customers/{id}/rewards/redeem`, `POST /loyalty/entries/{id}/reverse`.
  wp-admin: **VisionPrime OS → Loyalty Tiers / Rewards / Redeem Reward**.
- Tests: `tests/loyalty-test.php` — earning increases balance and lifetime
  points, spending can't exceed balance, spending doesn't demote tier
  eligibility, redeeming a reward debits points and decrements stock,
  redemption fails when points are insufficient, out-of-stock rewards are
  rejected, completed-order points are reversed on cancellation, Customer
  Club OTP login creates a customer + session, wrong OTP code is rejected.

## Phase 5 notes

- Segments (`modules/campaign/class-vpos-segment-repository.php`) are a
  saved rule set evaluated live against `vpos_customers` on every read —
  there is no materialized membership table, so a segment's matches are
  always current, never stale snapshots. Supported rule keys: `status`,
  `tags[]`, `min_purchase_count`, `min_total_spent`, `min_lifetime_value`,
  `created_after`/`created_before`.
- Campaigns (`class-vpos-campaign-repository.php`) target a segment (or
  all customers when none is set) and, on send, queue one Notification per
  matching customer — `send_now()` never delivers anything itself.
  `schedule()` hands off to `VPOS_Jobs::enqueue_at()`, and the module's
  `vpos_job_send_campaign` handler is what actually fires `send_now()` at
  the scheduled time.
- Notifications (`class-vpos-notification-repository.php`) are a generic
  per-customer message log shared by Campaigns now and Automation later —
  `queue()` only records intent and fires `vpos_notification_dispatch` for
  the real SMS/email/push gateway (Phase 7 integrations layer) to consume;
  `mark_read()` is scoped to the owning customer_id so one customer can't
  mark another's notification read.
- Customer 360 gained a `notifications` section (`unread_count`, `recent`)
  via the same `vpos_customer_360` filter as every prior phase.
- REST: `GET|POST /segments`, `GET|PATCH /segments/{id}`,
  `GET /segments/{id}/customers`, `GET|POST /campaigns`,
  `GET|PATCH /campaigns/{id}`, `POST /campaigns/{id}/{schedule,send,cancel}`,
  `GET /campaigns/{id}/sends`, `GET /customers/{id}/notifications`,
  `POST /notifications/{id}/read`. wp-admin: **VisionPrime OS → Segments /
  Segment / Campaigns / Campaign**.
- Tests: `tests/campaign-test.php` — segment resolves customers by spend
  rule, segment resolves customers by tag, sending a campaign queues one
  notification per segment match, an already-sent campaign can't be sent
  again, a cancelled campaign can't be sent, scheduling enqueues a
  background job, marking a notification read is scoped to its owning
  customer, Customer 360 includes the notifications section.

## Phase 6 notes

- The Automation Engine (`modules/automation/class-vpos-automation-repository.php`)
  is "when X happens and conditions match, do Y": triggers are the domain
  events the plugin already fires (`vpos_customer_created` — newly added
  this phase — `vpos_order_completed`, `vpos_order_cancelled`); conditions
  reuse the exact same rule language as Segments (`VPOS_Segment_Repository::
  resolve_rule_customer_ids()`); actions are a small fixed vocabulary
  (`add_tag`, `notify`, `loyalty_earn`, `wallet_credit`) — there is no
  arbitrary code execution, and the two financial actions go through the
  same gated Loyalty/Wallet repositories a human admin would use, never a
  shortcut around their rules.
- Every rule execution writes one append-only row to `vpos_automation_runs`
  (`success`/`failed` + error), so an automation's behavior is always
  auditable after the fact — same non-negotiable as the audit log elsewhere
  in the plugin. A failing action stops that rule's remaining actions but
  never blocks other rules from running for the same event.
- `VPOS_Automation_Module` is purely hook-based, the same pattern as Wallet/
  Loyalty/Campaign — it listens to events, no other module references
  Automation directly.
- REST: `GET|POST /automations`, `GET|PATCH /automations/{id}`,
  `GET /automations/{id}/runs`. wp-admin: **VisionPrime OS → Automations /
  Automation**.
- Tests: `tests/automation-test.php` — customer-created trigger runs an
  add_tag action, order-completed trigger runs a loyalty_earn action, a
  rule with unmet conditions doesn't run, an inactive rule doesn't run,
  every run is logged, an unknown action type is logged as failed without
  blocking other rules for the same event.

## Phase 7 notes

- This is the final phase in the table — Integrations, Reports, and the AI
  Intelligence Layer close out the two hook points earlier phases deferred
  and add the plugin's only read-only analytics surface.
- The Integration Hub (`modules/integration/class-vpos-integration-repository.php`)
  is what `vpos_notification_dispatch` (Phase 5) and `vpos_club_otp_generated`
  (Phase 4) were always deferring to: `deliver( $channel, $recipient, $payload )`
  looks up `apply_filters('vpos_integration_provider_{channel}', null)` for an
  actual SMS/email/push gateway and falls back to a log-only no-op when none
  is registered, so the rest of the plugin works without any gateway
  configured in dev/test. Every attempt — delivered or logged-only — writes
  one row to `vpos_integration_logs`. `VPOS_Integration_Module` is hook-based
  like every prior integration point: it marks the originating notification
  `sent`/`failed` based on the delivery result, without Notification or Club
  Session knowing it exists.
- Reports (`modules/report/class-vpos-report-repository.php`, Master Spec
  §29) owns no table of its own — it's read-only aggregate `$wpdb` queries
  over tables Customer/Order/Wallet/Loyalty/Notification already own:
  `revenue_summary`, `customer_growth`, `wallet_liability`/`loyalty_liability`
  (outstanding balances framed as liabilities, not income), `campaign_performance`,
  `top_customers`. No caching layer — every call reflects current state.
- The AI Intelligence Layer (`modules/ai/class-vpos-ai-repository.php`,
  Master Spec §33) generates `churn_risk` insights for customers inactive
  90+ days and always suggests, never auto-applies: every insight needs an
  explicit human `approve()`/`reject()`. Crucially, the approval action
  vocabulary (`VPOS_Ai_Repository::ACTIONS`) is a strict subset of
  Automation's and deliberately excludes `loyalty_earn`/`wallet_credit`
  entirely — "AI never executes financial actions" (a Master Spec
  non-negotiable) is enforced by the vocabulary itself, not just a review
  gate. A daily background job (`VPOS_Jobs::enqueue_recurring`) scans for
  new churn-risk candidates, skipping customers with an already-open
  suggestion.
- RBAC gained `ai:*`/`ai:view`/`ai:manage` permissions on the brand owner,
  brand admin, CRM manager, and marketing manager roles.
- REST: `GET /reports/{revenue,customer-growth,liabilities,top-customers}`,
  `GET /reports/campaigns/{id}`, `GET /integrations/logs`, `GET /ai/insights`,
  `POST /ai/insights/{id}/{approve,reject}`. wp-admin: **VisionPrime OS →
  Reports / Integration Logs / AI Insights**.
- Tests: `tests/report-test.php` — revenue summary counts only completed
  orders, customer growth counts new customers, wallet liability reflects
  confirmed credits, top customers ordered by lifetime value.
  `tests/integration-test.php` — delivery without a provider is logged
  only, delivery uses a registered provider when present, notification
  dispatch is delivered and marked sent, Club OTP generation is delivered
  via the SMS channel. `tests/ai-test.php` — churn risk is suggested for an
  inactive customer, not suggested twice while one is open, approving
  executes its non-financial action, rejecting takes no action, an
  already-reviewed insight can't be approved again, an unsupported
  (financial) action type is rejected and never touches wallet/loyalty
  balances.
