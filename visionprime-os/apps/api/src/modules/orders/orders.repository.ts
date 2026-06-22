import { ListOrdersParams, ListOrdersResult, OrderEventRow, OrderItemRow, OrderRow, UpsertOrderRecord } from "./orders.types";

export interface OrdersRepository {
  list(params: ListOrdersParams): Promise<ListOrdersResult>;
  findById(id: string): Promise<OrderRow | null>;
  findByWoocommerceOrderId(woocommerceOrderId: string): Promise<OrderRow | null>;

  /**
   * Idempotent insert-or-update keyed on woocommerce_order_id. Replaces the
   * order's items wholesale on update (WooCommerce always sends the full
   * line-item set). Returns the previous status (null if newly created) so
   * callers can compute the correct customer-metrics delta on a status
   * transition (e.g. processing -> cancelled).
   */
  upsert(record: UpsertOrderRecord): Promise<{ row: OrderRow; created: boolean; previousStatus: string | null }>;

  /**
   * Sets status only (used by the order-deleted webhook, which typically
   * carries just the remote ID). Returns null if no local order has been
   * synced for this woocommerce_order_id yet — nothing to delete.
   */
  updateStatusByWoocommerceOrderId(
    woocommerceOrderId: string,
    status: string,
  ): Promise<{ row: OrderRow; previousStatus: string } | null>;

  listItems(orderId: string): Promise<OrderItemRow[]>;
  listByCustomer(customerId: string): Promise<OrderRow[]>;

  recordEvent(orderId: string, eventType: string, metadata: Record<string, unknown>): Promise<OrderEventRow>;
  listEvents(orderId: string): Promise<OrderEventRow[]>;
}
