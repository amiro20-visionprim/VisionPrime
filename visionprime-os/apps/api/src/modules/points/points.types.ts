export interface PointsLedgerEntryRow {
  id: string;
  customer_id: string;
  type: string;
  direction: "credit" | "debit";
  points: number;
  reason: string;
  reference_type: string | null;
  reference_id: string | null;
  idempotency_key: string | null;
  reversed_entry_id: string | null;
  metadata: Record<string, unknown>;
  created_by_user_id: string | null;
  created_at: string;
}

export interface NewPointsLedgerEntryRecord {
  customerId: string;
  type: string;
  direction: "credit" | "debit";
  points: number;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
  idempotencyKey?: string | null;
  reversedEntryId?: string | null;
  metadata?: Record<string, unknown>;
  createdByUserId?: string | null;
}

export interface RecordPointsEntryResult {
  entry: PointsLedgerEntryRow;
  balance: number;
  idempotentReplay: boolean;
}

export interface PublicPointsLedgerEntry {
  id: string;
  customerId: string;
  type: string;
  direction: "credit" | "debit";
  points: number;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  reversedEntryId: string | null;
  createdAt: string;
}

export interface PublicPointsBalance {
  customerId: string;
  balance: number;
  lifetimePoints: number;
}

export function toPublicPointsLedgerEntry(row: PointsLedgerEntryRow): PublicPointsLedgerEntry {
  return {
    id: row.id,
    customerId: row.customer_id,
    type: row.type,
    direction: row.direction,
    points: row.points,
    reason: row.reason,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    reversedEntryId: row.reversed_entry_id,
    createdAt: row.created_at,
  };
}

export interface ListLedgerParams {
  page: number;
  pageSize: number;
}

export interface ListLedgerResult {
  rows: PointsLedgerEntryRow[];
  totalItems: number;
}
