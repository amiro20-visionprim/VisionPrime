import { randomUUID } from "crypto";
import { ActivityLogRepository, AuditLogRepository, SecurityEventRepository } from "./audit.repository";
import {
  ActivityLogRow,
  AuditLogRow,
  ListPage,
  NewActivityLog,
  NewAuditLog,
  NewSecurityEvent,
  PageParams,
  SecurityEventRow,
} from "./audit.types";

export function createMemoryAuditLogRepository(): AuditLogRepository {
  const rows: AuditLogRow[] = [];
  return {
    async insert(entry: NewAuditLog): Promise<AuditLogRow> {
      const row: AuditLogRow = {
        id: randomUUID(),
        actor_id: entry.actorId,
        action: entry.action,
        target_type: entry.targetType,
        target_id: entry.targetId ?? null,
        before: entry.before ?? null,
        after: entry.after ?? null,
        ip_address: entry.ipAddress ?? null,
        user_agent: entry.userAgent ?? null,
        created_at: new Date().toISOString(),
      };
      rows.unshift(row);
      return row;
    },
    async list(params: PageParams): Promise<ListPage<AuditLogRow>> {
      const start = (params.page - 1) * params.pageSize;
      return { rows: rows.slice(start, start + params.pageSize), totalItems: rows.length };
    },
  };
}

export function createMemoryActivityLogRepository(): ActivityLogRepository {
  const rows: ActivityLogRow[] = [];
  return {
    async insert(entry: NewActivityLog): Promise<ActivityLogRow> {
      const row: ActivityLogRow = {
        id: randomUUID(),
        actor_id: entry.actorId,
        action: entry.action,
        metadata: entry.metadata ?? {},
        ip_address: entry.ipAddress ?? null,
        created_at: new Date().toISOString(),
      };
      rows.unshift(row);
      return row;
    },
    async list(params: PageParams): Promise<ListPage<ActivityLogRow>> {
      const start = (params.page - 1) * params.pageSize;
      return { rows: rows.slice(start, start + params.pageSize), totalItems: rows.length };
    },
  };
}

export function createMemorySecurityEventRepository(): SecurityEventRepository {
  const rows: SecurityEventRow[] = [];
  return {
    async insert(entry: NewSecurityEvent): Promise<SecurityEventRow> {
      const row: SecurityEventRow = {
        id: randomUUID(),
        type: entry.type,
        severity: entry.severity ?? "medium",
        user_id: entry.userId ?? null,
        email: entry.email ?? null,
        ip_address: entry.ipAddress ?? null,
        user_agent: entry.userAgent ?? null,
        metadata: entry.metadata ?? {},
        created_at: new Date().toISOString(),
      };
      rows.unshift(row);
      return row;
    },
    async list(params: PageParams): Promise<ListPage<SecurityEventRow>> {
      const start = (params.page - 1) * params.pageSize;
      return { rows: rows.slice(start, start + params.pageSize), totalItems: rows.length };
    },
  };
}
