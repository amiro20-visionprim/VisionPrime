import { HttpError } from "../../common/http-error";
import { AuditService } from "../audit/audit.service";
import { toPaginationMeta } from "../audit/audit.service";
import { WalletRepository } from "../wallet/wallet.repository";
import { toCents } from "../wallet/wallet.types";
import { RewardReservationRepository, WalletReservationRepository } from "./checkout.repository";
import {
  isExpired,
  PublicRewardReservation,
  PublicWalletReservation,
  RESERVATION_TTL_MS,
  RewardReservationRow,
  toPublicRewardReservation,
  toPublicWalletReservation,
  WalletReservationRow,
} from "./checkout.types";

export interface WalletValidateResult {
  valid: boolean;
  availableBalanceCents: number;
  maxUsableCents: number;
  message?: string;
}

export interface CheckoutServiceDeps {
  walletRepository: WalletRepository;
  walletReservationRepository: WalletReservationRepository;
  rewardReservationRepository: RewardReservationRepository;
  auditService: AuditService;
}

function newExpiresAt(): string {
  return new Date(Date.now() + RESERVATION_TTL_MS).toISOString();
}

/**
 * Checkout reservation model: a reservation HOLDS a customer's intent to
 * spend wallet credit (or, eventually, a reward) on a specific cart —
 * it never moves money by itself. Only confirm() does that, by writing
 * a normal wallet ledger debit. release()/expiry only ever change a
 * reservation's own status. See /docs/phase-09-checkout-wallet-reward-reservations.md.
 */
export class CheckoutService {
  constructor(private readonly deps: CheckoutServiceDeps) {}

  // ---------------------------------------------------------------- //
  // Wallet                                                            //
  // ---------------------------------------------------------------- //

  private async getOrCreateWallet(customerId: string) {
    return this.deps.walletRepository.getOrCreateForCustomer(customerId, "USD");
  }

  async validateWallet(customerId: string, cartKey: string, amountMajorUnits: number): Promise<WalletValidateResult> {
    const wallet = await this.getOrCreateWallet(customerId);
    const balanceCents = await this.deps.walletRepository.getBalanceCents(wallet.id);
    const reservedByOthers = await this.deps.walletReservationRepository.sumActiveReservedAmount(wallet.id, cartKey);
    const maxUsableCents = Math.max(0, balanceCents - reservedByOthers);
    const amountCents = toCents(amountMajorUnits);

    if (amountCents <= 0) {
      return { valid: false, availableBalanceCents: balanceCents, maxUsableCents, message: "Enter an amount greater than zero." };
    }
    if (amountCents > maxUsableCents) {
      return {
        valid: false,
        availableBalanceCents: balanceCents,
        maxUsableCents,
        message: "That amount exceeds your available wallet balance.",
      };
    }
    return { valid: true, availableBalanceCents: balanceCents, maxUsableCents };
  }

  /**
   * Idempotent by cart_key: a duplicate click with the SAME amount
   * returns the existing active reservation as-is. A call with a
   * DIFFERENT amount on the same cart releases the stale reservation
   * and creates a fresh one (the customer changed the amount in the
   * checkout field) — still only ever one active reservation per cart.
   */
  async reserveWallet(customerId: string, cartKey: string, amountMajorUnits: number): Promise<PublicWalletReservation> {
    const wallet = await this.getOrCreateWallet(customerId);
    const amountCents = toCents(amountMajorUnits);

    const existing = await this.deps.walletReservationRepository.findActiveByCartKey(cartKey);
    if (existing) {
      if (existing.amount_cents === amountCents) {
        return toPublicWalletReservation(existing);
      }
      await this.deps.walletReservationRepository.markReleased(existing.id);
    }

    const validation = await this.validateWallet(customerId, cartKey, amountMajorUnits);
    if (!validation.valid) {
      throw new HttpError(422, "INSUFFICIENT_BALANCE", validation.message ?? "That amount is not available.", {
        availableBalanceCents: validation.availableBalanceCents,
        maxUsableCents: validation.maxUsableCents,
      });
    }

    const created = await this.deps.walletReservationRepository.create({
      walletId: wallet.id,
      customerId,
      cartKey,
      amountCents,
      currency: wallet.currency,
      expiresAt: newExpiresAt(),
    });

    await this.deps.auditService.recordAuditLog({
      actorId: null,
      action: "wallet_reservation.reserve",
      targetType: "wallet_reservation",
      targetId: created.id,
      before: null,
      after: { reservation: created },
    });

    return toPublicWalletReservation(created);
  }

  /** Releases the active reservation for a cart, if any. Idempotent — a
   * cart with no active reservation (already released/expired/confirmed,
   * or never reserved) is not an error. Never touches the ledger. */
  async releaseWallet(cartKey: string): Promise<{ released: boolean }> {
    const existing = await this.deps.walletReservationRepository.findActiveByCartKey(cartKey);
    if (!existing) {
      return { released: false };
    }
    const released = await this.deps.walletReservationRepository.markReleased(existing.id);
    await this.deps.auditService.recordAuditLog({
      actorId: null,
      action: "wallet_reservation.release",
      targetType: "wallet_reservation",
      targetId: released.id,
      before: { reservation: existing },
      after: { reservation: released },
    });
    return { released: true };
  }

  /**
   * Confirms the active reservation for a cart by writing a wallet
   * ledger debit (transactional with the status flip — see
   * checkout.repository.{memory,db}.ts confirmWithLedgerDebit). Expired
   * reservations cannot be confirmed; an already-confirmed reservation
   * is returned as-is without writing a second debit.
   */
  async confirmWallet(cartKey: string, woocommerceOrderId: string): Promise<PublicWalletReservation> {
    const existing = await this.deps.walletReservationRepository.findActiveByCartKey(cartKey);
    if (!existing) {
      throw new HttpError(404, "RESERVATION_NOT_FOUND", "No active wallet reservation was found for this cart.");
    }
    if (isExpired(existing.expires_at)) {
      await this.deps.walletReservationRepository.markExpired(existing.id);
      throw new HttpError(409, "RESERVATION_EXPIRED", "This wallet reservation has expired. Please re-apply your wallet credit.");
    }

    const confirmed = await this.deps.walletReservationRepository.confirmWithLedgerDebit(
      existing,
      async (reservation: WalletReservationRow) => {
        const result = await this.deps.walletRepository.recordLedgerEntry({
          walletId: reservation.wallet_id,
          customerId: reservation.customer_id,
          type: "checkout_redemption",
          direction: "debit",
          amountCents: reservation.amount_cents,
          currency: reservation.currency,
          reason: `Wallet redeemed at checkout for order ${woocommerceOrderId}`,
          referenceType: "woocommerce_order",
          referenceId: woocommerceOrderId,
          idempotencyKey: `wallet_reservation_confirm:${reservation.id}`,
        });
        return { entryId: result.entry.id };
      },
    );

    await this.deps.auditService.recordAuditLog({
      actorId: null,
      action: "wallet_reservation.confirm",
      targetType: "wallet_reservation",
      targetId: confirmed.id,
      before: { reservation: existing },
      after: { reservation: confirmed },
    });

    return toPublicWalletReservation(confirmed);
  }

  /** Reversal flow for a refunded order: releases nothing (the
   * reservation is already confirmed/terminal) but reverses the wallet
   * ledger debit the confirm() call made, crediting the amount back. */
  async reverseConfirmedWallet(reservationId: string, reason: string): Promise<PublicWalletReservation> {
    const reservation = await this.deps.walletReservationRepository.findById(reservationId);
    if (!reservation) {
      throw new HttpError(404, "RESERVATION_NOT_FOUND", "Reservation not found.");
    }
    if (reservation.status !== "confirmed" || !reservation.ledger_entry_id) {
      throw new HttpError(409, "RESERVATION_NOT_CONFIRMED", "Only a confirmed reservation can be reversed.");
    }

    const original = await this.deps.walletRepository.findLedgerEntryById(reservation.ledger_entry_id);
    if (!original) {
      throw new HttpError(404, "NOT_FOUND", "Original ledger entry not found.");
    }
    const existingReversal = await this.deps.walletRepository.findReversalOf(original.id);
    if (!existingReversal) {
      const result = await this.deps.walletRepository.recordLedgerEntry({
        walletId: original.wallet_id,
        customerId: original.customer_id,
        type: "reversal",
        direction: "credit",
        amountCents: original.amount_cents,
        currency: original.currency,
        reason,
        referenceType: original.reference_type,
        referenceId: original.reference_id,
        idempotencyKey: `reversal:${original.id}`,
        reversedEntryId: original.id,
      });
      await this.deps.auditService.recordAuditLog({
        actorId: null,
        action: "wallet_reservation.reverse",
        targetType: "wallet_reservation",
        targetId: reservation.id,
        before: { reservation },
        after: { entry: result.entry },
      });
    }

    return toPublicWalletReservation(reservation);
  }

  async listWalletReservations(page: number, pageSize: number) {
    const result = await this.deps.walletReservationRepository.listAll({ page, pageSize });
    return { rows: result.rows.map(toPublicWalletReservation), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async listWalletReservationsByCustomer(customerId: string, page: number, pageSize: number) {
    const result = await this.deps.walletReservationRepository.listByCustomer(customerId, { page, pageSize });
    return { rows: result.rows.map(toPublicWalletReservation), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async getWalletReservation(id: string): Promise<PublicWalletReservation> {
    const row = await this.deps.walletReservationRepository.findById(id);
    if (!row) {
      throw new HttpError(404, "NOT_FOUND", "Reservation not found.");
    }
    return toPublicWalletReservation(row);
  }

  // ---------------------------------------------------------------- //
  // Reward (base structure only — no reward catalog/redemption module //
  // exists yet; every validate call is disabled until that ships).    //
  // ---------------------------------------------------------------- //

  async validateReward(_customerId: string, _cartKey: string, _rewardId?: string): Promise<{ enabled: false; valid: false; message: string }> {
    return { enabled: false, valid: false, message: "Rewards are not available yet." };
  }

  async reserveReward(_customerId: string, _cartKey: string, _rewardId?: string): Promise<never> {
    throw new HttpError(422, "REWARDS_NOT_ENABLED", "Rewards are not available yet.");
  }

  /** Idempotent no-op base — there is never an active reward reservation
   * to release yet, but the shape matches reserveWallet for when the
   * rewards module ships. */
  async releaseReward(cartKey: string): Promise<{ released: boolean }> {
    const existing = await this.deps.rewardReservationRepository.findActiveByCartKey(cartKey);
    if (!existing) {
      return { released: false };
    }
    await this.deps.rewardReservationRepository.markReleased(existing.id);
    return { released: true };
  }

  async confirmReward(_cartKey: string, _woocommerceOrderId: string): Promise<never> {
    throw new HttpError(422, "REWARDS_NOT_ENABLED", "Rewards are not available yet.");
  }

  async listRewardReservations(page: number, pageSize: number) {
    const result = await this.deps.rewardReservationRepository.listAll({ page, pageSize });
    return { rows: result.rows.map(toPublicRewardReservation), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async listRewardReservationsByCustomer(customerId: string, page: number, pageSize: number) {
    const result = await this.deps.rewardReservationRepository.listByCustomer(customerId, { page, pageSize });
    return { rows: result.rows.map(toPublicRewardReservation), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }
}
