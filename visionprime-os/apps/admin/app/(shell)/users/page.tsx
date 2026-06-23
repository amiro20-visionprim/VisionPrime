"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Can,
  ConfirmDialog,
  DataTable,
  DataTableColumn,
  DropdownMenu,
  IconButton,
  PageHeader,
  StatusBadge,
  useToast,
} from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-client";
import { friendlyErrorMessage } from "../../lib/error-message";
import { AdminUser, PaginationMeta } from "../../lib/types";

const PAGE_SIZE = 20;

export default function UsersPage() {
  const router = useRouter();
  const { permissions, isSuperAdmin, user: currentUser } = useAuth();
  const userPermissions = isSuperAdmin ? undefined : permissions;
  const { showToast } = useToast();

  const [rows, setRows] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.getWithMeta<AdminUser[]>(`/api/admin/users?page=${targetPage}&pageSize=${PAGE_SIZE}`);
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
      await apiClient.delete(`/api/admin/users/${deleteTarget.id}`);
      showToast("User deleted.", "success");
      setDeleteTarget(null);
      load(page);
    } catch (err) {
      showToast(friendlyErrorMessage(err), "error");
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: DataTableColumn<AdminUser>[] = [
    { key: "full_name", header: "Name" },
    { key: "email", header: "Email" },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.is_active ? "active" : "inactive"} />,
    },
    {
      key: "role",
      header: "Role",
      render: (row) => (row.is_super_admin ? "Super Admin" : "—"),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage admin user accounts."
        actions={
          <Can permission="user:create" userPermissions={userPermissions}>
            <Button onClick={() => router.push("/users/new")}>New User</Button>
          </Can>
        }
      />

      <DataTable<AdminUser>
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        error={error}
        onRetry={() => load(page)}
        emptyTitle="No admin users yet."
        emptyDescription="Admin users you create will appear here."
        pagination={{
          page: meta.page,
          pageSize: meta.pageSize,
          totalItems: meta.totalItems,
          totalPages: meta.totalPages,
          onPageChange: setPage,
        }}
        renderRowActions={(row) => (
          <DropdownMenu
            trigger={<IconButton aria-label={`Actions for ${row.full_name}`}>⋮</IconButton>}
            items={[
              {
                key: "edit",
                label: "Edit",
                isDisabled: !(isSuperAdmin || permissions.includes("user:update")),
                onSelect: () => router.push(`/users/${row.id}`),
              },
              {
                key: "delete",
                label: "Delete",
                isDestructive: true,
                isDisabled:
                  !(isSuperAdmin || permissions.includes("user:delete")) ||
                  row.id === currentUser?.id ||
                  (row.is_super_admin && !isSuperAdmin),
                onSelect: () => setDeleteTarget(row),
              },
            ]}
          />
        )}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete user"
        message={`Are you sure you want to delete "${deleteTarget?.full_name}"? This action cannot be undone.`}
        isConfirming={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
