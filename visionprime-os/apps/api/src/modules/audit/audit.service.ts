import { PaginationMeta } from "@visionprime/shared";
import { ActivityLogRepository, AuditLogRepository, SecurityEventRepository } from "./audit.repository";
import {
  ActivityLogRow,
  AuditLogRow,
  NewActivityLog,
  NewAuditLog,
  NewSecurityEvent,
  SecurityEventRow,
} from "./audit.types";

export interface AuditDeps {
  auditLogRepository: AuditLogRepository;
  activityLogRepository: ActivityLogRepository;
  securityEventRepository: SecurityEventRepository;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function normalizePageParams(page?: unknown, pageSize?: unknown): { page: number; pageSize: number } {
  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedPageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE));
  return { page: parsedPage, pageSize: parsedPageSize };
}

export function toPaginationMeta(page: number, pageSize: number, totalItems: number): PaginationMeta {
  return { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) };
}

/**
 * Central audit/activity/security writer + reader service. All other
 * modules (auth, users, roles, business-settings) funnel their writes
 * through this service rather than touching the append-only tables
 * directly.
 */
export class AuditService {
  constructor(private readonly deps: AuditDeps) {}

  recordAuditLog(entry: NewAuditLog): Promise<AuditLogRow> {
    return this.deps.auditLogRepository.insert(entry);
  }

  recordActivityLog(entry: NewActivityLog): Promise<ActivityLogRow> {
    return this.deps.activityLogRepository.insert(entry);
  }

  recordSecurityEvent(entry: NewSecurityEvent): Promise<SecurityEventRow> {
    return this.deps.securityEventRepository.insert(entry);
  }

  async listAuditLogs(page: number, pageSize: number) {
    const result = await this.deps.auditLogRepository.list({ page, pageSize });
    return { rows: result.rows, meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async listActivityLogs(page: number, pageSize: number) {
    const result = await this.deps.activityLogRepository.list({ page, pageSize });
    return { rows: result.rows, meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async listSecurityEvents(page: number, pageSize: number) {
    const result = await this.deps.securityEventRepository.list({ page, pageSize });
    return { rows: result.rows, meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }
}
