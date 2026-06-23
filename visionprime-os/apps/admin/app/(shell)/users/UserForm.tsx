"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, MultiSelect, PageHeader, Switch, useToast } from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { fieldErrorsFrom, friendlyErrorMessage } from "../../lib/error-message";
import { AdminRole, AdminUser } from "../../lib/types";

interface UserFormProps {
  mode: "create" | "edit";
  userId?: string;
}

interface FormState {
  email: string;
  password: string;
  fullName: string;
  isActive: boolean;
  roleIds: string[];
}

const INITIAL_STATE: FormState = {
  email: "",
  password: "",
  fullName: "",
  isActive: true,
  roleIds: [],
};

export function UserForm({ mode, userId }: UserFormProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [roleOptions, setRoleOptions] = useState<AdminRole[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const roles = await apiClient.get<AdminRole[]>("/api/admin/roles?page=1&pageSize=100");
        if (!isMounted) return;
        setRoleOptions(roles);

        if (mode === "edit" && userId) {
          const [user, userRoleIds] = await Promise.all([
            apiClient.get<AdminUser>(`/api/admin/users/${userId}`),
            // Effective role IDs are not returned by GET /users/:id directly;
            // fall back to an empty selection if unavailable so the form
            // still renders rather than throwing.
            Promise.resolve<string[]>([]),
          ]);
          if (!isMounted) return;
          setForm({
            email: user.email,
            password: "",
            fullName: user.full_name,
            isActive: user.is_active,
            roleIds: userRoleIds,
          });
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
  }, [mode, userId]);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.email.trim()) {
      errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    if (mode === "create" && form.password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }
    if (!form.fullName.trim()) {
      errors.fullName = "Full name is required.";
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
        await apiClient.post("/api/admin/users", {
          email: form.email.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          roleIds: form.roleIds.length > 0 ? form.roleIds : undefined,
        });
        showToast("User created.", "success");
      } else if (userId) {
        await apiClient.patch(`/api/admin/users/${userId}`, {
          fullName: form.fullName.trim(),
          isActive: form.isActive,
          roleIds: form.roleIds,
        });
        showToast("User updated.", "success");
      }
      router.push("/users");
    } catch (err) {
      setFormError(friendlyErrorMessage(err));
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
      <PageHeader title={mode === "create" ? "New User" : "Edit User"} description="Admin user account details." />

      {formError ? (
        <div role="alert" style={{ marginBottom: "1rem", padding: "0.75rem", borderRadius: 6, background: "#fef2f2", color: "#dc2626", fontSize: "0.875rem" }}>
          {formError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} style={{ maxWidth: 480 }} noValidate>
        <FormField label="Email" htmlFor="user-email" error={fieldErrors.email} required>
          <Input
            id="user-email"
            type="email"
            value={form.email}
            disabled={mode === "edit"}
            hasError={Boolean(fieldErrors.email)}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </FormField>

        {mode === "create" ? (
          <FormField label="Password" htmlFor="user-password" error={fieldErrors.password} required hint="At least 8 characters.">
            <Input
              id="user-password"
              type="password"
              value={form.password}
              hasError={Boolean(fieldErrors.password)}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </FormField>
        ) : null}

        <FormField label="Full name" htmlFor="user-fullname" error={fieldErrors.fullName} required>
          <Input
            id="user-fullname"
            value={form.fullName}
            hasError={Boolean(fieldErrors.fullName)}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          />
        </FormField>

        {mode === "edit" ? (
          <FormField label="Active">
            <Switch
              aria-label="User active"
              checked={form.isActive}
              onChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
            />
          </FormField>
        ) : null}

        <FormField label="Roles" hint="Permissions are determined by assigned roles.">
          <MultiSelect
            options={roleOptions.map((role) => ({ value: role.id, label: role.name }))}
            value={form.roleIds}
            onChange={(roleIds) => setForm((f) => ({ ...f, roleIds }))}
            placeholder="No roles available"
          />
        </FormField>

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <Button type="submit" isLoading={isSubmitting}>
            {mode === "create" ? "Create User" : "Save Changes"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push("/users")} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
