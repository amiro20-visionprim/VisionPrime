import { randomUUID } from "crypto";
import { RewardsRepository } from "./rewards.repository";
import { ListParams, ListResult, RewardClaimRow, RewardCodeRow, RewardRedemptionRow, RewardRow } from "./rewards.types";

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

function paginate<T>(rows: T[], params: ListParams): ListResult<T> {
  const start = (params.page - 1) * params.pageSize;
  return { rows: rows.slice(start, start + params.pageSize), totalItems: rows.length };
}

export function createMemoryRewardsRepository(): RewardsRepository {
  const rewards: RewardRow[] = [];
  const claims: RewardClaimRow[] = [];
  const redemptions: RewardRedemptionRow[] = [];
  const codes: RewardCodeRow[] = [];
  const withLock = createMutex();
  const now = () => new Date().toISOString();

  return {
    async listRewards(params) {
      return paginate(
        rewards.filter((r) => !r.deleted_at).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
        params,
      );
    },
    async findRewardById(id) {
      return rewards.find((r) => r.id === id && !r.deleted_at) ?? null;
    },
    async createReward(record) {
      const row: RewardRow = {
        id: randomUUID(),
        name: record.name,
        description: record.description ?? null,
        reward_type: record.rewardType,
        points_cost: record.pointsCost ?? 0,
        coupon_config: record.couponConfig ?? {},
        claim_validity_days: record.claimValidityDays ?? 30,
        is_active: record.isActive ?? true,
        max_claims: record.maxClaims ?? null,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      };
      rewards.push(row);
      return row;
    },
    async updateReward(id, record) {
      const row = rewards.find((r) => r.id === id && !r.deleted_at);
      if (!row) return null;
      if (record.name !== undefined) row.name = record.name;
      if (record.description !== undefined) row.description = record.description;
      if (record.rewardType !== undefined) row.reward_type = record.rewardType;
      if (record.pointsCost !== undefined) row.points_cost = record.pointsCost;
      if (record.couponConfig !== undefined) row.coupon_config = record.couponConfig;
      if (record.claimValidityDays !== undefined) row.claim_validity_days = record.claimValidityDays;
      if (record.isActive !== undefined) row.is_active = record.isActive;
      if (record.maxClaims !== undefined) row.max_claims = record.maxClaims;
      row.updated_at = now();
      return row;
    },
    async softDeleteReward(id) {
      const row = rewards.find((r) => r.id === id && !r.deleted_at);
      if (!row) return false;
      row.deleted_at = now();
      row.updated_at = now();
      return true;
    },

    async countActiveClaimsForReward(rewardId) {
      return claims.filter((c) => c.reward_id === rewardId && c.status !== "cancelled" && c.status !== "expired")
        .length;
    },

    async listClaims(params, customerId) {
      const filtered = claims
        .filter((c) => !customerId || c.customer_id === customerId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return paginate(filtered, params);
    },
    async findClaimById(id) {
      return claims.find((c) => c.id === id) ?? null;
    },
    async createClaim(record) {
      return withLock(`claim:${record.rewardId}`, async () => {
        const row: RewardClaimRow = {
          id: randomUUID(),
          reward_id: record.rewardId,
          customer_id: record.customerId,
          status: "claimed",
          points_ledger_entry_id: record.pointsLedgerEntryId,
          expires_at: record.expiresAt,
          created_at: now(),
          updated_at: now(),
        };
        claims.push(row);
        return row;
      });
    },
    async transitionClaimStatus(id, fromStatus, toStatus) {
      return withLock(`transition:${id}`, async () => {
        const row = claims.find((c) => c.id === id);
        if (!row || row.status !== fromStatus) return null;
        row.status = toStatus as RewardClaimRow["status"];
        row.updated_at = now();
        return row;
      });
    },

    async listRedemptions(params, customerId) {
      const filtered = redemptions
        .filter((r) => !customerId || r.customer_id === customerId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return paginate(filtered, params);
    },
    async createRedemption(record) {
      const row: RewardRedemptionRow = {
        id: randomUUID(),
        reward_claim_id: record.rewardClaimId,
        reward_id: record.rewardId,
        customer_id: record.customerId,
        cart_key: record.cartKey,
        woocommerce_order_id: record.woocommerceOrderId,
        reward_code_id: null,
        created_at: now(),
      };
      redemptions.push(row);
      return row;
    },
    async setRedemptionRewardCode(redemptionId, rewardCodeId) {
      const row = redemptions.find((r) => r.id === redemptionId);
      if (row) row.reward_code_id = rewardCodeId;
    },

    async createRewardCode(record) {
      const row: RewardCodeRow = {
        id: randomUUID(),
        reward_redemption_id: record.rewardRedemptionId,
        code: record.code,
        woocommerce_coupon_id: null,
        status: "issued",
        created_at: now(),
      };
      codes.push(row);
      return row;
    },
  };
}
