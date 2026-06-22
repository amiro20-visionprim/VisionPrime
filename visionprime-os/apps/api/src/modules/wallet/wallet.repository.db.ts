import { Db } from "@visionprime/database";
import { HttpError } from "../../common/http-error";
import { WalletRepository } from "./wallet.repository";
import {
  NewLedgerEntryRecord,
  RecordLedgerEntryResult,
  WalletExpirationRow,
  WalletLedgerEntryRow,
  WalletRow,
  WalletRuleRow,
} from "./wallet.types";

async function balanceCents(db: Db, walletId: string): Promise<number> {
  const result = await db.query<{ balance: string }>(
    `select coalesce(sum(case when direction = 'credit' then amount_cents else -amount_cents end), 0)::text as balance
     from wallet_ledger_entries where wallet_id = $1`,
    [walletId],
  );
  return Number(result.rows[0]?.balance ?? 0);
}

export function createDbWalletRepository(db: Db): WalletRepository {
  return {
    async findByCustomerId(customerId) {
      const result = await db.query<WalletRow>(`select * from wallets where customer_id = $1`, [customerId]);
      return result.rows[0] ?? null;
    },

    async getOrCreateForCustomer(customerId, currency) {
      const existing = await db.query<WalletRow>(`select * from wallets where customer_id = $1`, [customerId]);
      if (existing.rows[0]) return existing.rows[0];
      const result = await db.query<WalletRow>(
        `insert into wallets (customer_id, currency) values ($1, $2)
         on conflict (customer_id) do update set customer_id = excluded.customer_id
         returning *`,
        [customerId, currency],
      );
      return result.rows[0];
    },

    async getBalanceCents(walletId) {
      return balanceCents(db, walletId);
    },

    async listLedgerByCustomer(customerId, params) {
      const offset = (params.page - 1) * params.pageSize;
      const [rowsResult, countResult] = await Promise.all([
        db.query<WalletLedgerEntryRow>(
          `select * from wallet_ledger_entries where customer_id = $1 order by created_at desc limit $2 offset $3`,
          [customerId, params.pageSize, offset],
        ),
        db.query<{ count: string }>(`select count(*)::text as count from wallet_ledger_entries where customer_id = $1`, [
          customerId,
        ]),
      ]);
      return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0]?.count ?? 0) };
    },

    async findLedgerEntryById(id) {
      const result = await db.query<WalletLedgerEntryRow>(`select * from wallet_ledger_entries where id = $1`, [id]);
      return result.rows[0] ?? null;
    },

    async findLedgerEntryByIdempotencyKey(key) {
      const result = await db.query<WalletLedgerEntryRow>(
        `select * from wallet_ledger_entries where idempotency_key = $1`,
        [key],
      );
      return result.rows[0] ?? null;
    },

    async findReversalOf(entryId) {
      const result = await db.query<WalletLedgerEntryRow>(
        `select * from wallet_ledger_entries where reversed_entry_id = $1`,
        [entryId],
      );
      return result.rows[0] ?? null;
    },

    async recordLedgerEntry(record: NewLedgerEntryRecord): Promise<RecordLedgerEntryResult> {
      return db.withTransaction(async (tx) => {
        if (record.idempotencyKey) {
          const existing = await tx.query<WalletLedgerEntryRow>(
            `select * from wallet_ledger_entries where idempotency_key = $1`,
            [record.idempotencyKey],
          );
          if (existing.rows[0]) {
            return {
              entry: existing.rows[0],
              balanceCents: await balanceCents(tx, record.walletId),
              idempotentReplay: true,
            };
          }
        }

        const currentBalance = await balanceCents(tx, record.walletId);
        if (record.direction === "debit" && record.amountCents > currentBalance) {
          throw new HttpError(422, "INSUFFICIENT_BALANCE", "Debit exceeds the wallet's available balance.", {
            availableBalanceCents: currentBalance,
            requestedAmountCents: record.amountCents,
          });
        }

        const inserted = await tx.query<WalletLedgerEntryRow>(
          `insert into wallet_ledger_entries
             (wallet_id, customer_id, type, direction, amount_cents, currency, reason, internal_note,
              reference_type, reference_id, idempotency_key, reversed_entry_id, metadata, created_by_user_id)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           returning *`,
          [
            record.walletId,
            record.customerId,
            record.type,
            record.direction,
            record.amountCents,
            record.currency,
            record.reason,
            record.internalNote ?? null,
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
          currentBalance + (record.direction === "credit" ? record.amountCents : -record.amountCents);
        await tx.query(
          `insert into wallet_balance_snapshots (wallet_id, ledger_entry_id, balance_cents, currency)
           values ($1, $2, $3, $4)`,
          [record.walletId, entry.id, newBalance, record.currency],
        );

        return { entry, balanceCents: newBalance, idempotentReplay: false };
      });
    },

    async findActiveCashbackRule() {
      const result = await db.query<WalletRuleRow>(
        `select * from wallet_rules where rule_type = 'cashback_percentage' and is_active = true limit 1`,
      );
      return result.rows[0] ?? null;
    },

    async insertExpiration(record) {
      const result = await db.query<WalletExpirationRow>(
        `insert into wallet_expirations (wallet_id, ledger_entry_id, amount_cents, currency, expires_at)
         values ($1, $2, $3, $4, $5)
         returning *`,
        [record.walletId, record.ledgerEntryId, record.amountCents, record.currency, record.expiresAt],
      );
      return result.rows[0];
    },

    async sumAllWalletBalances() {
      const result = await db.query<{ total: string; wallet_count: string }>(
        `select
           coalesce(sum(case when e.direction = 'credit' then e.amount_cents else -e.amount_cents end), 0)::text as total,
           (select count(*) from wallets)::text as wallet_count
         from wallet_ledger_entries e`,
      );
      return {
        totalCents: Number(result.rows[0]?.total ?? 0),
        walletCount: Number(result.rows[0]?.wallet_count ?? 0),
      };
    },
  };
}
