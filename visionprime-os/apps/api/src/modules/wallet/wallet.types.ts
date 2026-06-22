export const DEFAULT_WALLET_CURRENCY = "USD";

export type LedgerDirection = "credit" | "debit";

export const LEDGER_TYPES = ["manual_credit", "manual_debit", "cashback", "reversal", "expiration"] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

export interface WalletRow {
  id: string;
  customer_id: string;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface WalletLedgerEntryRow {
  id: string;
  wallet_id: string;
  customer_id: string;
  type: string;
  direction: LedgerDirection;
  amount_cents: number;
  currency: string;
  reason: string;
  internal_note: string | null;
  reference_type: string | null;
  reference_id: string | null;
  idempotency_key: string | null;
  reversed_entry_id: string | null;
  metadata: Record<string, unknown>;
  created_by_user_id: string | null;
  created_at: string;
}

export interface WalletBalanceSnapshotRow {
  id: string;
  wallet_id: string;
  ledger_entry_id: string;
  balance_cents: number;
  currency: string;
  created_at: string;
}

export interface WalletRuleRow {
  id: string;
  name: string;
  rule_type: string;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WalletExpirationRow {
  id: string;
  wallet_id: string;
  ledger_entry_id: string;
  amount_cents: number;
  currency: string;
  expires_at: string;
  status: string;
  created_at: string;
}

export interface NewLedgerEntryRecord {
  walletId: string;
  customerId: string;
  type: LedgerType;
  direction: LedgerDirection;
  amountCents: number;
  currency: string;
  reason: string;
  internalNote?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  idempotencyKey?: string | null;
  reversedEntryId?: string | null;
  metadata?: Record<string, unknown>;
  createdByUserId?: string | null;
}

export interface RecordLedgerEntryResult {
  entry: WalletLedgerEntryRow;
  balanceCents: number;
  /** True when an existing entry with the same idempotency_key was found
   * and returned as-is instead of creating a new row. */
  idempotentReplay: boolean;
}

export interface ListLedgerParams {
  page: number;
  pageSize: number;
}

export interface ListLedgerResult {
  rows: WalletLedgerEntryRow[];
  totalItems: number;
}

export interface WalletLiabilityReport {
  totalLiabilityCents: number;
  walletCount: number;
  currency: string;
}

export interface PublicWallet {
  id: string;
  customerId: string;
  currency: string;
  status: string;
  availableBalanceCents: number;
  createdAt: string;
  updatedAt: string;
}

export function toCents(amountMajorUnits: number): number {
  return Math.round(amountMajorUnits * 100);
}

export function toPublicWallet(wallet: WalletRow, availableBalanceCents: number): PublicWallet {
  return {
    id: wallet.id,
    customerId: wallet.customer_id,
    currency: wallet.currency,
    status: wallet.status,
    availableBalanceCents,
    createdAt: wallet.created_at,
    updatedAt: wallet.updated_at,
  };
}
