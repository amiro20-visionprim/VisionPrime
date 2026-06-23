import {
  ListLedgerParams,
  ListLedgerResult,
  NewLedgerEntryRecord,
  RecordLedgerEntryResult,
  WalletExpirationRow,
  WalletLedgerEntryRow,
  WalletRow,
  WalletRuleRow,
} from "./wallet.types";

export interface WalletRepository {
  findByCustomerId(customerId: string): Promise<WalletRow | null>;
  getOrCreateForCustomer(customerId: string, currency: string): Promise<WalletRow>;

  /** Current available balance, always derived from the ledger — never a stored column. */
  getBalanceCents(walletId: string): Promise<number>;

  listLedgerByCustomer(customerId: string, params: ListLedgerParams): Promise<ListLedgerResult>;
  findLedgerEntryById(id: string): Promise<WalletLedgerEntryRow | null>;
  findLedgerEntryByIdempotencyKey(key: string): Promise<WalletLedgerEntryRow | null>;
  findReversalOf(entryId: string): Promise<WalletLedgerEntryRow | null>;

  /**
   * The only way a ledger row is ever written. Atomic: checks the
   * idempotency key (if provided) and, for debits, the current balance,
   * then inserts the entry and a balance snapshot, all in one transaction
   * (or one critical section for the in-memory test double). Throws
   * INSUFFICIENT_BALANCE if a debit would exceed the current balance.
   */
  recordLedgerEntry(record: NewLedgerEntryRecord): Promise<RecordLedgerEntryResult>;

  findActiveCashbackRule(): Promise<WalletRuleRow | null>;

  insertExpiration(record: {
    walletId: string;
    ledgerEntryId: string;
    amountCents: number;
    currency: string;
    expiresAt: string;
  }): Promise<WalletExpirationRow>;

  /** Base for the finance liability report: total of all wallet balances. */
  sumAllWalletBalances(): Promise<{ totalCents: number; walletCount: number }>;
}
