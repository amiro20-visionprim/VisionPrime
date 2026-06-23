import {
  AutomationActionRow,
  AutomationRunRow,
  AutomationRunStepRow,
  AutomationWorkflowRow,
  ListParams,
  ListResult,
  NewAutomationActionRecord,
  NewAutomationWorkflowRecord,
  UpdateAutomationWorkflowRecord,
} from "./automations.types";

export interface AutomationsRepository {
  list(params: ListParams): Promise<ListResult<AutomationWorkflowRow>>;
  findById(id: string): Promise<AutomationWorkflowRow | null>;
  listActiveByTriggerType(triggerType: string): Promise<AutomationWorkflowRow[]>;
  create(record: NewAutomationWorkflowRecord): Promise<AutomationWorkflowRow>;
  update(id: string, record: UpdateAutomationWorkflowRecord): Promise<AutomationWorkflowRow | null>;
  softDelete(id: string): Promise<boolean>;
  setActive(id: string, isActive: boolean): Promise<AutomationWorkflowRow | null>;

  listActions(workflowId: string): Promise<AutomationActionRow[]>;
  replaceActions(workflowId: string, actions: NewAutomationActionRecord[]): Promise<AutomationActionRow[]>;

  findRunByIdempotencyKey(key: string): Promise<AutomationRunRow | null>;
  createRun(record: { workflowId: string; triggerPayload: Record<string, unknown>; idempotencyKey: string }): Promise<AutomationRunRow>;
  updateRunStatus(
    id: string,
    status: AutomationRunRow["status"],
    extra?: { startedAt?: string | null; finishedAt?: string | null; errorMessage?: string | null },
  ): Promise<AutomationRunRow | null>;
  listRunsByWorkflow(workflowId: string, params: ListParams): Promise<ListResult<AutomationRunRow>>;
  findRunById(id: string): Promise<AutomationRunRow | null>;

  createRunStep(record: {
    runId: string;
    actionId: string;
    status: AutomationRunStepRow["status"];
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    errorMessage?: string | null;
  }): Promise<AutomationRunStepRow>;
  listRunSteps(runId: string): Promise<AutomationRunStepRow[]>;
}
