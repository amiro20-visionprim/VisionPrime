-- Phase 11: customer segmentation, campaign management, message
-- templates, notification provider base, opt-out, and suppression
-- lists. See /docs/phase-11-segments-campaigns-notifications.md.
--
-- Segments combine conditions with AND-only semantics (no OR groups —
-- out of scope this phase). segment_members always holds *current*
-- membership for both segment types: for `dynamic` segments it is
-- cleared and re-inserted on every evaluate() call; for `static`
-- segments it is only ever changed by explicit member management.

alter table customers add column if not exists gender text;
alter table customers add column if not exists city text;

create table if not exists segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  segment_type text not null check (segment_type in ('dynamic', 'static')),
  is_active boolean not null default true,
  last_evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_segments_deleted_at on segments(deleted_at);

create table if not exists segment_conditions (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references segments(id) on delete cascade,
  condition_type text not null check (condition_type in (
    'purchase_count', 'total_spent', 'last_purchase_at', 'average_order_value',
    'city', 'gender', 'tier', 'wallet_balance', 'points', 'reward_status',
    'campaign_received', 'campaign_clicked', 'churn_risk',
    'woocommerce_product_bought', 'woocommerce_category_bought', 'coupon_used'
  )),
  operator text not null check (operator in ('gt', 'gte', 'lt', 'lte', 'eq', 'in')),
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_segment_conditions_segment_id on segment_conditions(segment_id);

-- Current membership snapshot for either segment type — see header note.
create table if not exists segment_members (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references segments(id) on delete cascade,
  customer_id uuid not null references customers(id),
  added_at timestamptz not null default now(),
  unique (segment_id, customer_id)
);
create index if not exists idx_segment_members_segment_id on segment_members(segment_id);
create index if not exists idx_segment_members_customer_id on segment_members(customer_id);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment_id uuid not null references segments(id),
  channel text not null check (channel in ('sms', 'email', 'in_app')),
  -- FK added below via ALTER TABLE, once message_templates exists
  -- (declaring it inline here would fail on a fresh database since
  -- message_templates is created later in this same file).
  message_template_id uuid,
  status text not null default 'draft' check (status in (
    'draft', 'pending_approval', 'approved', 'sending', 'sent', 'failed'
  )),
  requires_approval boolean not null default false,
  approved_at timestamptz,
  approved_by uuid,
  scheduled_at timestamptz,
  sent_at timestamptz,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_campaigns_segment_id on campaigns(segment_id);
create index if not exists idx_campaigns_deleted_at on campaigns(deleted_at);

create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null check (channel in ('sms', 'email', 'in_app')),
  subject text,
  body text not null,
  -- Expected variable names referenced as {{variable}} placeholders in
  -- `body` (and `subject`). Rendering validates all are supplied.
  variables jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_message_templates_deleted_at on message_templates(deleted_at);

-- campaigns references message_templates above; message_templates must
-- exist first, so the FK is added here once both tables exist.
alter table campaigns
  add constraint campaigns_message_template_id_fkey
  foreign key (message_template_id) references message_templates(id);

-- Append-only: one row per intended recipient of a campaign, created
-- before sending (after opt-out/suppression filtering) with
-- status='pending', then updated as the background job processes it.
create table if not exists campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  customer_id uuid not null references customers(id),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_campaign_recipients_campaign_id on campaign_recipients(campaign_id);
create index if not exists idx_campaign_recipients_customer_id on campaign_recipients(customer_id);

-- Append-only campaign activity trail (sent/failed/opened/clicked), the
-- source for campaign reporting — see database-conventions.md §6.
create table if not exists campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  customer_id uuid references customers(id),
  event_type text not null check (event_type in ('sent', 'failed', 'opened', 'clicked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_campaign_events_campaign_id on campaign_events(campaign_id);
create index if not exists idx_campaign_events_customer_id on campaign_events(customer_id);
create index if not exists idx_campaign_events_event_type on campaign_events(event_type);

create table if not exists notification_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null check (channel in ('sms', 'email', 'in_app')),
  provider_type text not null,
  -- AES-256-GCM ciphertext (see common/crypto.ts) — never decrypted in
  -- an API response; only a masked preview is ever returned.
  credentials_encrypted text,
  is_active boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_notification_providers_channel on notification_providers(channel);

-- Append-only record of every individual notification send attempt
-- (campaign-driven or otherwise), independent of campaign_recipients so
-- a future non-campaign notification (e.g. transactional) has the same
-- audit trail shape.
create table if not exists notification_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id),
  customer_id uuid not null references customers(id),
  channel text not null check (channel in ('sms', 'email', 'in_app')),
  provider_id uuid references notification_providers(id),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  rendered_body text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notification_messages_campaign_id on notification_messages(campaign_id);
create index if not exists idx_notification_messages_customer_id on notification_messages(customer_id);

create table if not exists notification_opt_outs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  channel text not null check (channel in ('sms', 'email', 'in_app')),
  reason text,
  created_at timestamptz not null default now(),
  unique (customer_id, channel)
);
create index if not exists idx_notification_opt_outs_customer_id on notification_opt_outs(customer_id);

create table if not exists suppression_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists suppression_list_members (
  id uuid primary key default gen_random_uuid(),
  suppression_list_id uuid not null references suppression_lists(id) on delete cascade,
  customer_id uuid not null references customers(id),
  added_at timestamptz not null default now(),
  unique (suppression_list_id, customer_id)
);
create index if not exists idx_suppression_list_members_list_id on suppression_list_members(suppression_list_id);
create index if not exists idx_suppression_list_members_customer_id on suppression_list_members(customer_id);

-- System-defined permissions (see /docs/permissions.md). Not creatable via API.
insert into permissions (key, description) values
  ('segment:view', 'View customer segments'),
  ('segment:create', 'Create a customer segment'),
  ('segment:update', 'Update a customer segment'),
  ('segment:delete', 'Delete a customer segment'),
  ('segment:evaluate', 'Evaluate (recalculate membership of) a customer segment'),
  ('campaign:view', 'View campaigns'),
  ('campaign:create', 'Create a campaign'),
  ('campaign:update', 'Update a campaign'),
  ('campaign:delete', 'Delete a campaign'),
  ('campaign:send', 'Send a campaign'),
  ('campaign:report:view', 'View campaign reports'),
  ('message_template:view', 'View message templates'),
  ('message_template:manage', 'Create/update/delete message templates'),
  ('notification_provider:view', 'View notification providers'),
  ('notification_provider:manage', 'Create/update notification providers')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.name = 'Super Admin'
and p.key in (
  'segment:view', 'segment:create', 'segment:update', 'segment:delete', 'segment:evaluate',
  'campaign:view', 'campaign:create', 'campaign:update', 'campaign:delete', 'campaign:send', 'campaign:report:view',
  'message_template:view', 'message_template:manage',
  'notification_provider:view', 'notification_provider:manage'
)
on conflict do nothing;
