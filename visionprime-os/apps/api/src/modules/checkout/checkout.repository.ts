import {
  ListReservationsParams,
  ListReservationsResult,
  NewRewardReservationRecord,
  NewWalletReservationRecord,
  RewardReservationRow,
  WalletReservationRow,
} from "./checkout.types";

export interface WalletReservationRepository {
  findActiveByCartKey(cartKey: string): Promise<WalletReservationRow | null>;
  findById(id: string): Promise<WalletReservationRow | null>;

  /** Sum of amount_cents across all *active* reservations for this wallet,
   * optionally excluding one cart key (used when re-validating/re-reserving
   * the same cart with a different amount). */
  sumActiveReservedAmount(walletId: string, excludeCartKey?: string): Promise<number>;

  /** Creates a new active reservation. Callers must have already checked
   * for an existing active reservation on the same cart_key — the unique
   * index is the last line of defense, not the primary check. */
  create(record: NewWalletReservationRecord): Promise<WalletReservationRow>;

  markReleased(id: string): Promise<WalletReservationRow>;
  markExpired(id: string): Promise<WalletReservationRow>;

  /** Atomically: re-checks the reservation is still active and not
   * expired, records the wallet ledger debit, marks the reservation
   * confirmed with the resulting ledger_entry_id — all in one transaction.
   * Idempotent: calling confirm twice on an already-confirmed reservation
   * returns the original result without writing a second ledger entry. */
  confirmWithLedgerDebit(
    reservation: WalletReservationRow,
    debit: (reservation: WalletReservationRow) => Promise<{ entryId: string }>,
  ): Promise<WalletReservationRow>;

  listAll(params: ListReservationsParams): Promise<ListReservationsResult<WalletReservationRow>>;
  listByCustomer(
    customerId: string,
    params: ListReservationsParams,
  ): Promise<ListReservationsResult<WalletReservationRow>>;
}

export interface RewardReservationRepository {
  findActiveByCartKey(cartKey: string): Promise<RewardReservationRow | null>;
  findById(id: string): Promise<RewardReservationRow | null>;
  create(record: NewRewardReservationRecord): Promise<RewardReservationRow>;
  markReleased(id: string): Promise<RewardReservationRow>;
  markConfirmed(id: string): Promise<RewardReservationRow>;
  markExpired(id: string): Promise<RewardReservationRow>;
  listAll(params: ListReservationsParams): Promise<ListReservationsResult<RewardReservationRow>>;
  listByCustomer(
    customerId: string,
    params: ListReservationsParams,
  ): Promise<ListReservationsResult<RewardReservationRow>>;
}
