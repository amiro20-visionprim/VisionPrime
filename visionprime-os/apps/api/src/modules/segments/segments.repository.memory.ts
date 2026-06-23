import { randomUUID } from "crypto";
import { SegmentsRepository } from "./segments.repository";
import {
  ListParams,
  ListResult,
  NewSegmentRecord,
  SegmentConditionRow,
  SegmentMemberRow,
  SegmentRow,
  UpdateSegmentRecord,
} from "./segments.types";

function paginate<T>(rows: T[], params: ListParams): ListResult<T> {
  const start = (params.page - 1) * params.pageSize;
  return { rows: rows.slice(start, start + params.pageSize), totalItems: rows.length };
}

export function createMemorySegmentsRepository(): SegmentsRepository {
  const segments: SegmentRow[] = [];
  const conditions: SegmentConditionRow[] = [];
  const members: SegmentMemberRow[] = [];
  const now = () => new Date().toISOString();

  return {
    async list(params) {
      return paginate(
        segments.filter((s) => !s.deleted_at).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
        params,
      );
    },
    async findById(id) {
      return segments.find((s) => s.id === id && !s.deleted_at) ?? null;
    },
    async create(record: NewSegmentRecord) {
      const row: SegmentRow = {
        id: randomUUID(),
        name: record.name,
        description: record.description ?? null,
        segment_type: record.segmentType,
        is_active: record.isActive ?? true,
        last_evaluated_at: null,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      };
      segments.push(row);
      if (record.conditions?.length) {
        for (const c of record.conditions) {
          conditions.push({
            id: randomUUID(),
            segment_id: row.id,
            condition_type: c.conditionType,
            operator: c.operator,
            value: c.value,
            created_at: now(),
          });
        }
      }
      if (record.segmentType === "static" && record.memberCustomerIds?.length) {
        for (const customerId of record.memberCustomerIds) {
          members.push({ id: randomUUID(), segment_id: row.id, customer_id: customerId, added_at: now() });
        }
      }
      return row;
    },
    async update(id, record: UpdateSegmentRecord) {
      const row = segments.find((s) => s.id === id && !s.deleted_at);
      if (!row) return null;
      if (record.name !== undefined) row.name = record.name;
      if (record.description !== undefined) row.description = record.description;
      if (record.isActive !== undefined) row.is_active = record.isActive;
      if (record.conditions !== undefined) {
        const remaining = conditions.filter((c) => c.segment_id !== id);
        conditions.length = 0;
        conditions.push(...remaining);
        for (const c of record.conditions) {
          conditions.push({
            id: randomUUID(),
            segment_id: id,
            condition_type: c.conditionType,
            operator: c.operator,
            value: c.value,
            created_at: now(),
          });
        }
      }
      row.updated_at = now();
      return row;
    },
    async softDelete(id) {
      const row = segments.find((s) => s.id === id && !s.deleted_at);
      if (!row) return false;
      row.deleted_at = now();
      return true;
    },
    async touchLastEvaluatedAt(id) {
      const row = segments.find((s) => s.id === id);
      if (row) row.last_evaluated_at = now();
    },

    async listConditions(segmentId) {
      return conditions.filter((c) => c.segment_id === segmentId);
    },
    async replaceConditions(segmentId, newConditions) {
      const remaining = conditions.filter((c) => c.segment_id !== segmentId);
      conditions.length = 0;
      conditions.push(...remaining);
      const created = (newConditions ?? []).map((c) => ({
        id: randomUUID(),
        segment_id: segmentId,
        condition_type: c.conditionType,
        operator: c.operator,
        value: c.value,
        created_at: now(),
      }));
      conditions.push(...created);
      return created;
    },

    async listMembers(segmentId, params) {
      return paginate(
        members.filter((m) => m.segment_id === segmentId).sort((a, b) => (a.added_at < b.added_at ? 1 : -1)),
        params,
      );
    },
    async countMembers(segmentId) {
      return members.filter((m) => m.segment_id === segmentId).length;
    },
    async replaceMembers(segmentId, customerIds) {
      const remaining = members.filter((m) => m.segment_id !== segmentId);
      members.length = 0;
      members.push(...remaining);
      for (const customerId of customerIds) {
        members.push({ id: randomUUID(), segment_id: segmentId, customer_id: customerId, added_at: now() });
      }
    },
    async addMembers(segmentId, customerIds) {
      for (const customerId of customerIds) {
        if (!members.some((m) => m.segment_id === segmentId && m.customer_id === customerId)) {
          members.push({ id: randomUUID(), segment_id: segmentId, customer_id: customerId, added_at: now() });
        }
      }
    },
    async removeMembers(segmentId, customerIds) {
      const toRemove = new Set(customerIds);
      const remaining = members.filter((m) => !(m.segment_id === segmentId && toRemove.has(m.customer_id)));
      members.length = 0;
      members.push(...remaining);
    },
    async listAllMemberCustomerIds(segmentId) {
      return members.filter((m) => m.segment_id === segmentId).map((m) => m.customer_id);
    },
  };
}
