import { randomUUID } from "crypto";
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

/**
 * Serializes critical sections per wallet so concurrent calls in the same
 * process (e.g. two requests racing a manual debit) can't both read a
 * stale balance and both succeed — the in-memory analogue of the real
 * repository's DB transaction.
 */
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

export type MemoryWalletRepository = WalletRepository & { __seedRule: (rule: Partial<WalletRuleRow>) => void };

export function createMemoryWalletRepository(): MemoryWalletRepository {
  const wallets: WalletRow[] = [];
  const ledgerEntries: WalletLedgerEntryRow[] = [];
  const rules: WalletRuleRow[] = [];
  const expirations: WalletExpirationRow[] = [];
  const withLock = createMutex();

  function balanceCents(walletId: string): number {
    return ledgerEntries
      .filter((e) => e.wallet_id === walletId)
      .reduce((sum, e) => sum + (e.direction === "credit" ? e.amount_cents : -e.amount_cents), 0);
  }

  return {
    async findByCustomerId(customerId) {
      return wallets.find((w) => w.customer_id === customerId) ?? null;
    },

    async getOrCreateForCustomer(customerId, currency) {
      const existing = wallets.find((w) => w.customer_id === customerId);
      if (existing) return existing;
      const now = new Date().toISOString();
      const created: WalletRow = {
        id: randomUUID(),
        customer_id: customerId,
        currency,
        status: "active",
        created_at: now,
        updated_at: now,
      };
      wallets.push(created);
      return created;
    },

    async getBalanceCents(walletId) {
      return balanceCents(walletId);
    },

    async listLedgerByCustomer(customerId, params) {
      const rows = ledgerEntries
        .filter((e) => e.customer_id === customerId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      const start = (params.page - 1) * params.pageSize;
      return { rows: rows.slice(start, start + params.pageSize), totalItems: rows.length };
    },

    async findLedgerEntryById(id) {
      return ledgerEntries.find((e) => e.id === id) ?? null;
    },

    async findLedgerEntryByIdempotencyKey(key) {
      return ledgerEntries.find((e) => e.idempotency_key === key) ?? null;
    },

    async findReversalOf(entryId) {
      return ledgerEntries.find((e) => e.reversed_entry_id === entryId) ?? null;
    },

    async recordLedgerEntry(record: NewLedgerEntryRecord): Promise<RecordLedgerEntryResult> {
      return withLock(record.walletId, async () => {
        if (record.idempotencyKey) {
          const existing = ledgerEntries.find((e) => e.idempotency_key === record.idempotencyKey);
          if (existing) {
            return { entry: existing, balanceCents: balanceCents(record.walletId), idempotentReplay: true };
          }
        }

        const currentBalance = balanceCents(record.walletId);
        if (record.direction === "debit" && record.amountCents > currentBalance) {
          throw new HttpError(422, "INSUFFICIENT_BALANCE", "Debit exceeds the wallet's available balance.", {
            availableBalanceCents: currentBalance,
            requestedAmountCents: record.amountCents,
          });
        }

        const entry: WalletLedgerEntryRow = {
          id: randomUUID(),
          wallet_id: record.walletId,
          customer_id: record.customerId,
          type: record.type,
          direction: record.direction,
          amount_cents: record.amountCents,
          currency: record.currency,
          reason: record.reason,
          internal_note: record.internalNote ?? null,
          reference_type: record.referenceType ?? null,
          reference_id: record.referenceId ?? null,
          idempotency_key: record.idempotencyKey ?? null,
          reversed_entry_id: record.reversedEntryId ?? null,
          metadata: record.metadata ?? {},
          created_by_user_id: record.createdByUserId ?? null,
          created_at: new Date().toISOString(),
        };
        ledgerEntries.push(entry);

        const newBalance = currentBalance + (record.direction === "credit" ? record.amountCents : -record.amountCents);
        // Snapshot is an append-only cache derived from the ledger — never the source of truth.
        return { entry, balanceCents: newBalance, idempotentReplay: false };
      });
    },

    async findActiveCashbackRule() {
      return rules.find((r) => r.rule_type === "cashback_percentage" && r.is_active) ?? null;
    },

    async insertExpiration(record) {
      const row: WalletExpirationRow = {
        id: randomUUID(),
        wallet_id: record.walletId,
        ledger_entry_id: record.ledgerEntryId,
        amount_cents: record.amountCents,
        currency: record.currency,
        expires_at: record.expiresAt,
        status: "pending",
        created_at: new Date().toISOString(),
      };
      expirations.push(row);
      return row;
    },

    async sumAllWalletBalances() {
      const totalCents = wallets.reduce((sum, w) => sum + balanceCents(w.id), 0);
      return { totalCents, walletCount: wallets.length };
    },

    /** Test-only helper, not part of the WalletRepository interface. */
    __seedRule(rule: Partial<WalletRuleRow>) {
      rules.push({
        id: randomUUID(),
        name: rule.name ?? "Test rule",
        rule_type: rule.rule_type ?? "cashback_percentage",
        config: rule.config ?? {},
        is_active: rule.is_active ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    },
  } as MemoryWalletRepository;
}
