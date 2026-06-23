import { Db } from "@visionprime/database";
import { RewardsRepository } from "./rewards.repository";
import { ListParams, RewardClaimRow, RewardCodeRow, RewardRedemptionRow, RewardRow } from "./rewards.types";

export function createDbRewardsRepository(db: Db): RewardsRepository {
  async function listPaged<T>(table: string, where: string, whereParams: unknown[], orderBy: string, params: ListParams) {
    const offset = (params.page - 1) * params.pageSize;
    const [rowsResult, countResult] = await Promise.all([
      db.query<T>(
        `select * from ${table} ${where} order by ${orderBy} limit $${whereParams.length + 1} offset $${whereParams.length + 2}`,
        [...whereParams, params.pageSize, offset],
      ),
      db.query<{ count: string }>(`select count(*)::text as count from ${table} ${where}`, whereParams),
    ]);
    return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0]?.count ?? 0) };
  }

  return {
    async listRewards(params) {
      return listPaged<RewardRow>("rewards", "where deleted_at is null", [], "created_at desc", params);
    },
    async findRewardById(id) {
      const r = await db.query<RewardRow>(`select * from rewards where id = $1 and deleted_at is null`, [id]);
      return r.rows[0] ?? null;
    },
    async createReward(record) {
      const r = await db.query<RewardRow>(
        `insert into rewards (name, description, reward_type, points_cost, coupon_config, claim_validity_days, is_active, max_claims)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
        [
          record.name,
          record.description ?? null,
          record.rewardType,
          record.pointsCost ?? 0,
          JSON.stringify(record.couponConfig ?? {}),
          record.claimValidityDays ?? 30,
          record.isActive ?? true,
          record.maxClaims ?? null,
        ],
      );
      return r.rows[0];
    },
    async updateReward(id, record) {
      const r = await db.query<RewardRow>(
        `update rewards set
           name = coalesce($2, name),
           description = coalesce($3, description),
           reward_type = coalesce($4, reward_type),
           points_cost = coalesce($5, points_cost),
           coupon_config = coalesce($6, coupon_config),
           claim_validity_days = coalesce($7, claim_validity_days),
           is_active = coalesce($8, is_active),
           max_claims = coalesce($9, max_claims),
           updated_at = now()
         where id = $1 and deleted_at is null returning *`,
        [
          id,
          record.name ?? null,
          record.description ?? null,
          record.rewardType ?? null,
          record.pointsCost ?? null,
          record.couponConfig !== undefined ? JSON.stringify(record.couponConfig) : null,
          record.claimValidityDays ?? null,
          record.isActive ?? null,
          record.maxClaims ?? null,
        ],
      );
      return r.rows[0] ?? null;
    },
    async softDeleteReward(id) {
      const r = await db.query(`update rewards set deleted_at = now(), updated_at = now() where id = $1 and deleted_at is null`, [id]);
      return (r.rowCount ?? 0) > 0;
    },

    async countActiveClaimsForReward(rewardId) {
      const r = await db.query<{ count: string }>(
        `select count(*)::text as count from reward_claims where reward_id = $1 and status not in ('cancelled', 'expired')`,
        [rewardId],
      );
      return Number(r.rows[0]?.count ?? 0);
    },

    async listClaims(params, customerId) {
      return listPaged<RewardClaimRow>(
        "reward_claims",
        customerId ? "where customer_id = $1" : "",
        customerId ? [customerId] : [],
        "created_at desc",
        params,
      );
    },
    async findClaimById(id) {
      const r = await db.query<RewardClaimRow>(`select * from reward_claims where id = $1`, [id]);
      return r.rows[0] ?? null;
    },
    async createClaim(record) {
      const r = await db.query<RewardClaimRow>(
        `insert into reward_claims (reward_id, customer_id, expires_at, points_ledger_entry_id)
         values ($1, $2, $3, $4) returning *`,
        [record.rewardId, record.customerId, record.expiresAt, record.pointsLedgerEntryId],
      );
      return r.rows[0];
    },
    async transitionClaimStatus(id, fromStatus, toStatus) {
      const r = await db.query<RewardClaimRow>(
        `update reward_claims set status = $3, updated_at = now()
         where id = $1 and status = $2 returning *`,
        [id, fromStatus, toStatus],
      );
      return r.rows[0] ?? null;
    },

    async listRedemptions(params, customerId) {
      return listPaged<RewardRedemptionRow>(
        "reward_redemptions",
        customerId ? "where customer_id = $1" : "",
        customerId ? [customerId] : [],
        "created_at desc",
        params,
      );
    },
    async createRedemption(record) {
      const r = await db.query<RewardRedemptionRow>(
        `insert into reward_redemptions (reward_claim_id, reward_id, customer_id, cart_key, woocommerce_order_id)
         values ($1, $2, $3, $4, $5) returning *`,
        [record.rewardClaimId, record.rewardId, record.customerId, record.cartKey, record.woocommerceOrderId],
      );
      return r.rows[0];
    },
    async setRedemptionRewardCode(redemptionId, rewardCodeId) {
      await db.query(`update reward_redemptions set reward_code_id = $2 where id = $1`, [redemptionId, rewardCodeId]);
    },

    async createRewardCode(record) {
      const r = await db.query<RewardCodeRow>(
        `insert into reward_codes (reward_redemption_id, code) values ($1, $2) returning *`,
        [record.rewardRedemptionId, record.code],
      );
      return r.rows[0];
    },
  };
}
