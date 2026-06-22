import {
  ListParams,
  ListResult,
  NewRewardRecord,
  RewardClaimRow,
  RewardCodeRow,
  RewardRedemptionRow,
  RewardRow,
  UpdateRewardRecord,
} from "./rewards.types";

export interface RewardsRepository {
  listRewards(params: ListParams): Promise<ListResult<RewardRow>>;
  findRewardById(id: string): Promise<RewardRow | null>;
  createReward(record: NewRewardRecord): Promise<RewardRow>;
  updateReward(id: string, record: UpdateRewardRecord): Promise<RewardRow | null>;
  softDeleteReward(id: string): Promise<boolean>;

  countActiveClaimsForReward(rewardId: string): Promise<number>;

  listClaims(params: ListParams, customerId?: string): Promise<ListResult<RewardClaimRow>>;
  findClaimById(id: string): Promise<RewardClaimRow | null>;
  createClaim(record: {
    rewardId: string;
    customerId: string;
    expiresAt: string;
    pointsLedgerEntryId: string | null;
  }): Promise<RewardClaimRow>;
  /** Atomically transitions a claim from 'claimed' to `status`, returning
   * null if the claim wasn't in 'claimed' state (guards double-redeem). */
  transitionClaimStatus(id: string, fromStatus: string, toStatus: string): Promise<RewardClaimRow | null>;

  listRedemptions(params: ListParams, customerId?: string): Promise<ListResult<RewardRedemptionRow>>;
  createRedemption(record: {
    rewardClaimId: string;
    rewardId: string;
    customerId: string;
    cartKey: string | null;
    woocommerceOrderId: string | null;
  }): Promise<RewardRedemptionRow>;
  setRedemptionRewardCode(redemptionId: string, rewardCodeId: string): Promise<void>;

  createRewardCode(record: { rewardRedemptionId: string; code: string }): Promise<RewardCodeRow>;
}
