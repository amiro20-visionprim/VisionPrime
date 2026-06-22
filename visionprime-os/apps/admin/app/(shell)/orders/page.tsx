"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, DataTable, DataTableColumn, PageHeader, StatusBadge } from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { friendlyErrorMessage } from "../../lib/error-message";
import { Order, PaginationMeta } from "../../lib/types";

const PAGE_SIZE = 20;

export default function OrdersPage() {
  const router = useRouter();

  const [rows, setRows] = useState<Order[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.getWithMeta<Order[]>(
        `/api/admin/orders?page=${targetPage}&pageSize=${PAGE_SIZE}`,
      );
      setRows(result.data);
      setMeta(result.meta as unknown as PaginationMeta);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  const columns: DataTableColumn<Order>[] = [
    { key: "woocommerce_order_id", header: "Order #" },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "total", header: "Total", render: (row) => `${row.total}${row.currency ? ` ${row.currency}` : ""}` },
    { key: "ordered_at", header: "Ordered", render: (row) => (row.ordered_at ? new Date(row.ordered_at).toLocaleString() : "—") },
  ];

  return (
    <div>
      <PageHeader title="Orders" description="Orders synced from WooCommerce. WooCommerce is the source of truth." />

      <DataTable<Order>
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        error={error}
        onRetry={() => load(page)}
        emptyTitle="No orders yet."
        emptyDescription="Orders will appear here once synced from WooCommerce."
        renderRowActions={(row) => (
          <Button variant="secondary" onClick={() => router.push(`/orders/${row.id}`)}>
            View
          </Button>
        )}
        pagination={{
          page: meta.page,
          pageSize: meta.pageSize,
          totalItems: meta.totalItems,
          totalPages: meta.totalPages,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
