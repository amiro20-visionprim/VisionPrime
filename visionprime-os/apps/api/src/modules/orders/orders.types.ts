export interface OrderRow {
  id: string;
  customer_id: string;
  woocommerce_order_id: string;
  status: string;
  currency: string | null;
  total: string;
  raw: Record<string, unknown>;
  ordered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewOrderItemRecord {
  woocommerceProductId?: string | null;
  name: string;
  quantity: number;
  price: number;
  total: number;
  raw?: Record<string, unknown>;
}

export interface UpsertOrderRecord {
  customerId: string;
  woocommerceOrderId: string;
  status: string;
  currency?: string | null;
  total: number;
  raw?: Record<string, unknown>;
  orderedAt?: string | null;
  items: NewOrderItemRecord[];
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  woocommerce_product_id: string | null;
  name: string;
  quantity: number;
  price: string;
  total: string;
  raw: Record<string, unknown>;
  created_at: string;
}

export interface OrderEventRow {
  id: string;
  order_id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ListOrdersParams {
  page: number;
  pageSize: number;
  customerId?: string;
}

export interface ListOrdersResult {
  rows: OrderRow[];
  totalItems: number;
}

export type PublicOrder = OrderRow;

export function toPublicOrder(row: OrderRow): PublicOrder {
  return row;
}

export interface OrderDetail {
  order: PublicOrder;
  items: OrderItemRow[];
  events: OrderEventRow[];
}

/** Statuses that count toward customer purchase metrics. */
export const METRIC_POSITIVE_STATUSES = ["completed", "processing"];
/** Statuses that reverse a previously-applied positive metric effect. */
export const METRIC_NEGATIVE_STATUSES = ["cancelled", "refunded"];
