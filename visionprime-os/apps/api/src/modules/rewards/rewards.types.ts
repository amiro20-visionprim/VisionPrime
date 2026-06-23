import { randomBytes } from "crypto";

export type RewardType = "coupon" | "free_item" | "other";
export type RewardClaimStatus = "claimed" | "redeemed" | "expired" | "cancelled";
export type RewardCodeStatus = "issued" | "synced" | "failed";

export interface RewardRow {
  id: string;
  name: string;
  description: string | null;
  reward_type: RewardType;
  points_cost: number;
  coupon_config: Record<string, unknown>;
  claim_validity_days: number;
  is_active: boolean;
  max_claims: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RewardClaimRow {
  id: string;
  reward_id: string;
  customer_id: string;
  status: RewardClaimStatus;
  points_ledger_entry_id: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface RewardRedemptionRow {
  id: string;
  reward_claim_id: string;
  reward_id: string;
  customer_id: string;
  cart_key: string | null;
  woocommerce_order_id: string | null;
  reward_code_id: string | null;
  created_at: string;
}

export interface RewardCodeRow {
  id: string;
  reward_redemption_id: string;
  code: string;
  woocommerce_coupon_id: string | null;
  status: RewardCodeStatus;
  created_at: string;
}

export interface NewRewardRecord {
  name: string;
  description?: string | null;
  rewardType: RewardType;
  pointsCost?: number;
  couponConfig?: Record<string, unknown>;
  claimValidityDays?: number;
  isActive?: boolean;
  maxClaims?: number | null;
}

export interface UpdateRewardRecord {
  name?: string;
  description?: string | null;
  rewardType?: RewardType;
  pointsCost?: number;
  couponConfig?: Record<string, unknown>;
  claimValidityDays?: number;
  isActive?: boolean;
  maxClaims?: number | null;
}

export interface PublicReward {
  id: string;
  name: string;
  description: string | null;
  rewardType: RewardType;
  pointsCost: number;
  couponConfig: Record<string, unknown>;
  claimValidityDays: number;
  isActive: boolean;
  maxClaims: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicRewardClaim {
  id: string;
  rewardId: string;
  customerId: string;
  status: RewardClaimStatus;
  expiresAt: string;
  createdAt: string;
}

export interface PublicRewardRedemption {
  id: string;
  rewardClaimId: string;
  rewardId: string;
  customerId: string;
  cartKey: string | null;
  woocommerceOrderId: string | null;
  createdAt: string;
}

export function toPublicReward(row: RewardRow): PublicReward {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    rewardType: row.reward_type,
    pointsCost: row.points_cost,
    couponConfig: row.coupon_config,
    claimValidityDays: row.claim_validity_days,
    isActive: row.is_active,
    maxClaims: row.max_claims,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicRewardClaim(row: RewardClaimRow): PublicRewardClaim {
  return {
    id: row.id,
    rewardId: row.reward_id,
    customerId: row.customer_id,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export function toPublicRewardRedemption(row: RewardRedemptionRow): PublicRewardRedemption {
  return {
    id: row.id,
    rewardClaimId: row.reward_claim_id,
    rewardId: row.reward_id,
    customerId: row.customer_id,
    cartKey: row.cart_key,
    woocommerceOrderId: row.woocommerce_order_id,
    createdAt: row.created_at,
  };
}

export function isClaimExpired(claim: RewardClaimRow, now: Date = new Date()): boolean {
  return new Date(claim.expires_at).getTime() <= now.getTime();
}

export interface ListParams {
  page: number;
  pageSize: number;
}

export interface ListResult<T> {
  rows: T[];
  totalItems: number;
}

export function generateRewardCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(10);
  let code = "";
  for (let i = 0; i < bytes.length; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return `VP-${code}`;
}
