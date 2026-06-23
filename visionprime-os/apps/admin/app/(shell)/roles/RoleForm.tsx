"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, FormField, Input, PageHeader, Textarea, useToast } from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { ApiClientError } from "@visionprime/api-client";
import { fieldErrorsFrom, friendlyErrorMessage } from "../../lib/error-message";
import { AdminRole, PermissionCatalogEntry } from "../../lib/types";

interface RoleFormProps {
  mode: "create" | "edit";
  roleId?: string;
}

interface FormState {
  name: string;
  description: string;
  permissionKeys: string[];
}

const INITIAL_STATE: FormState = { name: "", description: "", permissionKeys: [] };

function groupByResource(catalog: PermissionCatalogEntry[]): Record<string, PermissionCatalogEntry[]> {
  const groups: Record<string, PermissionCatalogEntry[]> = {};
  for (const entry of catalog) {
    const resource = entry.key.split(":")[0];
    if (!groups[resource]) groups[resource] = [];
    groups[resource].push(entry);
  }
  return groups;
}

export function RoleForm({ mode, roleId }: RoleFormProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([]);
  const [isSystem, setIsSystem] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const permissions = await apiClient.get<PermissionCatalogEntry[]>("/api/admin/permissions");
        if (!isMounted) return;
        setCatalog(permissions);

        if (mode === "edit" && roleId) {
          const role = await apiClient.get<AdminRole>(`/api/admin/roles/${roleId}`);
          if (!isMounted) return;
          setForm({
            name: role.name,
            description: role.description ?? "",
            permissionKeys: role.permissionKeys,
          });
          setIsSystem(role.is_system);
        }
      } catch (err) {
        if (isMounted) setFormError(friendlyErrorMessage(err));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [mode, roleId]);

  const groupedCatalog = useMemo(() => groupByResource(catalog), [catalog]);

  function togglePermission(key: string) {
    setForm((f) => ({
      ...f,
      permissionKeys: f.permissionKeys.includes(key)
        ? f.permissionKeys.filter((k) => k !== key)
        : [...f.permissionKeys, key],
    }));
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) {
      errors.name = "Name is required.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (mode === "create") {
        await apiClient.post("/api/admin/roles", {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          permissionKeys: form.permissionKeys,
        });
        showToast("Role created.", "success");
      } else if (roleId) {
        await apiClient.patch(`/api/admin/roles/${roleId}`, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          permissionKeys: form.permissionKeys,
        });
        showToast("Role updated.", "success");
      }
      router.push("/roles");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "CANNOT_REMOVE_CRITICAL_PERMISSION") {
        const removed = (err.details?.permissions as string[] | undefined) ?? [];
        setFormError(
          removed.length > 0
            ? `This change would remove a critical permission you depend on (${removed.join(", ")}), with no other role granting it to you.`
            : friendlyErrorMessage(err),
        );
      } else {
        setFormError(friendlyErrorMessage(err));
      }
      setFieldErrors((prev) => ({ ...prev, ...fieldErrorsFrom(err) }));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <PageHeader title={mode === "create" ? "New Role" : "Edit Role"} description="Role name, description, and permissions." />

      {formError ? (
        <div role="alert" style={{ marginBottom: "1rem", padding: "0.75rem", borderRadius: 6, background: "#fef2f2", color: "#dc2626", fontSize: "0.875rem" }}>
          {formError}
        </div>
      ) : null}

      {isSystem ? (
        <p style={{ marginBottom: "1rem", color: "#6b7280", fontSize: "0.875rem" }}>
          This is a system role and cannot be modified.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} style={{ maxWidth: 560 }} noValidate>
        <FormField label="Name" htmlFor="role-name" error={fieldErrors.name} required>
          <Input
            id="role-name"
            value={form.name}
            disabled={isSystem}
            hasError={Boolean(fieldErrors.name)}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </FormField>

        <FormField label="Description" htmlFor="role-description">
          <Textarea
            id="role-description"
            value={form.description}
            disabled={isSystem}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </FormField>

        <FormField label="Permissions" error={fieldErrors.permissions}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {Object.entries(groupedCatalog).map(([resource, entries]) => (
              <div key={resource}>
                <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", textTransform: "uppercase", color: "#6b7280" }}>
                  {resource}
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  {entries.map((entry) => (
                    <Checkbox
                      key={entry.key}
                      label={entry.description ? `${entry.key} — ${entry.description}` : entry.key}
                      checked={form.permissionKeys.includes(entry.key)}
                      disabled={isSystem}
                      onChange={() => togglePermission(entry.key)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </FormField>

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <Button type="submit" isLoading={isSubmitting} disabled={isSystem}>
            {mode === "create" ? "Create Role" : "Save Changes"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push("/roles")} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
