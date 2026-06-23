import { JobRunner } from "../../common/jobs";
import { NotFoundError } from "../../common/http-error";
import { AuditService, toPaginationMeta } from "../audit/audit.service";
import { ACTION_DISPATCH, ActionDispatchDeps, friendlyActionError } from "./automations.actions";
import { AutomationsRepository } from "./automations.repository";
import {
  AutomationActionRow,
  AutomationTriggerType,
  AutomationWorkflowRow,
  NewAutomationWorkflowRecord,
  SENSITIVE_ACTION_TYPES,
  toPublicAutomationRun,
  toPublicAutomationWorkflow,
  UpdateAutomationWorkflowRecord,
} from "./automations.types";

export interface AutomationsActor {
  userId: string;
}

export interface AutomationsServiceDeps {
  automationsRepository: AutomationsRepository;
  auditService: AuditService;
  jobRunner: JobRunner;
  actionDeps: ActionDispatchDeps;
}

function computeIdempotencyKey(workflowId: string, triggerType: string, payload: Record<string, unknown>): string {
  const customerId = (payload.customerId as string | undefined) ?? "";
  const woocommerceOrderId = (payload.woocommerceOrderId as string | undefined) ?? "";
  return `${workflowId}:${triggerType}:${customerId}:${woocommerceOrderId}`;
}

export class AutomationsService {
  constructor(private readonly deps: AutomationsServiceDeps) {}

  private async toPublic(row: AutomationWorkflowRow) {
    const actions = await this.deps.automationsRepository.listActions(row.id);
    return toPublicAutomationWorkflow(row, actions);
  }

  async listWorkflows(page: number, pageSize: number) {
    const result = await this.deps.automationsRepository.list({ page, pageSize });
    const rows = await Promise.all(result.rows.map((r) => this.toPublic(r)));
    return { rows, meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async getWorkflow(id: string) {
    const row = await this.deps.automationsRepository.findById(id);
    if (!row) throw new NotFoundError("Automation workflow not found");
    return this.toPublic(row);
  }

  async createWorkflow(record: NewAutomationWorkflowRecord, actor: AutomationsActor) {
    const row = await this.deps.automationsRepository.create({ ...record, createdByUserId: actor.userId });
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "automation.create",
      targetType: "automation_workflow",
      targetId: row.id,
      before: null,
      after: { workflow: row },
    });
    return this.toPublic(row);
  }

  async updateWorkflow(id: string, record: UpdateAutomationWorkflowRecord, actor: AutomationsActor) {
    const before = await this.deps.automationsRepository.findById(id);
    if (!before) throw new NotFoundError("Automation workflow not found");
    const after = await this.deps.automationsRepository.update(id, record);
    if (!after) throw new NotFoundError("Automation workflow not found");
    if (record.actions) {
      await this.deps.automationsRepository.replaceActions(id, record.actions);
    }
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "automation.update",
      targetType: "automation_workflow",
      targetId: id,
      before: { workflow: before },
      after: { workflow: after },
    });
    return this.toPublic(after);
  }

  async deleteWorkflow(id: string, actor: AutomationsActor) {
    const before = await this.deps.automationsRepository.findById(id);
    if (!before) throw new NotFoundError("Automation workflow not found");
    await this.deps.automationsRepository.softDelete(id);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "automation.delete",
      targetType: "automation_workflow",
      targetId: id,
      before: { workflow: before },
      after: null,
    });
  }

  async setActive(id: string, isActive: boolean, actor: AutomationsActor) {
    const before = await this.deps.automationsRepository.findById(id);
    if (!before) throw new NotFoundError("Automation workflow not found");
    const after = await this.deps.automationsRepository.setActive(id, isActive);
    if (!after) throw new NotFoundError("Automation workflow not found");
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: isActive ? "automation.activate" : "automation.deactivate",
      targetType: "automation_workflow",
      targetId: id,
      before: { workflow: before },
      after: { workflow: after },
    });
    return this.toPublic(after);
  }

  async listRuns(workflowId: string, page: number, pageSize: number) {
    const workflow = await this.deps.automationsRepository.findById(workflowId);
    if (!workflow) throw new NotFoundError("Automation workflow not found");
    const result = await this.deps.automationsRepository.listRunsByWorkflow(workflowId, { page, pageSize });
    const rows = await Promise.all(
      result.rows.map(async (run) => {
        const steps = await this.deps.automationsRepository.listRunSteps(run.id);
        return toPublicAutomationRun(run, steps);
      }),
    );
    return { rows, meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  /**
   * Entry point for every trigger source (customer creation, order
   * status changes, wallet credits, reward claims, etc.). Finds active
   * matching workflows, dedupes via idempotency key, and dispatches the
   * actual run execution to the JobRunner so this always returns fast —
   * webhook/event callers must never block on automation execution.
   */
  async handleTrigger(triggerType: string, payload: Record<string, unknown>): Promise<void> {
    const workflows = await this.deps.automationsRepository.listActiveByTriggerType(triggerType);
    for (const workflow of workflows) {
      const idempotencyKey = computeIdempotencyKey(workflow.id, triggerType, payload);
      const existing = await this.deps.automationsRepository.findRunByIdempotencyKey(idempotencyKey);
      if (existing) {
        // Already fired for this trigger+customer+order combination —
        // skip silently. This is the loop/duplicate-webhook prevention.
        continue;
      }

      const run = await this.deps.automationsRepository.createRun({
        workflowId: workflow.id,
        triggerPayload: payload,
        idempotencyKey,
      });

      this.deps.jobRunner.run(`automation.run:${run.id}`, async () => {
        await this.executeRun(run.id, workflow);
      });
    }
  }

  private async executeRun(runId: string, workflow: AutomationWorkflowRow): Promise<void> {
    const run = await this.deps.automationsRepository.findRunById(runId);
    if (!run) return;

    await this.deps.automationsRepository.updateRunStatus(runId, "running", { startedAt: new Date().toISOString() });

    const actions = (await this.deps.automationsRepository.listActions(workflow.id)).sort((a, b) => a.position - b.position);
    const hasSensitiveAction = actions.some((a) => SENSITIVE_ACTION_TYPES.has(a.action_type));

    if (workflow.requires_approval || hasSensitiveAction) {
      await this.deps.automationsRepository.updateRunStatus(runId, "awaiting_approval", { finishedAt: new Date().toISOString() });
      return;
    }

    await this.runActions(run.id, run.trigger_payload, actions);
  }

  private async runActions(runId: string, triggerPayload: Record<string, unknown>, actions: AutomationActionRow[]): Promise<void> {
    let anyFailed = false;
    let lastError: string | null = null;

    for (const action of actions) {
      try {
        const fn = ACTION_DISPATCH[action.action_type];
        const output = await fn(action.action_config, { ...triggerPayload, runId }, this.deps.actionDeps);
        await this.deps.automationsRepository.createRunStep({
          runId,
          actionId: action.id,
          status: "succeeded",
          input: { actionConfig: action.action_config, triggerPayload },
          output,
        });
      } catch (error) {
        anyFailed = true;
        const message = error instanceof Error && error.message ? error.message : friendlyActionError();
        lastError = message;
        await this.deps.automationsRepository.createRunStep({
          runId,
          actionId: action.id,
          status: "failed",
          input: { actionConfig: action.action_config, triggerPayload },
          output: {},
          errorMessage: message,
        });
        // A failed step never stops the rest of the run's actions from
        // executing — each is independent, mirroring campaigns' per-
        // recipient try/catch pattern.
      }
    }

    await this.deps.automationsRepository.updateRunStatus(runId, anyFailed ? "failed" : "succeeded", {
      finishedAt: new Date().toISOString(),
      errorMessage: anyFailed ? lastError : null,
    });
  }
}
