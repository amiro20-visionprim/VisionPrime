export const RESERVATION_TTL_MS = 30 * 60 * 1000;

export type ReservationStatus = "active" | "confirmed" | "released" | "expired";

export interface WalletReservationRow {
  id: string;
  wallet_id: string;
  customer_id: string;
  cart_key: string;
  amount_cents: number;
  currency: string;
  status: ReservationStatus;
  woocommerce_order_id: string | null;
  ledger_entry_id: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface RewardReservationRow {
  id: string;
  customer_id: string;
  cart_key: string;
  reward_id: string | null;
  status: ReservationStatus;
  woocommerce_order_id: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface NewWalletReservationRecord {
  walletId: string;
  customerId: string;
  cartKey: string;
  amountCents: number;
  currency: string;
  expiresAt: string;
}

export interface NewRewardReservationRecord {
  customerId: string;
  cartKey: string;
  rewardId: string | null;
  expiresAt: string;
}

export interface PublicWalletReservation {
  id: string;
  cartKey: string;
  amountCents: number;
  currency: string;
  status: ReservationStatus;
  expiresAt: string;
  woocommerceOrderId: string | null;
  createdAt: string;
}

export interface PublicRewardReservation {
  id: string;
  cartKey: string;
  rewardId: string | null;
  status: ReservationStatus;
  expiresAt: string;
  woocommerceOrderId: string | null;
  createdAt: string;
}

export function toPublicWalletReservation(row: WalletReservationRow): PublicWalletReservation {
  return {
    id: row.id,
    cartKey: row.cart_key,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    expiresAt: row.expires_at,
    woocommerceOrderId: row.woocommerce_order_id,
    createdAt: row.created_at,
  };
}

export function toPublicRewardReservation(row: RewardReservationRow): PublicRewardReservation {
  return {
    id: row.id,
    cartKey: row.cart_key,
    rewardId: row.reward_id,
    status: row.status,
    expiresAt: row.expires_at,
    woocommerceOrderId: row.woocommerce_order_id,
    createdAt: row.created_at,
  };
}

export function isExpired(expiresAt: string, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

export interface ListReservationsParams {
  page: number;
  pageSize: number;
}

export interface ListReservationsResult<T> {
  rows: T[];
  totalItems: number;
}
