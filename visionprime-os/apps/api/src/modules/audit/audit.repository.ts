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

/**
 * Append-only repositories: only `insert`/`list` are exposed. There is
 * intentionally no `update`/`delete` method — see
 * /docs/database-conventions.md §6.
 */
export interface AuditLogRepository {
  insert(entry: NewAuditLog): Promise<AuditLogRow>;
  list(params: PageParams): Promise<ListPage<AuditLogRow>>;
}

export interface ActivityLogRepository {
  insert(entry: NewActivityLog): Promise<ActivityLogRow>;
  list(params: PageParams): Promise<ListPage<ActivityLogRow>>;
}

export interface SecurityEventRepository {
  insert(entry: NewSecurityEvent): Promise<SecurityEventRow>;
  list(params: PageParams): Promise<ListPage<SecurityEventRow>>;
}
