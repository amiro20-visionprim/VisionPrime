"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Can, DataTable, DataTableColumn, PageHeader, StatusBadge } from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-client";
import { friendlyErrorMessage } from "../../lib/error-message";
import { Customer, PaginationMeta } from "../../lib/types";

const PAGE_SIZE = 20;

export default function CustomersPage() {
  const router = useRouter();
  const { permissions, isSuperAdmin } = useAuth();
  const userPermissions = isSuperAdmin ? undefined : permissions;

  const [rows, setRows] = useState<Customer[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.getWithMeta<Customer[]>(
        `/api/admin/customers?page=${targetPage}&pageSize=${PAGE_SIZE}`,
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

  const columns: DataTableColumn<Customer>[] = [
    { key: "full_name", header: "Name" },
    { key: "primary_email", header: "Email", render: (row) => row.primary_email ?? "—" },
    { key: "primary_mobile", header: "Mobile", render: (row) => row.primary_mobile ?? "—" },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Customer records synced from WooCommerce or created manually."
        actions={
          <Can permission="customer:create" userPermissions={userPermissions}>
            <Button onClick={() => router.push("/customers/new")}>New Customer</Button>
          </Can>
        }
      />

      <DataTable<Customer>
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        error={error}
        onRetry={() => load(page)}
        emptyTitle="No customers yet."
        emptyDescription="Customer records will appear here once created manually or synced from WooCommerce."
        renderRowActions={(row) => (
          <Button variant="secondary" onClick={() => router.push(`/customers/${row.id}`)}>
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
