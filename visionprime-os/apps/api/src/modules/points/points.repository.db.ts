import { Db } from "@visionprime/database";
import { HttpError } from "../../common/http-error";
import { PointsRepository } from "./points.repository";
import { NewPointsLedgerEntryRecord, PointsLedgerEntryRow, RecordPointsEntryResult } from "./points.types";

async function pointsBalance(db: Db, customerId: string): Promise<number> {
  const result = await db.query<{ balance: string }>(
    `select coalesce(sum(case when direction = 'credit' then points else -points end), 0)::text as balance
     from points_ledger_entries where customer_id = $1`,
    [customerId],
  );
  return Number(result.rows[0]?.balance ?? 0);
}

export function createDbPointsRepository(db: Db): PointsRepository {
  return {
    async getBalance(customerId) {
      return pointsBalance(db, customerId);
    },

    async listLedgerByCustomer(customerId, params) {
      const offset = (params.page - 1) * params.pageSize;
      const [rowsResult, countResult] = await Promise.all([
        db.query<PointsLedgerEntryRow>(
          `select * from points_ledger_entries where customer_id = $1 order by created_at desc limit $2 offset $3`,
          [customerId, params.pageSize, offset],
        ),
        db.query<{ count: string }>(
          `select count(*)::text as count from points_ledger_entries where customer_id = $1`,
          [customerId],
        ),
      ]);
      return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0]?.count ?? 0) };
    },

    async findLedgerEntryById(id) {
      const result = await db.query<PointsLedgerEntryRow>(`select * from points_ledger_entries where id = $1`, [id]);
      return result.rows[0] ?? null;
    },

    async findLedgerEntryByIdempotencyKey(key) {
      const result = await db.query<PointsLedgerEntryRow>(
        `select * from points_ledger_entries where idempotency_key = $1`,
        [key],
      );
      return result.rows[0] ?? null;
    },

    async findReversalOf(entryId) {
      const result = await db.query<PointsLedgerEntryRow>(
        `select * from points_ledger_entries where reversed_entry_id = $1`,
        [entryId],
      );
      return result.rows[0] ?? null;
    },

    async recordEntry(record: NewPointsLedgerEntryRecord): Promise<RecordPointsEntryResult> {
      return db.withTransaction(async (tx) => {
        if (record.idempotencyKey) {
          const existing = await tx.query<PointsLedgerEntryRow>(
            `select * from points_ledger_entries where idempotency_key = $1`,
            [record.idempotencyKey],
          );
          if (existing.rows[0]) {
            return {
              entry: existing.rows[0],
              balance: await pointsBalance(tx, record.customerId),
              idempotentReplay: true,
            };
          }
        }

        const currentBalance = await pointsBalance(tx, record.customerId);
        if (record.direction === "debit" && record.points > currentBalance) {
          throw new HttpError(422, "INSUFFICIENT_POINTS", "This action requires more points than the customer has.", {
            availablePoints: currentBalance,
            requestedPoints: record.points,
          });
        }

        const inserted = await tx.query<PointsLedgerEntryRow>(
          `insert into points_ledger_entries
             (customer_id, type, direction, points, reason, reference_type, reference_id,
              idempotency_key, reversed_entry_id, metadata, created_by_user_id)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           returning *`,
          [
            record.customerId,
            record.type,
            record.direction,
            record.points,
            record.reason,
            record.referenceType ?? null,
            record.referenceId ?? null,
            record.idempotencyKey ?? null,
            record.reversedEntryId ?? null,
            JSON.stringify(record.metadata ?? {}),
            record.createdByUserId ?? null,
          ],
        );
        const entry = inserted.rows[0];
        const newBalance =
          currentBalance + (record.direction === "credit" ? record.points : -record.points);
        return { entry, balance: newBalance, idempotentReplay: false };
      });
    },
  };
}
