-- Phase 13: production readiness hardening — index review.
--
-- This migration is intentionally almost entirely defensive: a review of
-- migrations 0001-0009 found the schema already extremely well-indexed
-- (every hot lookup path used by the repositories in apps/api/src/modules
-- has a matching index — customers email/mobile, wordpress entity
-- mappings, orders woocommerce_order_id/customer_id/status, wallet/points
-- ledger customer_id+reference+idempotency_key, webhook event dedup via
-- delivery_id, sync jobs/logs, campaign_recipients, automation_runs).
--
-- All "create index if not exists" statements below are therefore
-- no-ops against an existing database that already has them — kept here
-- so a fresh database created from this migration set alone is
-- guaranteed the same coverage, and so the few genuinely NEW indexes
-- (clearly marked) ship in their own reviewable migration rather than
-- being silently folded into an earlier one.
--
-- See /docs/security-review.md §5 for the full existing-vs-new breakdown.

-- --- Re-asserted (already existed as of 0001-0009; see security-review.md) ---

create index if not exists idx_customers_primary_email on customers(primary_email);
create index if not exists idx_customers_primary_mobile on customers(primary_mobile);

create index if not exists idx_orders_customer_id on orders(customer_id);
create index if not exists idx_orders_status on orders(status);
-- orders.woocommerce_order_id already has an implicit unique-constraint
-- index (0004_order_sync.sql) — not repeated here since "unique"
-- constraints cannot be declared via a plain CREATE INDEX IF NOT EXISTS
-- without erroring if the constraint (and its backing index) already
-- exists under a different mechanism.

create index if not exists idx_wallet_ledger_customer_id on wallet_ledger_entries(customer_id, created_at);
create index if not exists idx_wallet_ledger_reference on wallet_ledger_entries(reference_type, reference_id);

create index if not exists idx_points_ledger_customer_id on points_ledger_entries(customer_id, created_at);
create index if not exists idx_points_ledger_reference on points_ledger_entries(reference_type, reference_id);

create index if not exists idx_campaign_recipients_campaign_id on campaign_recipients(campaign_id);
create index if not exists idx_campaign_recipients_customer_id on campaign_recipients(customer_id);

create index if not exists idx_automation_runs_workflow_id on automation_runs(workflow_id);
create index if not exists idx_automation_runs_status on automation_runs(status);

create index if not exists idx_wordpress_sync_jobs_status on wordpress_sync_jobs(status);
create index if not exists idx_wordpress_sync_logs_sync_job_id on wordpress_sync_logs(sync_job_id);

-- wordpress_entity_mappings is covered by its two unique constraints
-- (entity_type, local_id) and (entity_type, remote_id) from
-- 0002_wordpress_connection.sql, which both already serve as indexes for
-- the repository's findByLocalId/findByRemoteId lookups.

-- wordpress_webhook_events dedup: idx_wordpress_webhook_events_delivery_id
-- (unique, partial on delivery_id is not null) from 0004_order_sync.sql is
-- the webhook-event-dedup index called for by the Phase 13 spec — no new
-- table needed, see security-review.md §3.

-- --- Genuinely new in this migration ---

-- campaigns.status: campaign list/report queries are not yet filtered by
-- status in the application today, but the admin UI's natural next
-- filter (e.g. "show only sent campaigns") would need this, and it's
-- cheap to add now rather than as a follow-up migration later.
create index if not exists idx_campaigns_status on campaigns(status);

-- wallet_reservations / reward_reservations status: checkout flows query
-- "all active reservations for a cart/customer" when computing available
-- balance (see checkout.service.ts) — a status filter alongside the
-- existing customer_id/cart_key indexes keeps that lookup cheap as
-- reservation history grows.
create index if not exists idx_wallet_reservations_status on wallet_reservations(status);
create index if not exists idx_reward_reservations_status on reward_reservations(status);

-- reward_claims.status: admin reward-claims list and the claim/redeem
-- flow both filter/branch on status. (reward_redemptions has no status
-- column — it's an append-only record of a completed redemption, see
-- 0007_loyalty_points_rewards.sql, so no index needed there.)
create index if not exists idx_reward_claims_status on reward_claims(status);
