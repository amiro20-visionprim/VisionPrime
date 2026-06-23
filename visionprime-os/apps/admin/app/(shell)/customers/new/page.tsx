"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, PageHeader } from "@visionprime/ui";
import { apiClient } from "../../../lib/api-client";
import { fieldErrorsFrom, friendlyErrorMessage } from "../../../lib/error-message";

interface FormState {
  fullName: string;
  primaryEmail: string;
  primaryMobile: string;
}

const INITIAL_STATE: FormState = { fullName: "", primaryEmail: "", primaryMobile: "" };

export default function NewCustomerPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.fullName.trim()) {
      errors.fullName = "Full name is required.";
    }
    if (!form.primaryEmail.trim() && !form.primaryMobile.trim()) {
      errors.primaryEmail = "Provide an email or mobile number.";
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
      const created = await apiClient.post<{ id: string }>("/api/admin/customers", {
        fullName: form.fullName.trim(),
        primaryEmail: form.primaryEmail.trim() || undefined,
        primaryMobile: form.primaryMobile.trim() || undefined,
      });
      router.push(`/customers/${created.id}`);
    } catch (err) {
      setFormError(friendlyErrorMessage(err));
      setFieldErrors((prev) => ({ ...prev, ...fieldErrorsFrom(err) }));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="New Customer" description="Manually create a customer record." />

      {formError ? (
        <div role="alert" style={{ marginBottom: "1rem", padding: "0.75rem", borderRadius: 6, background: "#fef2f2", color: "#dc2626", fontSize: "0.875rem" }}>
          {formError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} style={{ maxWidth: 480 }} noValidate>
        <FormField label="Full name" htmlFor="customer-fullname" error={fieldErrors.fullName} required>
          <Input
            id="customer-fullname"
            value={form.fullName}
            hasError={Boolean(fieldErrors.fullName)}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          />
        </FormField>

        <FormField label="Email" htmlFor="customer-email" error={fieldErrors.primaryEmail}>
          <Input
            id="customer-email"
            type="email"
            value={form.primaryEmail}
            hasError={Boolean(fieldErrors.primaryEmail)}
            onChange={(e) => setForm((f) => ({ ...f, primaryEmail: e.target.value }))}
          />
        </FormField>

        <FormField label="Mobile" htmlFor="customer-mobile" error={fieldErrors.primaryMobile}>
          <Input
            id="customer-mobile"
            value={form.primaryMobile}
            hasError={Boolean(fieldErrors.primaryMobile)}
            onChange={(e) => setForm((f) => ({ ...f, primaryMobile: e.target.value }))}
          />
        </FormField>

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <Button type="submit" isLoading={isSubmitting}>
            Create Customer
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push("/customers")} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
