"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, DataTable, DataTableColumn, ErrorState, LoadingState, PageHeader, StatusBadge, Timeline, TimelineItem } from "@visionprime/ui";
import { apiClient } from "../../../lib/api-client";
import { friendlyErrorMessage } from "../../../lib/error-message";
import { OrderDetail, OrderItem } from "../../../lib/types";

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.get<OrderDetail>(`/api/admin/orders/${params.id}`);
      setDetail(result);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !detail) {
    return <ErrorState message={error ?? "Unable to load order."} action={<Button onClick={load}>Retry</Button>} />;
  }

  const { order, items, events } = detail;

  const itemColumns: DataTableColumn<OrderItem>[] = [
    { key: "name", header: "Item" },
    { key: "quantity", header: "Qty" },
    { key: "price", header: "Price" },
    { key: "total", header: "Total" },
  ];

  const timelineItems: TimelineItem[] = events.map((event) => ({
    id: event.id,
    title: event.event_type,
    timestamp: event.created_at,
    detail: Object.keys(event.metadata ?? {}).length > 0 ? JSON.stringify(event.metadata) : undefined,
  }));

  return (
    <div>
      <PageHeader
        title={`Order #${order.woocommerce_order_id}`}
        description="Order detail. WooCommerce is the source of truth for this record."
        actions={
          <Button variant="secondary" onClick={() => router.push("/orders")}>
            Back to Orders
          </Button>
        }
      />

      <div style={{ maxWidth: 480, marginBottom: "1.5rem" }}>
        <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>Status:</span>
          <StatusBadge status={order.status} />
        </div>
        <p>
          <strong>Total:</strong> {order.total}
          {order.currency ? ` ${order.currency}` : ""}
        </p>
        <p>
          <strong>Ordered:</strong> {order.ordered_at ? new Date(order.ordered_at).toLocaleString() : "—"}
        </p>
        <p>
          <strong>Created:</strong> {new Date(order.created_at).toLocaleString()}
        </p>
      </div>

      <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.75rem" }}>Order Items</h3>
      <DataTable<OrderItem>
        columns={itemColumns}
        rows={items}
        emptyTitle="No items."
        emptyDescription="This order has no line items."
      />

      <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginTop: "2rem", marginBottom: "0.75rem" }}>Order Events</h3>
      <Timeline items={timelineItems} emptyMessage="No events recorded for this order yet." />
    </div>
  );
}
