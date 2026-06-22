"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, DataTable, DataTableColumn, PageHeader, StatusBadge } from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { friendlyErrorMessage } from "../../lib/error-message";
import { PaginationMeta, WalletReservation } from "../../lib/types";

const PAGE_SIZE = 20;

function centsToMajor(cents: number): string {
  return (cents / 100).toFixed(2);
}

function statusVariant(status: WalletReservation["status"]): string {
  switch (status) {
    case "active":
      return "active";
    case "confirmed":
      return "active";
    case "released":
    case "expired":
      return "failed";
    default:
      return status;
  }
}

export default function WalletReservationsPage() {
  const router = useRouter();

  const [rows, setRows] = useState<WalletReservation[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.getWithMeta<WalletReservation[]>(
        `/api/admin/wallet-reservations?page=${targetPage}&pageSize=${PAGE_SIZE}`,
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

  const columns: DataTableColumn<WalletReservation>[] = [
    { key: "cartKey", header: "Cart Key" },
    { key: "amountCents", header: "Amount", render: (row) => `$${centsToMajor(row.amountCents)} ${row.currency}` },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={statusVariant(row.status)} /> },
    { key: "woocommerceOrderId", header: "Order", render: (row) => row.woocommerceOrderId ?? "—" },
    { key: "expiresAt", header: "Expires", render: (row) => new Date(row.expiresAt).toLocaleString() },
    { key: "createdAt", header: "Created", render: (row) => new Date(row.createdAt).toLocaleString() },
  ];

  return (
    <div>
      <PageHeader
        title="Wallet Reservations"
        description="Checkout wallet credit holds. A reservation never moves money by itself — only 'confirmed' reservations have a matching wallet ledger debit; 'released'/'expired' never do."
      />

      <DataTable<WalletReservation>
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        error={error}
        onRetry={() => load(page)}
        emptyTitle="No wallet reservations yet."
        emptyDescription="Reservations are created automatically when a customer applies wallet credit at WooCommerce checkout."
        renderRowActions={(row) => (
          <Button variant="secondary" onClick={() => router.push(`/wallet-reservations/${row.id}`)}>
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
