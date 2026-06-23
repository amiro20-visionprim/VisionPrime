import { Db } from "@visionprime/database";
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

export function createDbAuditLogRepository(db: Db): AuditLogRepository {
  return {
    async insert(entry: NewAuditLog): Promise<AuditLogRow> {
      const result = await db.query<AuditLogRow>(
        `insert into audit_logs (actor_id, action, target_type, target_id, before, after, ip_address, user_agent)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         returning *`,
        [
          entry.actorId,
          entry.action,
          entry.targetType,
          entry.targetId ?? null,
          entry.before !== undefined ? JSON.stringify(entry.before) : null,
          entry.after !== undefined ? JSON.stringify(entry.after) : null,
          entry.ipAddress ?? null,
          entry.userAgent ?? null,
        ],
      );
      return result.rows[0];
    },

    async list(params: PageParams): Promise<ListPage<AuditLogRow>> {
      const offset = (params.page - 1) * params.pageSize;
      const [rowsResult, countResult] = await Promise.all([
        db.query<AuditLogRow>(`select * from audit_logs order by created_at desc limit $1 offset $2`, [
          params.pageSize,
          offset,
        ]),
        db.query<{ count: string }>(`select count(*)::text as count from audit_logs`),
      ]);
      return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0]?.count ?? 0) };
    },
  };
}

export function createDbActivityLogRepository(db: Db): ActivityLogRepository {
  return {
    async insert(entry: NewActivityLog): Promise<ActivityLogRow> {
      const result = await db.query<ActivityLogRow>(
        `insert into activity_logs (actor_id, action, metadata, ip_address)
         values ($1, $2, $3, $4)
         returning *`,
        [entry.actorId, entry.action, JSON.stringify(entry.metadata ?? {}), entry.ipAddress ?? null],
      );
      return result.rows[0];
    },

    async list(params: PageParams): Promise<ListPage<ActivityLogRow>> {
      const offset = (params.page - 1) * params.pageSize;
      const [rowsResult, countResult] = await Promise.all([
        db.query<ActivityLogRow>(`select * from activity_logs order by created_at desc limit $1 offset $2`, [
          params.pageSize,
          offset,
        ]),
        db.query<{ count: string }>(`select count(*)::text as count from activity_logs`),
      ]);
      return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0]?.count ?? 0) };
    },
  };
}

export function createDbSecurityEventRepository(db: Db): SecurityEventRepository {
  return {
    async insert(entry: NewSecurityEvent): Promise<SecurityEventRow> {
      const result = await db.query<SecurityEventRow>(
        `insert into security_events (type, severity, user_id, email, ip_address, user_agent, metadata)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning *`,
        [
          entry.type,
          entry.severity ?? "medium",
          entry.userId ?? null,
          entry.email ?? null,
          entry.ipAddress ?? null,
          entry.userAgent ?? null,
          JSON.stringify(entry.metadata ?? {}),
        ],
      );
      return result.rows[0];
    },

    async list(params: PageParams): Promise<ListPage<SecurityEventRow>> {
      const offset = (params.page - 1) * params.pageSize;
      const [rowsResult, countResult] = await Promise.all([
        db.query<SecurityEventRow>(`select * from security_events order by created_at desc limit $1 offset $2`, [
          params.pageSize,
          offset,
        ]),
        db.query<{ count: string }>(`select count(*)::text as count from security_events`),
      ]);
      return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0]?.count ?? 0) };
    },
  };
}
