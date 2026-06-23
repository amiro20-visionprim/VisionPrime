import { Db } from "@visionprime/database";
import { SegmentsRepository } from "./segments.repository";
import { ListParams, SegmentConditionRow, SegmentMemberRow, SegmentRow } from "./segments.types";

export function createDbSegmentsRepository(db: Db): SegmentsRepository {
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

  async function insertConditions(segmentId: string, conditions: { conditionType: string; operator: string; value: unknown }[]) {
    const created: SegmentConditionRow[] = [];
    for (const c of conditions) {
      const r = await db.query<SegmentConditionRow>(
        `insert into segment_conditions (segment_id, condition_type, operator, value) values ($1, $2, $3, $4) returning *`,
        [segmentId, c.conditionType, c.operator, JSON.stringify(c.value ?? {})],
      );
      created.push(r.rows[0]);
    }
    return created;
  }

  return {
    async list(params) {
      return listPaged<SegmentRow>("segments", "where deleted_at is null", [], "created_at desc", params);
    },
    async findById(id) {
      const r = await db.query<SegmentRow>(`select * from segments where id = $1 and deleted_at is null`, [id]);
      return r.rows[0] ?? null;
    },
    async create(record) {
      const r = await db.query<SegmentRow>(
        `insert into segments (name, description, segment_type, is_active) values ($1, $2, $3, $4) returning *`,
        [record.name, record.description ?? null, record.segmentType, record.isActive ?? true],
      );
      const row = r.rows[0];
      if (record.conditions?.length) await insertConditions(row.id, record.conditions);
      if (record.segmentType === "static" && record.memberCustomerIds?.length) {
        for (const customerId of record.memberCustomerIds) {
          await db.query(
            `insert into segment_members (segment_id, customer_id) values ($1, $2) on conflict do nothing`,
            [row.id, customerId],
          );
        }
      }
      return row;
    },
    async update(id, record) {
      const r = await db.query<SegmentRow>(
        `update segments set
           name = coalesce($2, name),
           description = coalesce($3, description),
           is_active = coalesce($4, is_active),
           updated_at = now()
         where id = $1 and deleted_at is null returning *`,
        [id, record.name ?? null, record.description ?? null, record.isActive ?? null],
      );
      const row = r.rows[0] ?? null;
      if (row && record.conditions !== undefined) {
        await db.query(`delete from segment_conditions where segment_id = $1`, [id]);
        await insertConditions(id, record.conditions);
      }
      return row;
    },
    async softDelete(id) {
      const r = await db.query(`update segments set deleted_at = now(), updated_at = now() where id = $1 and deleted_at is null`, [id]);
      return (r.rowCount ?? 0) > 0;
    },
    async touchLastEvaluatedAt(id) {
      await db.query(`update segments set last_evaluated_at = now() where id = $1`, [id]);
    },

    async listConditions(segmentId) {
      const r = await db.query<SegmentConditionRow>(
        `select * from segment_conditions where segment_id = $1 order by created_at asc`,
        [segmentId],
      );
      return r.rows;
    },
    async replaceConditions(segmentId, conditions) {
      await db.query(`delete from segment_conditions where segment_id = $1`, [segmentId]);
      return insertConditions(segmentId, conditions ?? []);
    },

    async listMembers(segmentId, params) {
      return listPaged<SegmentMemberRow>(
        "segment_members",
        "where segment_id = $1",
        [segmentId],
        "added_at desc",
        params,
      );
    },
    async countMembers(segmentId) {
      const r = await db.query<{ count: string }>(`select count(*)::text as count from segment_members where segment_id = $1`, [segmentId]);
      return Number(r.rows[0]?.count ?? 0);
    },
    async replaceMembers(segmentId, customerIds) {
      await db.query(`delete from segment_members where segment_id = $1`, [segmentId]);
      for (const customerId of customerIds) {
        await db.query(`insert into segment_members (segment_id, customer_id) values ($1, $2) on conflict do nothing`, [
          segmentId,
          customerId,
        ]);
      }
    },
    async addMembers(segmentId, customerIds) {
      for (const customerId of customerIds) {
        await db.query(`insert into segment_members (segment_id, customer_id) values ($1, $2) on conflict do nothing`, [
          segmentId,
          customerId,
        ]);
      }
    },
    async removeMembers(segmentId, customerIds) {
      if (customerIds.length === 0) return;
      await db.query(`delete from segment_members where segment_id = $1 and customer_id = any($2)`, [segmentId, customerIds]);
    },
    async listAllMemberCustomerIds(segmentId) {
      const r = await db.query<{ customer_id: string }>(`select customer_id from segment_members where segment_id = $1`, [segmentId]);
      return r.rows.map((row) => row.customer_id);
    },
  };
}
