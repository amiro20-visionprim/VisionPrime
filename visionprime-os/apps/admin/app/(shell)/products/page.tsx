"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, DataTable, DataTableColumn, PageHeader, StatusBadge } from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { friendlyErrorMessage } from "../../lib/error-message";
import { PaginationMeta, Product } from "../../lib/types";

const PAGE_SIZE = 20;

export default function ProductsPage() {
  const router = useRouter();

  const [rows, setRows] = useState<Product[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.getWithMeta<Product[]>(
        `/api/admin/products?page=${targetPage}&pageSize=${PAGE_SIZE}`,
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

  const columns: DataTableColumn<Product>[] = [
    { key: "name", header: "Name" },
    { key: "sku", header: "SKU", render: (row) => row.sku ?? "—" },
    { key: "price", header: "Price", render: (row) => row.price ?? "—" },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Products" description="Products synced from WooCommerce. WooCommerce is the source of truth." />

      <DataTable<Product>
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        error={error}
        onRetry={() => load(page)}
        emptyTitle="No products yet."
        emptyDescription="Products will appear here once synced from WooCommerce."
        renderRowActions={(row) => (
          <Button variant="secondary" onClick={() => router.push(`/products/${row.id}`)}>
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
