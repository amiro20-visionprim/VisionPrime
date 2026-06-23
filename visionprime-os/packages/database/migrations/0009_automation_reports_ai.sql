-- Phase 12: marketing automation workflows, reporting dashboards, and
-- heuristic AI recommendations. See
-- /docs/phase-12-automation-reports-ai.md.
--
-- Automation runs/run_steps, report snapshots/exports, and AI scores/
-- explanations/feedback are append-only audit trails (see
-- database-conventions.md §6); automation_workflows and ai_recommendations
-- are mutable and therefore use soft-delete / status columns instead.

create table if not exists automation_workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_type text not null,
  is_active boolean not null default true,
  requires_approval boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_automation_workflows_deleted_at on automation_workflows(deleted_at);
create index if not exists idx_automation_workflows_trigger_type on automation_workflows(trigger_type);

create table if not exists automation_actions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references automation_workflows(id) on delete cascade,
  action_type text not null,
  action_config jsonb not null default '{}'::jsonb,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_automation_actions_workflow_id on automation_actions(workflow_id);

-- Append-only: one row per triggered execution of a workflow.
create table if not exists automation_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references automation_workflows(id),
  trigger_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in (
    'pending', 'running', 'succeeded', 'failed', 'awaiting_approval'
  )),
  idempotency_key text not null unique,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists idx_automation_runs_workflow_id on automation_runs(workflow_id);
create index if not exists idx_automation_runs_status on automation_runs(status);

-- Append-only: one row per action execution within a run.
create table if not exists automation_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references automation_runs(id) on delete cascade,
  action_id uuid not null references automation_actions(id),
  status text not null check (status in ('succeeded', 'failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  executed_at timestamptz not null default now()
);
create index if not exists idx_automation_run_steps_run_id on automation_run_steps(run_id);

-- Append-only: one row per generated reporting dashboard snapshot.
create table if not exists report_snapshots (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  payload jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  generated_by_user_id uuid
);
create index if not exists idx_report_snapshots_report_type on report_snapshots(report_type);

-- Append-only: one row per requested report export.
create table if not exists report_exports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  requested_by_user_id uuid not null,
  format text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now()
);
create index if not exists idx_report_exports_report_type on report_exports(report_type);

-- Append-only: one row per heuristic AI score computation.
create table if not exists ai_scores (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  score_type text not null,
  score numeric not null,
  computed_at timestamptz not null default now()
);
create index if not exists idx_ai_scores_customer_id on ai_scores(customer_id);
create index if not exists idx_ai_scores_score_type on ai_scores(score_type);

create table if not exists ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  recommendation_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requires_approval boolean not null default true,
  reviewed_by_user_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_recommendations_customer_id on ai_recommendations(customer_id);
create index if not exists idx_ai_recommendations_status on ai_recommendations(status);

-- Append-only: every recommendation must have at least one explanation
-- row, recorded at creation time, so a human reviewer can see why the
-- heuristic produced it.
create table if not exists ai_explanations (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references ai_recommendations(id) on delete cascade,
  explanation text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_explanations_recommendation_id on ai_explanations(recommendation_id);

-- Append-only: human feedback recorded on approve/reject — never an
-- execution side effect, only the audit/feedback trail.
create table if not exists ai_feedback (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references ai_recommendations(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('approved', 'rejected')),
  note text,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_feedback_recommendation_id on ai_feedback(recommendation_id);

-- System-defined permissions (see /docs/permissions.md). Not creatable via API.
insert into permissions (key, description) values
  ('automation:view', 'View automation workflows and runs'),
  ('automation:create', 'Create an automation workflow'),
  ('automation:update', 'Update an automation workflow'),
  ('automation:delete', 'Delete an automation workflow'),
  ('automation:activate', 'Activate or deactivate an automation workflow'),
  ('automation:run:view', 'View automation run history and step details'),
  ('report:view', 'View reporting dashboards'),
  ('report:export', 'Export a reporting dashboard'),
  ('ai:view', 'View AI scores and recommendations'),
  ('ai:recommendation:approve', 'Approve an AI recommendation'),
  ('ai:recommendation:reject', 'Reject an AI recommendation')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.name = 'Super Admin'
and p.key in (
  'automation:view', 'automation:create', 'automation:update', 'automation:delete',
  'automation:activate', 'automation:run:view',
  'report:view', 'report:export',
  'ai:view', 'ai:recommendation:approve', 'ai:recommendation:reject'
)
on conflict do nothing;
