import { randomUUID } from "crypto";
import { HttpError } from "../../common/http-error";
import { RewardReservationRepository, WalletReservationRepository } from "./checkout.repository";
import {
  NewRewardReservationRecord,
  NewWalletReservationRecord,
  RewardReservationRow,
  WalletReservationRow,
} from "./checkout.types";

/** Same per-key mutex pattern as wallet.repository.memory.ts — serializes
 * concurrent calls touching the same wallet so duplicate-click /
 * race-condition rules hold in tests without a real DB transaction. */
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

export function createMemoryWalletReservationRepository(): WalletReservationRepository {
  const reservations: WalletReservationRow[] = [];
  const withLock = createMutex();

  return {
    async findActiveByCartKey(cartKey) {
      return reservations.find((r) => r.cart_key === cartKey && r.status === "active") ?? null;
    },

    async findById(id) {
      return reservations.find((r) => r.id === id) ?? null;
    },

    async sumActiveReservedAmount(walletId, excludeCartKey) {
      return reservations
        .filter((r) => r.wallet_id === walletId && r.status === "active" && r.cart_key !== excludeCartKey)
        .reduce((sum, r) => sum + r.amount_cents, 0);
    },

    async create(record: NewWalletReservationRecord) {
      return withLock(record.cartKey, async () => {
        const existing = reservations.find((r) => r.cart_key === record.cartKey && r.status === "active");
        if (existing) {
          throw new HttpError(409, "RESERVATION_ALREADY_ACTIVE", "An active reservation already exists for this cart.", {
            reservationId: existing.id,
          });
        }
        const now = new Date().toISOString();
        const row: WalletReservationRow = {
          id: randomUUID(),
          wallet_id: record.walletId,
          customer_id: record.customerId,
          cart_key: record.cartKey,
          amount_cents: record.amountCents,
          currency: record.currency,
          status: "active",
          woocommerce_order_id: null,
          ledger_entry_id: null,
          expires_at: record.expiresAt,
          created_at: now,
          updated_at: now,
        };
        reservations.push(row);
        return row;
      });
    },

    async markReleased(id) {
      const row = reservations.find((r) => r.id === id);
      if (!row) throw new HttpError(404, "NOT_FOUND", "Reservation not found");
      row.status = "released";
      row.updated_at = new Date().toISOString();
      return row;
    },

    async markExpired(id) {
      const row = reservations.find((r) => r.id === id);
      if (!row) throw new HttpError(404, "NOT_FOUND", "Reservation not found");
      row.status = "expired";
      row.updated_at = new Date().toISOString();
      return row;
    },

    async confirmWithLedgerDebit(reservation, debit) {
      return withLock(reservation.wallet_id, async () => {
        const current = reservations.find((r) => r.id === reservation.id);
        if (!current) throw new HttpError(404, "NOT_FOUND", "Reservation not found");
        if (current.status === "confirmed") {
          return current;
        }
        if (current.status !== "active") {
          throw new HttpError(409, "RESERVATION_NOT_ACTIVE", "This reservation is no longer active.");
        }
        const { entryId } = await debit(current);
        current.status = "confirmed";
        current.ledger_entry_id = entryId;
        current.updated_at = new Date().toISOString();
        return current;
      });
    },

    async listAll(params) {
      const sorted = [...reservations].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      const start = (params.page - 1) * params.pageSize;
      return { rows: sorted.slice(start, start + params.pageSize), totalItems: sorted.length };
    },

    async listByCustomer(customerId, params) {
      const filtered = reservations
        .filter((r) => r.customer_id === customerId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      const start = (params.page - 1) * params.pageSize;
      return { rows: filtered.slice(start, start + params.pageSize), totalItems: filtered.length };
    },
  };
}

export function createMemoryRewardReservationRepository(): RewardReservationRepository {
  const reservations: RewardReservationRow[] = [];
  const withLock = createMutex();

  return {
    async findActiveByCartKey(cartKey) {
      return reservations.find((r) => r.cart_key === cartKey && r.status === "active") ?? null;
    },

    async findById(id) {
      return reservations.find((r) => r.id === id) ?? null;
    },

    async create(record: NewRewardReservationRecord) {
      return withLock(record.cartKey, async () => {
        const existing = reservations.find((r) => r.cart_key === record.cartKey && r.status === "active");
        if (existing) {
          throw new HttpError(409, "RESERVATION_ALREADY_ACTIVE", "An active reservation already exists for this cart.", {
            reservationId: existing.id,
          });
        }
        const now = new Date().toISOString();
        const row: RewardReservationRow = {
          id: randomUUID(),
          customer_id: record.customerId,
          cart_key: record.cartKey,
          reward_id: record.rewardId,
          status: "active",
          woocommerce_order_id: null,
          expires_at: record.expiresAt,
          created_at: now,
          updated_at: now,
        };
        reservations.push(row);
        return row;
      });
    },

    async markReleased(id) {
      const row = reservations.find((r) => r.id === id);
      if (!row) throw new HttpError(404, "NOT_FOUND", "Reservation not found");
      row.status = "released";
      row.updated_at = new Date().toISOString();
      return row;
    },

    async markConfirmed(id) {
      const row = reservations.find((r) => r.id === id);
      if (!row) throw new HttpError(404, "NOT_FOUND", "Reservation not found");
      row.status = "confirmed";
      row.updated_at = new Date().toISOString();
      return row;
    },

    async markExpired(id) {
      const row = reservations.find((r) => r.id === id);
      if (!row) throw new HttpError(404, "NOT_FOUND", "Reservation not found");
      row.status = "expired";
      row.updated_at = new Date().toISOString();
      return row;
    },

    async listAll(params) {
      const sorted = [...reservations].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      const start = (params.page - 1) * params.pageSize;
      return { rows: sorted.slice(start, start + params.pageSize), totalItems: sorted.length };
    },

    async listByCustomer(customerId, params) {
      const filtered = reservations
        .filter((r) => r.customer_id === customerId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      const start = (params.page - 1) * params.pageSize;
      return { rows: filtered.slice(start, start + params.pageSize), totalItems: filtered.length };
    },
  };
}
