import { randomUUID } from "crypto";
import { AutomationsRepository } from "./automations.repository";
import {
  AutomationActionRow,
  AutomationRunRow,
  AutomationRunStepRow,
  AutomationWorkflowRow,
  ListParams,
  ListResult,
} from "./automations.types";

function paginate<T>(rows: T[], params: ListParams): ListResult<T> {
  const start = (params.page - 1) * params.pageSize;
  return { rows: rows.slice(start, start + params.pageSize), totalItems: rows.length };
}

export function createMemoryAutomationsRepository(): AutomationsRepository {
  const workflows: AutomationWorkflowRow[] = [];
  const actions: AutomationActionRow[] = [];
  const runs: AutomationRunRow[] = [];
  const steps: AutomationRunStepRow[] = [];
  const now = () => new Date().toISOString();

  return {
    async list(params) {
      return paginate(workflows.filter((w) => !w.deleted_at).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), params);
    },
    async findById(id) {
      return workflows.find((w) => w.id === id && !w.deleted_at) ?? null;
    },
    async listActiveByTriggerType(triggerType) {
      return workflows.filter((w) => !w.deleted_at && w.is_active && w.trigger_type === triggerType);
    },
    async create(record) {
      const row: AutomationWorkflowRow = {
        id: randomUUID(),
        name: record.name,
        trigger_type: record.triggerType,
        is_active: record.isActive ?? true,
        requires_approval: record.requiresApproval ?? false,
        config: record.config ?? {},
        created_by_user_id: record.createdByUserId ?? null,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      };
      workflows.push(row);
      record.actions.forEach((a) => {
        actions.push({
          id: randomUUID(),
          workflow_id: row.id,
          action_type: a.actionType,
          action_config: a.actionConfig ?? {},
          position: a.position,
          created_at: now(),
          updated_at: now(),
        });
      });
      return row;
    },
    async update(id, record) {
      const row = workflows.find((w) => w.id === id && !w.deleted_at);
      if (!row) return null;
      if (record.name !== undefined) row.name = record.name;
      if (record.triggerType !== undefined) row.trigger_type = record.triggerType;
      if (record.requiresApproval !== undefined) row.requires_approval = record.requiresApproval;
      if (record.config !== undefined) row.config = record.config;
      row.updated_at = now();
      return row;
    },
    async softDelete(id) {
      const row = workflows.find((w) => w.id === id && !w.deleted_at);
      if (!row) return false;
      row.deleted_at = now();
      return true;
    },
    async setActive(id, isActive) {
      const row = workflows.find((w) => w.id === id && !w.deleted_at);
      if (!row) return null;
      row.is_active = isActive;
      row.updated_at = now();
      return row;
    },

    async listActions(workflowId) {
      return actions.filter((a) => a.workflow_id === workflowId);
    },
    async replaceActions(workflowId, newActions) {
      for (let i = actions.length - 1; i >= 0; i--) {
        if (actions[i].workflow_id === workflowId) actions.splice(i, 1);
      }
      const created = newActions.map((a) => {
        const row: AutomationActionRow = {
          id: randomUUID(),
          workflow_id: workflowId,
          action_type: a.actionType,
          action_config: a.actionConfig ?? {},
          position: a.position,
          created_at: now(),
          updated_at: now(),
        };
        actions.push(row);
        return row;
      });
      return created;
    },

    async findRunByIdempotencyKey(key) {
      return runs.find((r) => r.idempotency_key === key) ?? null;
    },
    async createRun(record) {
      const row: AutomationRunRow = {
        id: randomUUID(),
        workflow_id: record.workflowId,
        trigger_payload: record.triggerPayload,
        status: "pending",
        idempotency_key: record.idempotencyKey,
        started_at: null,
        finished_at: null,
        error_message: null,
        created_at: now(),
      };
      runs.push(row);
      return row;
    },
    async updateRunStatus(id, status, extra = {}) {
      const row = runs.find((r) => r.id === id);
      if (!row) return null;
      row.status = status;
      if (extra.startedAt !== undefined) row.started_at = extra.startedAt;
      if (extra.finishedAt !== undefined) row.finished_at = extra.finishedAt;
      if (extra.errorMessage !== undefined) row.error_message = extra.errorMessage;
      return row;
    },
    async listRunsByWorkflow(workflowId, params) {
      return paginate(runs.filter((r) => r.workflow_id === workflowId).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), params);
    },
    async findRunById(id) {
      return runs.find((r) => r.id === id) ?? null;
    },

    async createRunStep(record) {
      const row: AutomationRunStepRow = {
        id: randomUUID(),
        run_id: record.runId,
        action_id: record.actionId,
        status: record.status,
        input: record.input,
        output: record.output,
        error_message: record.errorMessage ?? null,
        executed_at: now(),
      };
      steps.push(row);
      return row;
    },
    async listRunSteps(runId) {
      return steps.filter((s) => s.run_id === runId);
    },
  };
}
