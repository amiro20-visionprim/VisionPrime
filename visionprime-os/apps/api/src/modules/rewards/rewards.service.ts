import { HttpError, NotFoundError } from "../../common/http-error";
import { AuditService, toPaginationMeta } from "../audit/audit.service";
import { RewardReservationRepository } from "../checkout/checkout.repository";
import { isExpired, RESERVATION_TTL_MS, RewardReservationRow } from "../checkout/checkout.types";
import { PointsService } from "../points/points.service";
import { RewardsRepository } from "./rewards.repository";
import {
  generateRewardCode,
  isClaimExpired,
  NewRewardRecord,
  RewardClaimRow,
  toPublicReward,
  toPublicRewardClaim,
  toPublicRewardRedemption,
  UpdateRewardRecord,
} from "./rewards.types";

export interface RewardsActor {
  userId: string;
}

export interface RewardsServiceDeps {
  rewardsRepository: RewardsRepository;
  rewardReservationRepository: RewardReservationRepository;
  pointsService: PointsService;
  auditService: AuditService;
  /** Fires the `reward_claimed` automation trigger after a claim is
   * created. Skipped when automation's own add_reward action calls
   * claimReward (see the `skipAutomationTrigger` parameter), preventing
   * an automation-driven claim from re-triggering itself. */
  onRewardClaimed?: (params: { customerId: string; rewardId: string; claimId: string }) => void | Promise<void>;
}

function newExpiresAt(): string {
  return new Date(Date.now() + RESERVATION_TTL_MS).toISOString();
}

export class RewardsService {
  constructor(private readonly deps: RewardsServiceDeps) {}

  // ---------------------------------------------------------------- //
  // Catalog
  // ---------------------------------------------------------------- //

  async listRewards(page: number, pageSize: number) {
    const result = await this.deps.rewardsRepository.listRewards({ page, pageSize });
    return { rows: result.rows.map(toPublicReward), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async getReward(id: string) {
    const row = await this.deps.rewardsRepository.findRewardById(id);
    if (!row) throw new NotFoundError("Reward not found");
    return toPublicReward(row);
  }

  async createReward(record: NewRewardRecord, actor: RewardsActor) {
    const row = await this.deps.rewardsRepository.createReward(record);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "reward.create",
      targetType: "reward",
      targetId: row.id,
      before: null,
      after: { reward: row },
    });
    return toPublicReward(row);
  }

  async updateReward(id: string, record: UpdateRewardRecord, actor: RewardsActor) {
    const before = await this.deps.rewardsRepository.findRewardById(id);
    if (!before) throw new NotFoundError("Reward not found");
    const after = await this.deps.rewardsRepository.updateReward(id, record);
    if (!after) throw new NotFoundError("Reward not found");
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "reward.update",
      targetType: "reward",
      targetId: id,
      before: { reward: before },
      after: { reward: after },
    });
    return toPublicReward(after);
  }

  async deleteReward(id: string, actor: RewardsActor) {
    const before = await this.deps.rewardsRepository.findRewardById(id);
    if (!before) throw new NotFoundError("Reward not found");
    await this.deps.rewardsRepository.softDeleteReward(id);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "reward.delete",
      targetType: "reward",
      targetId: id,
      before: { reward: before },
      after: null,
    });
  }

  async listClaims(page: number, pageSize: number, customerId?: string) {
    const result = await this.deps.rewardsRepository.listClaims({ page, pageSize }, customerId);
    return { rows: result.rows.map(toPublicRewardClaim), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async listRedemptions(page: number, pageSize: number, customerId?: string) {
    const result = await this.deps.rewardsRepository.listRedemptions({ page, pageSize }, customerId);
    return { rows: result.rows.map(toPublicRewardRedemption), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  // ---------------------------------------------------------------- //
  // Claim / redeem
  // ---------------------------------------------------------------- //

  /** "Duplicate claim prevented": once `maxClaims` total claims exist for
   * a reward, no further claim is accepted — same backstop concept as
   * the wallet/points idempotency keys, applied to a count instead of a
   * single key since a customer may legitimately claim a reward more
   * than once (unlike "points for this order"). */
  async claimReward(rewardId: string, customerId: string, actor?: RewardsActor, skipAutomationTrigger = false) {
    const reward = await this.deps.rewardsRepository.findRewardById(rewardId);
    if (!reward) throw new NotFoundError("Reward not found");
    if (!reward.is_active) {
      throw new HttpError(422, "REWARD_INACTIVE", "This reward is not currently available.");
    }
    if (reward.max_claims !== null) {
      const activeClaims = await this.deps.rewardsRepository.countActiveClaimsForReward(rewardId);
      if (activeClaims >= reward.max_claims) {
        throw new HttpError(409, "REWARD_CLAIM_LIMIT_REACHED", "This reward has reached its claim limit.");
      }
    }

    const expiresAt = new Date(Date.now() + reward.claim_validity_days * 24 * 60 * 60 * 1000).toISOString();
    const claim = await this.deps.rewardsRepository.createClaim({
      rewardId,
      customerId,
      expiresAt,
      pointsLedgerEntryId: null,
    });

    if (reward.points_cost > 0) {
      // Keyed by the just-created claim id, so a duplicate claim attempt
      // (e.g. a double-click race that slips past max_claims) can never
      // result in two point debits for the same claim.
      await this.deps.pointsService.debitForRewardClaim({
        customerId,
        points: reward.points_cost,
        rewardId,
        claimId: claim.id,
      });
    }

    await this.deps.auditService.recordAuditLog({
      actorId: actor?.userId ?? null,
      action: "reward_claim.create",
      targetType: "reward_claim",
      targetId: claim.id,
      before: null,
      after: { claim },
    });

    if (!skipAutomationTrigger && this.deps.onRewardClaimed) {
      try {
        await this.deps.onRewardClaimed({ customerId, rewardId, claimId: claim.id });
      } catch {
        // Trigger dispatch failures must never surface as a claim API error.
      }
    }

    return toPublicRewardClaim(claim);
  }

  /** Validates ownership, expiry, and not-already-redeemed before
   * transitioning the claim and writing the redemption row — the only
   * code path allowed to do so (mirrors the reservation `confirm()`
   * invariant: redeem is the one place financial/reward state changes). */
  private async redeemClaim(
    claimId: string,
    customerId: string,
    extra: { cartKey?: string | null; woocommerceOrderId?: string | null } = {},
  ): Promise<RewardClaimRow & { redemptionId: string }> {
    const claim = await this.deps.rewardsRepository.findClaimById(claimId);
    if (!claim) throw new NotFoundError("Reward claim not found");
    if (claim.customer_id !== customerId) {
      throw new HttpError(403, "REWARD_OWNERSHIP_INVALID", "This reward claim does not belong to this customer.");
    }
    if (claim.status === "redeemed") {
      throw new HttpError(409, "REWARD_ALREADY_REDEEMED", "This reward has already been redeemed.");
    }
    if (claim.status !== "claimed") {
      throw new HttpError(422, "REWARD_NOT_CLAIMED", "This reward claim is not in a redeemable state.");
    }
    if (isClaimExpired(claim)) {
      throw new HttpError(409, "REWARD_CLAIM_EXPIRED", "This reward claim has expired and can no longer be redeemed.");
    }

    const transitioned = await this.deps.rewardsRepository.transitionClaimStatus(claimId, "claimed", "redeemed");
    if (!transitioned) {
      throw new HttpError(409, "REWARD_ALREADY_REDEEMED", "This reward has already been redeemed.");
    }

    const redemption = await this.deps.rewardsRepository.createRedemption({
      rewardClaimId: claimId,
      rewardId: claim.reward_id,
      customerId,
      cartKey: extra.cartKey ?? null,
      woocommerceOrderId: extra.woocommerceOrderId ?? null,
    });

    const reward = await this.deps.rewardsRepository.findRewardById(claim.reward_id);
    if (reward?.reward_type === "coupon") {
      // WooCommerce coupon reward must map to a WooCommerce coupon. The
      // code is generated by VisionPrime, not WooCommerce; syncing it to
      // WooCommerce (woocommerce_coupon_id) is a follow-up step using the
      // existing WooCommerce API client — base structure only here.
      const code = await this.deps.rewardsRepository.createRewardCode({
        rewardRedemptionId: redemption.id,
        code: generateRewardCode(),
      });
      await this.deps.rewardsRepository.setRedemptionRewardCode(redemption.id, code.id);
    }

    await this.deps.auditService.recordAuditLog({
      actorId: null,
      action: "reward_redemption.create",
      targetType: "reward_redemption",
      targetId: redemption.id,
      before: { claim },
      after: { claim: transitioned, redemption },
    });

    return { ...transitioned, redemptionId: redemption.id };
  }

  /** Direct redeem (e.g. a free-item voucher redeemed outside checkout). */
  async redeemReward(claimId: string, customerId: string) {
    const result = await this.redeemClaim(claimId, customerId);
    return toPublicRewardClaim(result);
  }

  // ---------------------------------------------------------------- //
  // Checkout reward reservation — reservation only ever HOLDS intent;
  // confirm() is the only path that redeems the underlying claim.
  // release()/expiry never touch claim/points state.
  // ---------------------------------------------------------------- //

  async validateReward(customerId: string, cartKey: string, claimId?: string) {
    if (!claimId) {
      return { valid: false, message: "A reward claim id is required." };
    }
    const claim = await this.deps.rewardsRepository.findClaimById(claimId);
    if (!claim || claim.customer_id !== customerId) {
      return { valid: false, message: "Reward claim not found for this customer." };
    }
    if (claim.status !== "claimed" || isClaimExpired(claim)) {
      return { valid: false, message: "This reward claim is not available to apply." };
    }
    return { valid: true, message: "Reward is available to apply." };
  }

  async reserveReward(customerId: string, cartKey: string, claimId?: string): Promise<RewardReservationRow> {
    if (!claimId) {
      throw new HttpError(400, "VALIDATION_FAILED", "A reward claim id is required.");
    }
    const validation = await this.validateReward(customerId, cartKey, claimId);
    if (!validation.valid) {
      throw new HttpError(422, "REWARD_NOT_APPLICABLE", validation.message);
    }

    const existing = await this.deps.rewardReservationRepository.findActiveByCartKey(cartKey);
    if (existing && existing.reward_id === claimId) {
      return existing;
    }
    if (existing) {
      await this.deps.rewardReservationRepository.markReleased(existing.id);
    }

    const reservation = await this.deps.rewardReservationRepository.create({
      customerId,
      cartKey,
      rewardId: claimId,
      expiresAt: newExpiresAt(),
    });

    await this.deps.auditService.recordAuditLog({
      actorId: null,
      action: "reward_reservation.reserve",
      targetType: "reward_reservation",
      targetId: reservation.id,
      before: null,
      after: { reservation },
    });

    return reservation;
  }

  async releaseReward(cartKey: string): Promise<{ released: boolean }> {
    const existing = await this.deps.rewardReservationRepository.findActiveByCartKey(cartKey);
    if (!existing) {
      return { released: false };
    }
    await this.deps.rewardReservationRepository.markReleased(existing.id);
    await this.deps.auditService.recordAuditLog({
      actorId: null,
      action: "reward_reservation.release",
      targetType: "reward_reservation",
      targetId: existing.id,
      before: { reservation: existing },
      after: null,
    });
    return { released: true };
  }

  async confirmReward(cartKey: string, woocommerceOrderId: string): Promise<RewardReservationRow> {
    const reservation = await this.deps.rewardReservationRepository.findActiveByCartKey(cartKey);
    if (!reservation) {
      throw new HttpError(404, "RESERVATION_NOT_FOUND", "No active reward reservation found for this cart.");
    }
    if (isExpired(reservation.expires_at)) {
      throw new HttpError(409, "RESERVATION_EXPIRED", "This reward reservation has expired.");
    }
    if (!reservation.reward_id) {
      throw new HttpError(422, "REWARD_NOT_APPLICABLE", "This reservation has no associated reward claim.");
    }

    await this.redeemClaim(reservation.reward_id, reservation.customer_id, { cartKey, woocommerceOrderId });
    const confirmed = await this.deps.rewardReservationRepository.markConfirmed(reservation.id);

    await this.deps.auditService.recordAuditLog({
      actorId: null,
      action: "reward_reservation.confirm",
      targetType: "reward_reservation",
      targetId: confirmed.id,
      before: { reservation },
      after: { reservation: confirmed },
    });

    return confirmed;
  }
}
