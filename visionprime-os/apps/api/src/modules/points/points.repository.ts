import {
  ListLedgerParams,
  ListLedgerResult,
  NewPointsLedgerEntryRecord,
  PointsLedgerEntryRow,
  RecordPointsEntryResult,
} from "./points.types";

export interface PointsRepository {
  /** Current points balance, always derived from the ledger — never stored. */
  getBalance(customerId: string): Promise<number>;

  listLedgerByCustomer(customerId: string, params: ListLedgerParams): Promise<ListLedgerResult>;
  findLedgerEntryById(id: string): Promise<PointsLedgerEntryRow | null>;
  findLedgerEntryByIdempotencyKey(key: string): Promise<PointsLedgerEntryRow | null>;
  findReversalOf(entryId: string): Promise<PointsLedgerEntryRow | null>;

  /**
   * The only way a points ledger row is ever written. Atomic: checks the
   * idempotency key (if provided) and, for debits, the current balance,
   * then inserts the entry — all in one transaction (or one critical
   * section for the in-memory test double). Throws INSUFFICIENT_POINTS if
   * a debit would exceed the current balance.
   */
  recordEntry(record: NewPointsLedgerEntryRecord): Promise<RecordPointsEntryResult>;
}
