"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, DataTableColumn, PageHeader, StatusBadge } from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { friendlyErrorMessage } from "../../lib/error-message";
import { PaginationMeta, SecurityEventRow } from "../../lib/types";

const PAGE_SIZE = 20;

const SEVERITY_STATUS_MAP: Record<string, string> = {
  info: "processing",
  warning: "pending",
  critical: "failed",
};

export default function SecurityEventsPage() {
  const [rows, setRows] = useState<SecurityEventRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.getWithMeta<SecurityEventRow[]>(
        `/api/admin/security-events?page=${targetPage}&pageSize=${PAGE_SIZE}`,
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

  const columns: DataTableColumn<SecurityEventRow>[] = [
    { key: "created_at", header: "Time", render: (row) => new Date(row.created_at).toLocaleString() },
    { key: "type", header: "Type" },
    {
      key: "severity",
      header: "Severity",
      render: (row) => <StatusBadge status={SEVERITY_STATUS_MAP[row.severity] ?? row.severity} label={row.severity} />,
    },
    { key: "email", header: "Email", render: (row) => row.email ?? "—" },
    { key: "ip_address", header: "IP Address", render: (row) => row.ip_address ?? "—" },
    {
      key: "metadata",
      header: "Metadata",
      render: (row) => (row.metadata ? JSON.stringify(row.metadata) : "—"),
    },
  ];

  return (
    <div>
      <PageHeader title="Security Events" description="Security-relevant events such as failed login attempts." />
      <DataTable<SecurityEventRow>
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        error={error}
        onRetry={() => load(page)}
        emptyTitle="No security events yet."
        emptyDescription="Security events will appear here as they occur."
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
