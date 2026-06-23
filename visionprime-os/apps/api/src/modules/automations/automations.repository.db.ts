import { Db } from "@visionprime/database";
import { AutomationsRepository } from "./automations.repository";
import { AutomationActionRow, AutomationRunRow, AutomationRunStepRow, AutomationWorkflowRow, ListParams } from "./automations.types";

export function createDbAutomationsRepository(db: Db): AutomationsRepository {
  async function listPaged<T>(table: string, where: string, whereParams: unknown[], orderBy: string, params: ListParams) {
    const offset = (params.page - 1) * params.pageSize;
    const [rowsResult, countResult] = await Promise.all([
      db.query<T>(
        `select * from ${table} ${where} order by ${orderBy} limit $${whereParams.length + 1} offset $${whereParams.length + 2}`,
        [...whereParams, params.pageSize, offset],
      ),
      db.query<{ count: string }>(`select count(*)::text as count from ${table} ${where}`, whereParams),
    ]);
    return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0]?.count ?? 0) };
  }

  return {
    async list(params) {
      return listPaged<AutomationWorkflowRow>("automation_workflows", "where deleted_at is null", [], "created_at desc", params);
    },
    async findById(id) {
      const r = await db.query<AutomationWorkflowRow>(`select * from automation_workflows where id = $1 and deleted_at is null`, [id]);
      return r.rows[0] ?? null;
    },
    async listActiveByTriggerType(triggerType) {
      const r = await db.query<AutomationWorkflowRow>(
        `select * from automation_workflows where deleted_at is null and is_active = true and trigger_type = $1`,
        [triggerType],
      );
      return r.rows;
    },
    async create(record) {
      const r = await db.query<AutomationWorkflowRow>(
        `insert into automation_workflows (name, trigger_type, is_active, requires_approval, config, created_by_user_id)
         values ($1, $2, $3, $4, $5, $6) returning *`,
        [
          record.name,
          record.triggerType,
          record.isActive ?? true,
          record.requiresApproval ?? false,
          JSON.stringify(record.config ?? {}),
          record.createdByUserId ?? null,
        ],
      );
      const workflow = r.rows[0];
      for (const action of record.actions) {
        await db.query(
          `insert into automation_actions (workflow_id, action_type, action_config, position) values ($1, $2, $3, $4)`,
          [workflow.id, action.actionType, JSON.stringify(action.actionConfig ?? {}), action.position],
        );
      }
      return workflow;
    },
    async update(id, record) {
      const r = await db.query<AutomationWorkflowRow>(
        `update automation_workflows set
           name = coalesce($2, name),
           trigger_type = coalesce($3, trigger_type),
           requires_approval = coalesce($4, requires_approval),
           config = coalesce($5, config),
           updated_at = now()
         where id = $1 and deleted_at is null returning *`,
        [
          id,
          record.name ?? null,
          record.triggerType ?? null,
          record.requiresApproval ?? null,
          record.config !== undefined ? JSON.stringify(record.config) : null,
        ],
      );
      return r.rows[0] ?? null;
    },
    async softDelete(id) {
      const r = await db.query(`update automation_workflows set deleted_at = now(), updated_at = now() where id = $1 and deleted_at is null`, [id]);
      return (r.rowCount ?? 0) > 0;
    },
    async setActive(id, isActive) {
      const r = await db.query<AutomationWorkflowRow>(
        `update automation_workflows set is_active = $2, updated_at = now() where id = $1 and deleted_at is null returning *`,
        [id, isActive],
      );
      return r.rows[0] ?? null;
    },

    async listActions(workflowId) {
      const r = await db.query<AutomationActionRow>(`select * from automation_actions where workflow_id = $1 order by position asc`, [workflowId]);
      return r.rows;
    },
    async replaceActions(workflowId, newActions) {
      await db.query(`delete from automation_actions where workflow_id = $1`, [workflowId]);
      const created: AutomationActionRow[] = [];
      for (const action of newActions) {
        const r = await db.query<AutomationActionRow>(
          `insert into automation_actions (workflow_id, action_type, action_config, position) values ($1, $2, $3, $4) returning *`,
          [workflowId, action.actionType, JSON.stringify(action.actionConfig ?? {}), action.position],
        );
        created.push(r.rows[0]);
      }
      return created;
    },

    async findRunByIdempotencyKey(key) {
      const r = await db.query<AutomationRunRow>(`select * from automation_runs where idempotency_key = $1`, [key]);
      return r.rows[0] ?? null;
    },
    async createRun(record) {
      const r = await db.query<AutomationRunRow>(
        `insert into automation_runs (workflow_id, trigger_payload, status, idempotency_key) values ($1, $2, 'pending', $3) returning *`,
        [record.workflowId, JSON.stringify(record.triggerPayload), record.idempotencyKey],
      );
      return r.rows[0];
    },
    async updateRunStatus(id, status, extra = {}) {
      const r = await db.query<AutomationRunRow>(
        `update automation_runs set
           status = $2,
           started_at = coalesce($3, started_at),
           finished_at = coalesce($4, finished_at),
           error_message = coalesce($5, error_message)
         where id = $1 returning *`,
        [id, status, extra.startedAt ?? null, extra.finishedAt ?? null, extra.errorMessage ?? null],
      );
      return r.rows[0] ?? null;
    },
    async listRunsByWorkflow(workflowId, params) {
      return listPaged<AutomationRunRow>("automation_runs", "where workflow_id = $1", [workflowId], "created_at desc", params);
    },
    async findRunById(id) {
      const r = await db.query<AutomationRunRow>(`select * from automation_runs where id = $1`, [id]);
      return r.rows[0] ?? null;
    },

    async createRunStep(record) {
      const r = await db.query<AutomationRunStepRow>(
        `insert into automation_run_steps (run_id, action_id, status, input, output, error_message)
         values ($1, $2, $3, $4, $5, $6) returning *`,
        [record.runId, record.actionId, record.status, JSON.stringify(record.input), JSON.stringify(record.output), record.errorMessage ?? null],
      );
      return r.rows[0];
    },
    async listRunSteps(runId) {
      const r = await db.query<AutomationRunStepRow>(`select * from automation_run_steps where run_id = $1 order by executed_at asc`, [runId]);
      return r.rows;
    },
  };
}
