import { randomUUID } from "crypto";
import { OrdersRepository } from "./orders.repository";
import {
  ListOrdersParams,
  ListOrdersResult,
  OrderEventRow,
  OrderItemRow,
  OrderRow,
  UpsertOrderRecord,
} from "./orders.types";

export function createMemoryOrdersRepository() {
  const rows: OrderRow[] = [];
  const items: OrderItemRow[] = [];
  const events: OrderEventRow[] = [];

  const repository: OrdersRepository & { __items: OrderItemRow[]; __events: OrderEventRow[] } = {
    __items: items,
    __events: events,

    async list(params: ListOrdersParams): Promise<ListOrdersResult> {
      const filtered = params.customerId ? rows.filter((r) => r.customer_id === params.customerId) : rows;
      const start = (params.page - 1) * params.pageSize;
      return { rows: filtered.slice(start, start + params.pageSize), totalItems: filtered.length };
    },

    async findById(id: string): Promise<OrderRow | null> {
      return rows.find((r) => r.id === id) ?? null;
    },

    async findByWoocommerceOrderId(woocommerceOrderId: string): Promise<OrderRow | null> {
      return rows.find((r) => r.woocommerce_order_id === woocommerceOrderId) ?? null;
    },

    async upsert(record: UpsertOrderRecord): Promise<{ row: OrderRow; created: boolean; previousStatus: string | null }> {
      const now = new Date().toISOString();
      const existing = rows.find((r) => r.woocommerce_order_id === record.woocommerceOrderId);
      const previousStatus = existing?.status ?? null;
      const created = !existing;

      let row: OrderRow;
      if (existing) {
        existing.customer_id = record.customerId;
        existing.status = record.status;
        existing.currency = record.currency ?? null;
        existing.total = String(record.total);
        existing.raw = record.raw ?? {};
        existing.ordered_at = record.orderedAt ?? null;
        existing.updated_at = now;
        row = existing;
      } else {
        row = {
          id: randomUUID(),
          customer_id: record.customerId,
          woocommerce_order_id: record.woocommerceOrderId,
          status: record.status,
          currency: record.currency ?? null,
          total: String(record.total),
          raw: record.raw ?? {},
          ordered_at: record.orderedAt ?? null,
          created_at: now,
          updated_at: now,
        };
        rows.push(row);
      }

      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].order_id === row.id) items.splice(i, 1);
      }
      for (const item of record.items) {
        items.push({
          id: randomUUID(),
          order_id: row.id,
          woocommerce_product_id: item.woocommerceProductId ?? null,
          name: item.name,
          quantity: item.quantity,
          price: String(item.price),
          total: String(item.total),
          raw: item.raw ?? {},
          created_at: now,
        });
      }

      return { row, created, previousStatus };
    },

    async updateStatusByWoocommerceOrderId(
      woocommerceOrderId: string,
      status: string,
    ): Promise<{ row: OrderRow; previousStatus: string } | null> {
      const row = rows.find((r) => r.woocommerce_order_id === woocommerceOrderId);
      if (!row) return null;
      const previousStatus = row.status;
      row.status = status;
      row.updated_at = new Date().toISOString();
      return { row, previousStatus };
    },

    async listItems(orderId: string): Promise<OrderItemRow[]> {
      return items.filter((i) => i.order_id === orderId);
    },

    async listByCustomer(customerId: string): Promise<OrderRow[]> {
      return rows.filter((r) => r.customer_id === customerId).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async recordEvent(orderId: string, eventType: string, metadata: Record<string, unknown>): Promise<OrderEventRow> {
      const row: OrderEventRow = { id: randomUUID(), order_id: orderId, event_type: eventType, metadata, created_at: new Date().toISOString() };
      events.push(row);
      return row;
    },

    async listEvents(orderId: string): Promise<OrderEventRow[]> {
      return events.filter((e) => e.order_id === orderId).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
  };

  return repository;
}
