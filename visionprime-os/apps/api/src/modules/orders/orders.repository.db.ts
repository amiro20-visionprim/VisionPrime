import { Db } from "@visionprime/database";
import { OrdersRepository } from "./orders.repository";
import {
  ListOrdersParams,
  ListOrdersResult,
  OrderEventRow,
  OrderItemRow,
  OrderRow,
  UpsertOrderRecord,
} from "./orders.types";

export function createDbOrdersRepository(db: Db): OrdersRepository {
  return {
    async list(params: ListOrdersParams): Promise<ListOrdersResult> {
      const offset = (params.page - 1) * params.pageSize;
      const where = params.customerId ? `where customer_id = $3` : ``;
      const listArgs: unknown[] = [params.pageSize, offset];
      const countArgs: unknown[] = [];
      if (params.customerId) {
        listArgs.push(params.customerId);
        countArgs.push(params.customerId);
      }
      const [rowsResult, countResult] = await Promise.all([
        db.query<OrderRow>(
          `select * from orders ${where} order by created_at desc limit $1 offset $2`,
          listArgs,
        ),
        db.query<{ count: string }>(
          `select count(*)::text as count from orders ${params.customerId ? "where customer_id = $1" : ""}`,
          countArgs,
        ),
      ]);
      return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0]?.count ?? 0) };
    },

    async findById(id: string): Promise<OrderRow | null> {
      const result = await db.query<OrderRow>(`select * from orders where id = $1`, [id]);
      return result.rows[0] ?? null;
    },

    async findByWoocommerceOrderId(woocommerceOrderId: string): Promise<OrderRow | null> {
      const result = await db.query<OrderRow>(`select * from orders where woocommerce_order_id = $1`, [
        woocommerceOrderId,
      ]);
      return result.rows[0] ?? null;
    },

    async upsert(record: UpsertOrderRecord): Promise<{ row: OrderRow; created: boolean; previousStatus: string | null }> {
      const existing = await db.query<{ id: string; status: string }>(
        `select id, status from orders where woocommerce_order_id = $1`,
        [record.woocommerceOrderId],
      );
      const created = existing.rows.length === 0;
      const previousStatus = existing.rows[0]?.status ?? null;

      const result = await db.query<OrderRow>(
        `insert into orders (customer_id, woocommerce_order_id, status, currency, total, raw, ordered_at)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (woocommerce_order_id) do update set
           customer_id = excluded.customer_id,
           status = excluded.status,
           currency = excluded.currency,
           total = excluded.total,
           raw = excluded.raw,
           ordered_at = excluded.ordered_at,
           updated_at = now()
         returning *`,
        [
          record.customerId,
          record.woocommerceOrderId,
          record.status,
          record.currency ?? null,
          record.total,
          JSON.stringify(record.raw ?? {}),
          record.orderedAt ?? null,
        ],
      );
      const row = result.rows[0];

      await db.query(`delete from order_items where order_id = $1`, [row.id]);
      for (const item of record.items) {
        await db.query(
          `insert into order_items (order_id, woocommerce_product_id, name, quantity, price, total, raw)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [
            row.id,
            item.woocommerceProductId ?? null,
            item.name,
            item.quantity,
            item.price,
            item.total,
            JSON.stringify(item.raw ?? {}),
          ],
        );
      }

      return { row, created, previousStatus };
    },

    async updateStatusByWoocommerceOrderId(
      woocommerceOrderId: string,
      status: string,
    ): Promise<{ row: OrderRow; previousStatus: string } | null> {
      const existing = await db.query<{ status: string }>(`select status from orders where woocommerce_order_id = $1`, [
        woocommerceOrderId,
      ]);
      if (!existing.rows[0]) {
        return null;
      }
      const previousStatus = existing.rows[0].status;
      const result = await db.query<OrderRow>(
        `update orders set status = $2, updated_at = now() where woocommerce_order_id = $1 returning *`,
        [woocommerceOrderId, status],
      );
      return { row: result.rows[0], previousStatus };
    },

    async listItems(orderId: string): Promise<OrderItemRow[]> {
      const result = await db.query<OrderItemRow>(
        `select * from order_items where order_id = $1 order by created_at asc`,
        [orderId],
      );
      return result.rows;
    },

    async listByCustomer(customerId: string): Promise<OrderRow[]> {
      const result = await db.query<OrderRow>(
        `select * from orders where customer_id = $1 order by created_at desc`,
        [customerId],
      );
      return result.rows;
    },

    async recordEvent(orderId: string, eventType: string, metadata: Record<string, unknown>): Promise<OrderEventRow> {
      const result = await db.query<OrderEventRow>(
        `insert into order_events (order_id, event_type, metadata) values ($1, $2, $3) returning *`,
        [orderId, eventType, JSON.stringify(metadata)],
      );
      return result.rows[0];
    },

    async listEvents(orderId: string): Promise<OrderEventRow[]> {
      const result = await db.query<OrderEventRow>(
        `select * from order_events where order_id = $1 order by created_at desc`,
        [orderId],
      );
      return result.rows;
    },
  };
}
