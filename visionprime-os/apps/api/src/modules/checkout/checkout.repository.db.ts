import { Db } from "@visionprime/database";
import { HttpError } from "../../common/http-error";
import { RewardReservationRepository, WalletReservationRepository } from "./checkout.repository";
import {
  NewRewardReservationRecord,
  NewWalletReservationRecord,
  RewardReservationRow,
  WalletReservationRow,
} from "./checkout.types";

export function createDbWalletReservationRepository(db: Db): WalletReservationRepository {
  return {
    async findActiveByCartKey(cartKey) {
      const result = await db.query<WalletReservationRow>(
        `select * from wallet_reservations where cart_key = $1 and status = 'active'`,
        [cartKey],
      );
      return result.rows[0] ?? null;
    },

    async findById(id) {
      const result = await db.query<WalletReservationRow>(`select * from wallet_reservations where id = $1`, [id]);
      return result.rows[0] ?? null;
    },

    async sumActiveReservedAmount(walletId, excludeCartKey) {
      const result = await db.query<{ total: string }>(
        `select coalesce(sum(amount_cents), 0)::text as total
         from wallet_reservations
         where wallet_id = $1 and status = 'active' and cart_key is distinct from $2`,
        [walletId, excludeCartKey ?? null],
      );
      return Number(result.rows[0]?.total ?? 0);
    },

    async create(record: NewWalletReservationRecord) {
      try {
        const result = await db.query<WalletReservationRow>(
          `insert into wallet_reservations (wallet_id, customer_id, cart_key, amount_cents, currency, expires_at)
           values ($1, $2, $3, $4, $5, $6)
           returning *`,
          [record.walletId, record.customerId, record.cartKey, record.amountCents, record.currency, record.expiresAt],
        );
        return result.rows[0];
      } catch (err) {
        // Unique violation on the partial "one active reservation per cart_key" index.
        if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
          throw new HttpError(409, "RESERVATION_ALREADY_ACTIVE", "An active reservation already exists for this cart.");
        }
        throw err;
      }
    },

    async markReleased(id) {
      const result = await db.query<WalletReservationRow>(
        `update wallet_reservations set status = 'released', updated_at = now() where id = $1 returning *`,
        [id],
      );
      if (!result.rows[0]) throw new HttpError(404, "NOT_FOUND", "Reservation not found");
      return result.rows[0];
    },

    async markExpired(id) {
      const result = await db.query<WalletReservationRow>(
        `update wallet_reservations set status = 'expired', updated_at = now() where id = $1 returning *`,
        [id],
      );
      if (!result.rows[0]) throw new HttpError(404, "NOT_FOUND", "Reservation not found");
      return result.rows[0];
    },

    async confirmWithLedgerDebit(reservation, debit) {
      return db.withTransaction(async (tx) => {
        const locked = await tx.query<WalletReservationRow>(
          `select * from wallet_reservations where id = $1 for update`,
          [reservation.id],
        );
        const current = locked.rows[0];
        if (!current) throw new HttpError(404, "NOT_FOUND", "Reservation not found");
        if (current.status === "confirmed") {
          return current;
        }
        if (current.status !== "active") {
          throw new HttpError(409, "RESERVATION_NOT_ACTIVE", "This reservation is no longer active.");
        }

        const { entryId } = await debit(current);

        const updated = await tx.query<WalletReservationRow>(
          `update wallet_reservations set status = 'confirmed', ledger_entry_id = $2, updated_at = now()
           where id = $1 returning *`,
          [current.id, entryId],
        );
        return updated.rows[0];
      });
    },

    async listAll(params) {
      const offset = (params.page - 1) * params.pageSize;
      const [rowsResult, countResult] = await Promise.all([
        db.query<WalletReservationRow>(
          `select * from wallet_reservations order by created_at desc limit $1 offset $2`,
          [params.pageSize, offset],
        ),
        db.query<{ count: string }>(`select count(*)::text as count from wallet_reservations`),
      ]);
      return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0]?.count ?? 0) };
    },

    async listByCustomer(customerId, params) {
      const offset = (params.page - 1) * params.pageSize;
      const [rowsResult, countResult] = await Promise.all([
        db.query<WalletReservationRow>(
          `select * from wallet_reservations where customer_id = $1 order by created_at desc limit $2 offset $3`,
          [customerId, params.pageSize, offset],
        ),
        db.query<{ count: string }>(`select count(*)::text as count from wallet_reservations where customer_id = $1`, [
          customerId,
        ]),
      ]);
      return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0]?.count ?? 0) };
    },
  };
}

export function createDbRewardReservationRepository(db: Db): RewardReservationRepository {
  return {
    async findActiveByCartKey(cartKey) {
      const result = await db.query<RewardReservationRow>(
        `select * from reward_reservations where cart_key = $1 and status = 'active'`,
        [cartKey],
      );
      return result.rows[0] ?? null;
    },

    async findById(id) {
      const result = await db.query<RewardReservationRow>(`select * from reward_reservations where id = $1`, [id]);
      return result.rows[0] ?? null;
    },

    async create(record: NewRewardReservationRecord) {
      try {
        const result = await db.query<RewardReservationRow>(
          `insert into reward_reservations (customer_id, cart_key, reward_id, expires_at)
           values ($1, $2, $3, $4)
           returning *`,
          [record.customerId, record.cartKey, record.rewardId, record.expiresAt],
        );
        return result.rows[0];
      } catch (err) {
        if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
          throw new HttpError(409, "RESERVATION_ALREADY_ACTIVE", "An active reservation already exists for this cart.");
        }
        throw err;
      }
    },

    async markReleased(id) {
      const result = await db.query<RewardReservationRow>(
        `update reward_reservations set status = 'released', updated_at = now() where id = $1 returning *`,
        [id],
      );
      if (!result.rows[0]) throw new HttpError(404, "NOT_FOUND", "Reservation not found");
      return result.rows[0];
    },

    async markConfirmed(id) {
      const result = await db.query<RewardReservationRow>(
        `update reward_reservations set status = 'confirmed', updated_at = now() where id = $1 returning *`,
        [id],
      );
      if (!result.rows[0]) throw new HttpError(404, "NOT_FOUND", "Reservation not found");
      return result.rows[0];
    },

    async markExpired(id) {
      const result = await db.query<RewardReservationRow>(
        `update reward_reservations set status = 'expired', updated_at = now() where id = $1 returning *`,
        [id],
      );
      if (!result.rows[0]) throw new HttpError(404, "NOT_FOUND", "Reservation not found");
      return result.rows[0];
    },

    async listAll(params) {
      const offset = (params.page - 1) * params.pageSize;
      const [rowsResult, countResult] = await Promise.all([
        db.query<RewardReservationRow>(
          `select * from reward_reservations order by created_at desc limit $1 offset $2`,
          [params.pageSize, offset],
        ),
        db.query<{ count: string }>(`select count(*)::text as count from reward_reservations`),
      ]);
      return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0]?.count ?? 0) };
    },

    async listByCustomer(customerId, params) {
      const offset = (params.page - 1) * params.pageSize;
      const [rowsResult, countResult] = await Promise.all([
        db.query<RewardReservationRow>(
          `select * from reward_reservations where customer_id = $1 order by created_at desc limit $2 offset $3`,
          [customerId, params.pageSize, offset],
        ),
        db.query<{ count: string }>(`select count(*)::text as count from reward_reservations where customer_id = $1`, [
          customerId,
        ]),
      ]);
      return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0]?.count ?? 0) };
    },
  };
}
