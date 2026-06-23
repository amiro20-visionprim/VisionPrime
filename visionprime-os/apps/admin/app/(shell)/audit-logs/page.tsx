"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, DataTableColumn, PageHeader } from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { friendlyErrorMessage } from "../../lib/error-message";
import { AuditLogRow, PaginationMeta } from "../../lib/types";

const PAGE_SIZE = 20;

export default function AuditLogsPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.getWithMeta<AuditLogRow[]>(
        `/api/admin/audit-logs?page=${targetPage}&pageSize=${PAGE_SIZE}`,
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

  const columns: DataTableColumn<AuditLogRow>[] = [
    { key: "created_at", header: "Time", render: (row) => new Date(row.created_at).toLocaleString() },
    { key: "actor_id", header: "Actor", render: (row) => row.actor_id ?? "System" },
    { key: "action", header: "Action" },
    { key: "target_type", header: "Target Type" },
    { key: "target_id", header: "Target ID", render: (row) => row.target_id ?? "—" },
  ];

  return (
    <div>
      <PageHeader title="Audit Logs" description="System audit trail of administrative changes." />
      <DataTable<AuditLogRow>
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        error={error}
        onRetry={() => load(page)}
        emptyTitle="No audit log entries yet."
        emptyDescription="Audit log entries will appear here as actions are performed."
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
