"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Can, DataTable, DataTableColumn, MetricCard, PageHeader, StatusBadge } from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-client";
import { friendlyErrorMessage } from "../../lib/error-message";
import { Customer, PaginationMeta, WalletLiabilityReport } from "../../lib/types";

const PAGE_SIZE = 20;

export default function WalletPage() {
  const router = useRouter();
  const { permissions, isSuperAdmin } = useAuth();
  const userPermissions = isSuperAdmin ? undefined : permissions;

  const [rows, setRows] = useState<Customer[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const [liability, setLiability] = useState<WalletLiabilityReport | null>(null);
  const [isLoadingLiability, setIsLoadingLiability] = useState(true);

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

  useEffect(() => {
    if (!userPermissions || userPermissions.includes("wallet:report:view")) {
      apiClient
        .get<WalletLiabilityReport>("/api/admin/wallets/reports/liability")
        .then(setLiability)
        .catch(() => setLiability(null))
        .finally(() => setIsLoadingLiability(false));
    } else {
      setIsLoadingLiability(false);
    }
  }, [userPermissions]);

  const columns: DataTableColumn<Customer>[] = [
    { key: "full_name", header: "Name" },
    { key: "primary_email", header: "Email", render: (row) => row.primary_email ?? "—" },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Wallet"
        description="Append-only wallet ledger. Balances are always derived from the ledger — never directly editable."
      />

      <Can permission="wallet:report:view" userPermissions={userPermissions}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", maxWidth: 720, marginBottom: "1.5rem" }}>
          <MetricCard
            label="Total Wallet Liability"
            value={liability ? `${(liability.totalLiabilityCents / 100).toFixed(2)} ${liability.currency}` : "—"}
            isLoading={isLoadingLiability}
          />
          <MetricCard label="Wallets" value={liability ? liability.walletCount : "—"} isLoading={isLoadingLiability} />
        </div>
      </Can>

      <DataTable<Customer>
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        error={error}
        onRetry={() => load(page)}
        emptyTitle="No customers yet."
        emptyDescription="Customer wallets are created automatically the first time a wallet action is taken for that customer."
        renderRowActions={(row) => (
          <Button variant="secondary" onClick={() => router.push(`/wallet/${row.id}`)}>
            View Wallet
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
