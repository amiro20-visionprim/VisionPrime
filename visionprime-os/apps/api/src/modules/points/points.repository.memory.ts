import { randomUUID } from "crypto";
import { HttpError } from "../../common/http-error";
import { PointsRepository } from "./points.repository";
import { NewPointsLedgerEntryRecord, PointsLedgerEntryRow, RecordPointsEntryResult } from "./points.types";

/** Per-customer mutex — in-memory analogue of the DB transaction, so two
 * concurrent debits can't both read a stale balance and both succeed. */
function createMutex() {
  const locks = new Map<string, Promise<unknown>>();
  return function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prior = locks.get(key) ?? Promise.resolve();
    const run = prior.then(fn, fn);
    locks.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  };
}

export function createMemoryPointsRepository(): PointsRepository {
  const entries: PointsLedgerEntryRow[] = [];
  const withLock = createMutex();

  function balance(customerId: string): number {
    return entries
      .filter((e) => e.customer_id === customerId)
      .reduce((sum, e) => sum + (e.direction === "credit" ? e.points : -e.points), 0);
  }

  return {
    async getBalance(customerId) {
      return balance(customerId);
    },

    async listLedgerByCustomer(customerId, params) {
      const rows = entries
        .filter((e) => e.customer_id === customerId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      const start = (params.page - 1) * params.pageSize;
      return { rows: rows.slice(start, start + params.pageSize), totalItems: rows.length };
    },

    async findLedgerEntryById(id) {
      return entries.find((e) => e.id === id) ?? null;
    },

    async findLedgerEntryByIdempotencyKey(key) {
      return entries.find((e) => e.idempotency_key === key) ?? null;
    },

    async findReversalOf(entryId) {
      return entries.find((e) => e.reversed_entry_id === entryId) ?? null;
    },

    async recordEntry(record: NewPointsLedgerEntryRecord): Promise<RecordPointsEntryResult> {
      return withLock(record.customerId, async () => {
        if (record.idempotencyKey) {
          const existing = entries.find((e) => e.idempotency_key === record.idempotencyKey);
          if (existing) {
            return { entry: existing, balance: balance(record.customerId), idempotentReplay: true };
          }
        }

        const currentBalance = balance(record.customerId);
        if (record.direction === "debit" && record.points > currentBalance) {
          throw new HttpError(422, "INSUFFICIENT_POINTS", "This action requires more points than the customer has.", {
            availablePoints: currentBalance,
            requestedPoints: record.points,
          });
        }

        const entry: PointsLedgerEntryRow = {
          id: randomUUID(),
          customer_id: record.customerId,
          type: record.type,
          direction: record.direction,
          points: record.points,
          reason: record.reason,
          reference_type: record.referenceType ?? null,
          reference_id: record.referenceId ?? null,
          idempotency_key: record.idempotencyKey ?? null,
          reversed_entry_id: record.reversedEntryId ?? null,
          metadata: record.metadata ?? {},
          created_by_user_id: record.createdByUserId ?? null,
          created_at: new Date().toISOString(),
        };
        entries.push(entry);

        const newBalance = currentBalance + (record.direction === "credit" ? record.points : -record.points);
        return { entry, balance: newBalance, idempotentReplay: false };
      });
    },
  };
}
