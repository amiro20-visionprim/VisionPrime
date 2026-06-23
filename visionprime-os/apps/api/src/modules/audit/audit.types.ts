export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  before: unknown;
  after: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface NewAuditLog {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ActivityLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  metadata: unknown;
  ip_address: string | null;
  created_at: string;
}

export interface NewActivityLog {
  actorId: string | null;
  action: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

export interface SecurityEventRow {
  id: string;
  type: string;
  severity: string;
  user_id: string | null;
  email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: unknown;
  created_at: string;
}

export interface NewSecurityEvent {
  type: string;
  severity?: string;
  userId?: string | null;
  email?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ListPage<T> {
  rows: T[];
  totalItems: number;
}

export interface PageParams {
  page: number;
  pageSize: number;
}
