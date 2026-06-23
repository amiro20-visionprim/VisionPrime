"use client";

import { useEffect, useState } from "react";
import { DataTable, DataTableColumn, PageHeader } from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { friendlyErrorMessage } from "../../lib/error-message";
import { PermissionCatalogEntry } from "../../lib/types";

interface PermissionRow extends PermissionCatalogEntry {
  id: string;
}

export default function PermissionsPage() {
  const [rows, setRows] = useState<PermissionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  async function load() {
    setIsLoading(true);
    setError(undefined);
    try {
      const catalog = await apiClient.get<PermissionCatalogEntry[]>("/api/admin/permissions");
      setRows(catalog.map((entry) => ({ ...entry, id: entry.key })));
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const columns: DataTableColumn<PermissionRow>[] = [
    { key: "key", header: "Key" },
    { key: "description", header: "Description", render: (row) => row.description || "—" },
  ];

  return (
    <div>
      <PageHeader title="Permissions" description="Read-only catalog of system permissions." />
      <DataTable<PermissionRow>
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        error={error}
        onRetry={load}
        emptyTitle="No permissions found."
      />
    </div>
  );
}
