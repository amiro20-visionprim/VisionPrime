import { HttpError, NotFoundError } from "../../common/http-error";
import { toPaginationMeta } from "../audit/audit.service";
import { AuditService } from "../audit/audit.service";
import { WalletRepository } from "./wallet.repository";
import {
  DEFAULT_WALLET_CURRENCY,
  PublicWallet,
  toCents,
  toPublicWallet,
  WalletLedgerEntryRow,
  WalletLiabilityReport,
} from "./wallet.types";

export interface WalletActor {
  userId: string;
}

export interface ManualEntryInput {
  amount: number;
  reason: string;
  internalNote?: string;
  referenceType?: string;
  referenceId?: string;
}

export interface WalletServiceDeps {
  walletRepository: WalletRepository;
  auditService: AuditService;
  /** Resolves a customer's display name for audit logs; injected to avoid
   * the wallet module importing the customers module directly. */
  getCustomerName?: (customerId: string) => Promise<string | null>;
  /** Fires the `wallet_credited` automation trigger after a manual
   * credit. Never invoked for automation-driven credits themselves
   * (those call manualCredit with skipAutomationTrigger=true) — this is
   * the loop-prevention guard described in the Phase 12 binding rules. */
  onWalletCredited?: (params: { customerId: string; amount: number; ledgerEntryId: string }) => void | Promise<void>;
}

export class WalletService {
  constructor(private readonly deps: WalletServiceDeps) {}

  private async getOrCreateWallet(customerId: string) {
    return this.deps.walletRepository.getOrCreateForCustomer(customerId, DEFAULT_WALLET_CURRENCY);
  }

  async getWalletSummary(customerId: string): Promise<PublicWallet> {
    const wallet = await this.getOrCreateWallet(customerId);
    const balanceCents = await this.deps.walletRepository.getBalanceCents(wallet.id);
    return toPublicWallet(wallet, balanceCents);
  }

  async listLedger(customerId: string, page: number, pageSize: number) {
    const result = await this.deps.walletRepository.listLedgerByCustomer(customerId, { page, pageSize });
    return { rows: result.rows, meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  /**
   * `skipAutomationTrigger` is set internally by automation's own
   * add_cashback action dispatch so that automation-driven credits never
   * re-fire the `wallet_credited` trigger — only genuine manual/admin
   * credits do. This is the loop-prevention mechanism described in the
   * Phase 12 binding rules.
   */
  async manualCredit(customerId: string, input: ManualEntryInput, actor: WalletActor, skipAutomationTrigger = false) {
    const result = await this.recordManualEntry(customerId, "credit", "manual_credit", input, actor);
    if (!skipAutomationTrigger && this.deps.onWalletCredited) {
      try {
        await this.deps.onWalletCredited({ customerId, amount: input.amount, ledgerEntryId: result.entry.id });
      } catch {
        // Trigger dispatch failures must never surface as a wallet API error.
      }
    }
    return result;
  }

  async manualDebit(customerId: string, input: ManualEntryInput, actor: WalletActor) {
    return this.recordManualEntry(customerId, "debit", "manual_debit", input, actor);
  }

  private async recordManualEntry(
    customerId: string,
    direction: "credit" | "debit",
    type: "manual_credit" | "manual_debit",
    input: ManualEntryInput,
    actor: WalletActor,
  ) {
    const wallet = await this.getOrCreateWallet(customerId);
    const amountCents = toCents(input.amount);
    const idempotencyKey = input.referenceId
      ? `${type}:${input.referenceType ?? "manual"}:${input.referenceId}`
      : null;

    const result = await this.deps.walletRepository.recordLedgerEntry({
      walletId: wallet.id,
      customerId,
      type,
      direction,
      amountCents,
      currency: wallet.currency,
      reason: input.reason,
      internalNote: input.internalNote ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      idempotencyKey,
      createdByUserId: actor.userId,
    });

    if (!result.idempotentReplay) {
      await this.deps.auditService.recordAuditLog({
        actorId: actor.userId,
        action: `wallet.${type}`,
        targetType: "wallet_ledger_entry",
        targetId: result.entry.id,
        before: null,
        after: { entry: result.entry, balanceCents: result.balanceCents },
      });
    }

    return { entry: result.entry, balanceCents: result.balanceCents };
  }

  async reverseEntry(entryId: string, reason: string, actor: WalletActor) {
    const original = await this.deps.walletRepository.findLedgerEntryById(entryId);
    if (!original) {
      throw new NotFoundError("Ledger entry not found");
    }
    if (original.type === "reversal") {
      throw new HttpError(422, "CANNOT_REVERSE_REVERSAL", "A reversal entry cannot itself be reversed.");
    }
    const existingReversal = await this.deps.walletRepository.findReversalOf(entryId);
    if (existingReversal) {
      throw new HttpError(409, "ALREADY_REVERSED", "This ledger entry has already been reversed.", {
        reversalEntryId: existingReversal.id,
      });
    }

    const oppositeDirection = original.direction === "credit" ? "debit" : "credit";
    const result = await this.deps.walletRepository.recordLedgerEntry({
      walletId: original.wallet_id,
      customerId: original.customer_id,
      type: "reversal",
      direction: oppositeDirection,
      amountCents: original.amount_cents,
      currency: original.currency,
      reason,
      referenceType: original.reference_type,
      referenceId: original.reference_id,
      idempotencyKey: `reversal:${entryId}`,
      reversedEntryId: entryId,
      createdByUserId: actor.userId,
    });

    if (!result.idempotentReplay) {
      await this.deps.auditService.recordAuditLog({
        actorId: actor.userId,
        action: "wallet.reverse",
        targetType: "wallet_ledger_entry",
        targetId: result.entry.id,
        before: { entry: original },
        after: { entry: result.entry, balanceCents: result.balanceCents },
      });
    }

    return { entry: result.entry, balanceCents: result.balanceCents };
  }

  async applyCashbackForOrder(params: {
    customerId: string;
    woocommerceOrderId: string;
    orderTotalMajorUnits: number;
    currency?: string;
  }): Promise<WalletLedgerEntryRow | null> {
    const rule = await this.deps.walletRepository.findActiveCashbackRule();
    if (!rule) return null;
    const percentage = Number((rule.config as { percentage?: number }).percentage ?? 0);
    if (!percentage || percentage <= 0) return null;

    const amountCents = Math.round(toCents(params.orderTotalMajorUnits) * (percentage / 100));
    if (amountCents <= 0) return null;

    const wallet = await this.getOrCreateWallet(params.customerId);
    const idempotencyKey = `cashback:order:${params.woocommerceOrderId}`;
    const result = await this.deps.walletRepository.recordLedgerEntry({
      walletId: wallet.id,
      customerId: params.customerId,
      type: "cashback",
      direction: "credit",
      amountCents,
      currency: params.currency ?? wallet.currency,
      reason: `Cashback for order ${params.woocommerceOrderId}`,
      referenceType: "woocommerce_order",
      referenceId: params.woocommerceOrderId,
      idempotencyKey,
    });

    if (!result.idempotentReplay) {
      await this.deps.auditService.recordAuditLog({
        actorId: null,
        action: "wallet.cashback",
        targetType: "wallet_ledger_entry",
        targetId: result.entry.id,
        before: null,
        after: { entry: result.entry, balanceCents: result.balanceCents },
      });
    }

    return result.entry;
  }

  async reverseCashbackForOrder(woocommerceOrderId: string): Promise<WalletLedgerEntryRow | null> {
    const idempotencyKey = `cashback:order:${woocommerceOrderId}`;
    const cashbackEntry = await this.deps.walletRepository.findLedgerEntryByIdempotencyKey(idempotencyKey);
    if (!cashbackEntry) return null;

    const existingReversal = await this.deps.walletRepository.findReversalOf(cashbackEntry.id);
    if (existingReversal) return existingReversal;

    const result = await this.deps.walletRepository.recordLedgerEntry({
      walletId: cashbackEntry.wallet_id,
      customerId: cashbackEntry.customer_id,
      type: "reversal",
      direction: "debit",
      amountCents: cashbackEntry.amount_cents,
      currency: cashbackEntry.currency,
      reason: `Reversal of cashback for order ${woocommerceOrderId}`,
      referenceType: cashbackEntry.reference_type,
      referenceId: cashbackEntry.reference_id,
      idempotencyKey: `reversal:${cashbackEntry.id}`,
      reversedEntryId: cashbackEntry.id,
    });

    if (!result.idempotentReplay) {
      await this.deps.auditService.recordAuditLog({
        actorId: null,
        action: "wallet.reverse_cashback",
        targetType: "wallet_ledger_entry",
        targetId: result.entry.id,
        before: { entry: cashbackEntry },
        after: { entry: result.entry, balanceCents: result.balanceCents },
      });
    }

    return result.entry;
  }

  async getLiabilityReport(): Promise<WalletLiabilityReport> {
    const { totalCents, walletCount } = await this.deps.walletRepository.sumAllWalletBalances();
    return { totalLiabilityCents: totalCents, walletCount, currency: DEFAULT_WALLET_CURRENCY };
  }
}
