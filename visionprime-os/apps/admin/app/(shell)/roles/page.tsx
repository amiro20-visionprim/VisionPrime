"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Can,
  ConfirmDialog,
  DataTable,
  DataTableColumn,
  DropdownMenu,
  IconButton,
  PageHeader,
  useToast,
} from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-client";
import { friendlyErrorMessage } from "../../lib/error-message";
import { AdminRole, PaginationMeta } from "../../lib/types";

const PAGE_SIZE = 20;

export default function RolesPage() {
  const router = useRouter();
  const { permissions, isSuperAdmin } = useAuth();
  const userPermissions = isSuperAdmin ? undefined : permissions;
  const { showToast } = useToast();

  const [rows, setRows] = useState<AdminRole[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<AdminRole | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.getWithMeta<AdminRole[]>(`/api/admin/roles?page=${targetPage}&pageSize=${PAGE_SIZE}`);
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

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/api/admin/roles/${deleteTarget.id}`);
      showToast("Role deleted.", "success");
      setDeleteTarget(null);
      load(page);
    } catch (err) {
      showToast(friendlyErrorMessage(err), "error");
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: DataTableColumn<AdminRole>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
          {row.name}
          {row.is_system ? <Badge>System</Badge> : null}
        </span>
      ),
    },
    { key: "description", header: "Description", render: (row) => row.description ?? "—" },
    { key: "permissionCount", header: "Permissions", render: (row) => String(row.permissionKeys.length) },
  ];

  return (
    <div>
      <PageHeader
        title="Roles"
        description="Manage role-based access control."
        actions={
          <Can permission="role:create" userPermissions={userPermissions}>
            <Button onClick={() => router.push("/roles/new")}>New Role</Button>
          </Can>
        }
      />

      <DataTable<AdminRole>
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        error={error}
        onRetry={() => load(page)}
        emptyTitle="No roles yet."
        emptyDescription="Roles you create will appear here."
        pagination={{
          page: meta.page,
          pageSize: meta.pageSize,
          totalItems: meta.totalItems,
          totalPages: meta.totalPages,
          onPageChange: setPage,
        }}
        renderRowActions={(row) => (
          <DropdownMenu
            trigger={<IconButton aria-label={`Actions for ${row.name}`}>⋮</IconButton>}
            items={[
              {
                key: "edit",
                label: "Edit",
                isDisabled: row.is_system || !(isSuperAdmin || permissions.includes("role:update")),
                onSelect: () => router.push(`/roles/${row.id}`),
              },
              {
                key: "delete",
                label: "Delete",
                isDestructive: true,
                isDisabled: row.is_system || !(isSuperAdmin || permissions.includes("role:delete")),
                onSelect: () => setDeleteTarget(row),
              },
            ]}
          />
        )}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete role"
        message={`Are you sure you want to delete the role "${deleteTarget?.name}"? This action cannot be undone.`}
        isConfirming={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
