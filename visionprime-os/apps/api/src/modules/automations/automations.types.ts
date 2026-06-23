export type AutomationTriggerType =
  | "customer_created"
  | "order_completed"
  | "order_cancelled"
  | "order_refunded"
  | "wallet_credited"
  | "reward_claimed"
  | "first_purchase"
  | "reward_expiring"
  | "birthday_coming"
  | "tier_upgraded"
  | "customer_at_risk"
  | "no_purchase_for_x_days"
  | "woocommerce_order_status_changed";

export type AutomationActionType =
  | "send_sms"
  | "send_email"
  | "add_reward"
  | "add_cashback"
  | "add_points"
  | "change_tier"
  | "add_to_segment"
  | "create_admin_task"
  | "show_wordpress_account_notice"
  | "trigger_webhook";

export type AutomationRunStatus = "pending" | "running" | "succeeded" | "failed" | "awaiting_approval";
export type AutomationRunStepStatus = "succeeded" | "failed";

/** Action types considered "sensitive" — these always gate the run to
 * awaiting_approval if the workflow has not already been auto-approved
 * by an explicit requires_approval=false setting at the workflow level.
 * Financial actions and outbound messaging are the sensitive set. */
export const SENSITIVE_ACTION_TYPES: ReadonlySet<AutomationActionType> = new Set([
  "add_cashback",
  "add_points",
  "send_sms",
  "send_email",
]);

export interface AutomationWorkflowRow {
  id: string;
  name: string;
  trigger_type: AutomationTriggerType;
  is_active: boolean;
  requires_approval: boolean;
  config: Record<string, unknown>;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AutomationActionRow {
  id: string;
  workflow_id: string;
  action_type: AutomationActionType;
  action_config: Record<string, unknown>;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface AutomationRunRow {
  id: string;
  workflow_id: string;
  trigger_payload: Record<string, unknown>;
  status: AutomationRunStatus;
  idempotency_key: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface AutomationRunStepRow {
  id: string;
  run_id: string;
  action_id: string;
  status: AutomationRunStepStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error_message: string | null;
  executed_at: string;
}

export interface NewAutomationWorkflowRecord {
  name: string;
  triggerType: AutomationTriggerType;
  isActive?: boolean;
  requiresApproval?: boolean;
  config?: Record<string, unknown>;
  createdByUserId?: string | null;
  actions: NewAutomationActionRecord[];
}

export interface NewAutomationActionRecord {
  actionType: AutomationActionType;
  actionConfig?: Record<string, unknown>;
  position: number;
}

export interface UpdateAutomationWorkflowRecord {
  name?: string;
  triggerType?: AutomationTriggerType;
  requiresApproval?: boolean;
  config?: Record<string, unknown>;
  actions?: NewAutomationActionRecord[];
}

export interface ListParams {
  page: number;
  pageSize: number;
}

export interface ListResult<T> {
  rows: T[];
  totalItems: number;
}

export interface PublicAutomationAction {
  id: string;
  actionType: AutomationActionType;
  actionConfig: Record<string, unknown>;
  position: number;
}

export function toPublicAutomationAction(row: AutomationActionRow): PublicAutomationAction {
  return {
    id: row.id,
    actionType: row.action_type,
    actionConfig: row.action_config,
    position: row.position,
  };
}

export interface PublicAutomationWorkflow {
  id: string;
  name: string;
  triggerType: AutomationTriggerType;
  isActive: boolean;
  requiresApproval: boolean;
  config: Record<string, unknown>;
  actions: PublicAutomationAction[];
  createdAt: string;
  updatedAt: string;
}

export function toPublicAutomationWorkflow(row: AutomationWorkflowRow, actions: AutomationActionRow[]): PublicAutomationWorkflow {
  return {
    id: row.id,
    name: row.name,
    triggerType: row.trigger_type,
    isActive: row.is_active,
    requiresApproval: row.requires_approval,
    config: row.config,
    actions: actions.sort((a, b) => a.position - b.position).map(toPublicAutomationAction),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface PublicAutomationRunStep {
  id: string;
  actionId: string;
  status: AutomationRunStepStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  errorMessage: string | null;
  executedAt: string;
}

export function toPublicAutomationRunStep(row: AutomationRunStepRow): PublicAutomationRunStep {
  return {
    id: row.id,
    actionId: row.action_id,
    status: row.status,
    input: row.input,
    output: row.output,
    errorMessage: row.error_message,
    executedAt: row.executed_at,
  };
}

export interface PublicAutomationRun {
  id: string;
  workflowId: string;
  triggerPayload: Record<string, unknown>;
  status: AutomationRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  steps?: PublicAutomationRunStep[];
}

export function toPublicAutomationRun(row: AutomationRunRow, steps?: AutomationRunStepRow[]): PublicAutomationRun {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    triggerPayload: row.trigger_payload,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    steps: steps?.map(toPublicAutomationRunStep),
  };
}
