import { AuditService, toPaginationMeta } from "../audit/audit.service";
import { LoyaltyService } from "../loyalty/loyalty.service";
import { PointsRepository } from "./points.repository";
import { PointsLedgerEntryRow, PublicPointsBalance, toPublicPointsLedgerEntry } from "./points.types";

export interface PointsActor {
  userId: string;
}

export interface PointsServiceDeps {
  pointsRepository: PointsRepository;
  auditService: AuditService;
  /** Injected to avoid the points module importing the loyalty module's
   * repository directly; recomputes tier after a points award. */
  loyaltyService?: LoyaltyService;
}

export class PointsService {
  constructor(private readonly deps: PointsServiceDeps) {}

  async getBalance(customerId: string): Promise<PublicPointsBalance> {
    const balance = await this.deps.pointsRepository.getBalance(customerId);
    const lifetimePoints = await this.getLifetimePoints(customerId);
    return { customerId, balance, lifetimePoints };
  }

  private async getLifetimePoints(customerId: string): Promise<number> {
    if (!this.deps.loyaltyService) return 0;
    const status = await this.deps.loyaltyService.getCustomerStatus(customerId);
    return status.lifetimePoints;
  }

  async listLedger(customerId: string, page: number, pageSize: number) {
    const result = await this.deps.pointsRepository.listLedgerByCustomer(customerId, { page, pageSize });
    return {
      rows: result.rows.map(toPublicPointsLedgerEntry),
      meta: toPaginationMeta(page, pageSize, result.totalItems),
    };
  }

  /**
   * Points-on-purchase, awarded once per order via idempotency key
   * `points:order:${woocommerceOrderId}` — mirrors
   * WalletService.applyCashbackForOrder exactly.
   */
  async awardPointsForOrder(params: {
    customerId: string;
    woocommerceOrderId: string;
    orderTotalMajorUnits: number;
    pointsPerCurrencyUnit: number;
  }): Promise<PointsLedgerEntryRow | null> {
    const points = Math.round(params.orderTotalMajorUnits * params.pointsPerCurrencyUnit);
    if (points <= 0) return null;

    const idempotencyKey = `points:order:${params.woocommerceOrderId}`;
    const result = await this.deps.pointsRepository.recordEntry({
      customerId: params.customerId,
      type: "purchase",
      direction: "credit",
      points,
      reason: `Points for order ${params.woocommerceOrderId}`,
      referenceType: "woocommerce_order",
      referenceId: params.woocommerceOrderId,
      idempotencyKey,
    });

    if (!result.idempotentReplay) {
      await this.deps.auditService.recordAuditLog({
        actorId: null,
        action: "points.award",
        targetType: "points_ledger_entry",
        targetId: result.entry.id,
        before: null,
        after: { entry: result.entry, balance: result.balance },
      });
      if (this.deps.loyaltyService) {
        await this.deps.loyaltyService.recomputeTierForCustomer(params.customerId, points);
      }
    }

    return result.entry;
  }

  /** Refund/cancel reversal — mirrors WalletService.reverseCashbackForOrder. */
  async reversePointsForOrder(woocommerceOrderId: string): Promise<PointsLedgerEntryRow | null> {
    const idempotencyKey = `points:order:${woocommerceOrderId}`;
    const originalEntry = await this.deps.pointsRepository.findLedgerEntryByIdempotencyKey(idempotencyKey);
    if (!originalEntry) return null;

    const existingReversal = await this.deps.pointsRepository.findReversalOf(originalEntry.id);
    if (existingReversal) return existingReversal;

    const result = await this.deps.pointsRepository.recordEntry({
      customerId: originalEntry.customer_id,
      type: "reversal",
      direction: "debit",
      points: originalEntry.points,
      reason: `Reversal of points for order ${woocommerceOrderId}`,
      referenceType: originalEntry.reference_type,
      referenceId: originalEntry.reference_id,
      idempotencyKey: `reversal:${originalEntry.id}`,
      reversedEntryId: originalEntry.id,
    });

    if (!result.idempotentReplay) {
      await this.deps.auditService.recordAuditLog({
        actorId: null,
        action: "points.reverse",
        targetType: "points_ledger_entry",
        targetId: result.entry.id,
        before: { entry: originalEntry },
        after: { entry: result.entry, balance: result.balance },
      });
    }

    return result.entry;
  }

  /**
   * Generic manual points award, mirroring WalletService.manualCredit's
   * idempotency pattern. Used by automation's add_points action (and any
   * future manual admin "award points" UI). Recomputes tier via
   * loyaltyService unless this is an idempotent replay (replays must
   * never double-apply a tier recompute).
   */
  async awardManualPoints(
    customerId: string,
    points: number,
    reason: string,
    actor: PointsActor,
    idempotencyKey?: string,
  ): Promise<PointsLedgerEntryRow | null> {
    // Points awards have no separate "points_awarded" automation trigger
    // in the Phase 12 trigger set, so no loop-prevention flag is needed
    // here (unlike wallet_credited/reward_claimed).
    if (!points || points <= 0) return null;
    const key = idempotencyKey ? `manual_award:${idempotencyKey}` : null;
    const result = await this.deps.pointsRepository.recordEntry({
      customerId,
      type: "manual_award",
      direction: "credit",
      points,
      reason,
      referenceType: "manual",
      referenceId: idempotencyKey ?? null,
      idempotencyKey: key,
    });

    if (!result.idempotentReplay) {
      await this.deps.auditService.recordAuditLog({
        actorId: actor.userId,
        action: "points.manual_award",
        targetType: "points_ledger_entry",
        targetId: result.entry.id,
        before: null,
        after: { entry: result.entry, balance: result.balance },
      });
      if (this.deps.loyaltyService) {
        await this.deps.loyaltyService.recomputeTierForCustomer(customerId, points);
      }
    }

    return result.entry;
  }

  /** Used by RewardsService to deduct points on claim — never a direct
   * balance mutation, always a ledger debit. */
  async debitForRewardClaim(params: {
    customerId: string;
    points: number;
    rewardId: string;
    claimId: string;
  }) {
    return this.deps.pointsRepository.recordEntry({
      customerId: params.customerId,
      type: "reward_claim",
      direction: "debit",
      points: params.points,
      reason: `Points spent claiming reward ${params.rewardId}`,
      referenceType: "reward_claim",
      referenceId: params.claimId,
      idempotencyKey: `reward_claim:${params.claimId}`,
    });
  }
}
