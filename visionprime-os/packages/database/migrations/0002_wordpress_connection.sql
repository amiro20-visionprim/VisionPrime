-- Phase 04: WordPress/WooCommerce connection management.
-- See /docs/database-conventions.md for naming/UUID/timestamp/soft-delete rules.
-- No full sync, no customer/order/product import — connection/test/sync-job
-- scaffolding only. See /docs/phase-04-wordpress-connection.md.

-- Single-row singleton, mirrors business_settings. Secrets are stored
-- encrypted (consumer key/secret, shared secret) or hashed (plugin API key)
-- — never in plaintext, never returned by the API.
create table if not exists wordpress_connections (
  id uuid primary key default gen_random_uuid(),
  site_url text,
  consumer_key_encrypted text,
  consumer_secret_encrypted text,
  shared_secret_encrypted text,
  plugin_api_key_hash text,
  status text not null default 'disconnected',
  last_tested_at timestamptz,
  last_test_success boolean,
  last_test_message text,
  webhook_registration_status text not null default 'not_registered',
  webhook_registered_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id)
);

-- Mutable status (queued/running/succeeded/failed) — not append-only.
create table if not exists wordpress_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status text not null default 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wordpress_sync_jobs_status on wordpress_sync_jobs(status);
create index if not exists idx_wordpress_sync_jobs_created_at on wordpress_sync_jobs(created_at);

-- Append-only: no updated_at/deleted_at — see database-conventions.md §6.
create table if not exists wordpress_sync_logs (
  id uuid primary key default gen_random_uuid(),
  sync_job_id uuid references wordpress_sync_jobs(id) on delete cascade,
  level text not null default 'info',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_wordpress_sync_logs_sync_job_id on wordpress_sync_logs(sync_job_id);
create index if not exists idx_wordpress_sync_logs_created_at on wordpress_sync_logs(created_at);

-- Placeholder structure for future entity-mapping (Phase 05/06 full sync).
create table if not exists wordpress_entity_mappings (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  local_id text not null,
  remote_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, local_id),
  unique (entity_type, remote_id)
);

-- Append-only: registration attempts/incoming events metadata only — no
-- live webhook payload processing this phase. See database-conventions.md §6.
create table if not exists wordpress_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  status text not null,
  detail text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_wordpress_webhook_events_created_at on wordpress_webhook_events(created_at);

-- System-defined permissions (see /docs/permissions.md). Not creatable via API.
insert into permissions (key, description) values
  ('wordpress:view', 'View the WordPress/WooCommerce connection status and settings'),
  ('wordpress:connect', 'Save the WordPress/WooCommerce connection credentials'),
  ('wordpress:update', 'Update WordPress/WooCommerce connection settings'),
  ('wordpress:test', 'Test the WordPress/WooCommerce connection'),
  ('wordpress:webhook_register', 'Register WordPress/WooCommerce webhooks'),
  ('wordpress:sync_job:view', 'View WordPress sync jobs'),
  ('wordpress:sync_log:view', 'View WordPress sync logs')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.name = 'Super Admin'
and p.key in (
  'wordpress:view', 'wordpress:connect', 'wordpress:update', 'wordpress:test',
  'wordpress:webhook_register', 'wordpress:sync_job:view', 'wordpress:sync_log:view'
)
on conflict do nothing;

-- Single connection row (empty/disconnected by default).
insert into wordpress_connections (status, webhook_registration_status)
select 'disconnected', 'not_registered'
where not exists (select 1 from wordpress_connections);
