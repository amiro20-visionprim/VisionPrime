"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Can,
  ConfirmDialog,
  DataTable,
  DataTableColumn,
  FormField,
  Input,
  Modal,
  PageHeader,
  Select,
} from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-client";
import { friendlyErrorMessage } from "../../lib/error-message";
import { MessageTemplate, NotificationChannel } from "../../lib/types";

const CHANNELS: { value: NotificationChannel; label: string }[] = [
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "in_app", label: "In-app" },
];

interface TemplateFormState {
  name: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  variables: string;
}

const EMPTY_FORM: TemplateFormState = { name: "", channel: "email", subject: "", body: "", variables: "" };

export default function MessageTemplatesPage() {
  const { permissions, isSuperAdmin } = useAuth();
  const userPermissions = isSuperAdmin ? undefined : permissions;
  const canManage = isSuperAdmin || (permissions ?? []).includes("message_template:manage");

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.getWithMeta<MessageTemplate[]>("/api/admin/message-templates?pageSize=100");
      setTemplates(result.data);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEdit(template: MessageTemplate) {
    setEditingId(template.id);
    setForm({
      name: template.name,
      channel: template.channel,
      subject: template.subject ?? "",
      body: template.body,
      variables: template.variables.join(","),
    });
    setFormError(null);
    setIsFormOpen(true);
  }

  async function submitForm() {
    setFormError(null);
    if (!form.name.trim() || !form.body.trim()) {
      setFormError("Name and body are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        channel: form.channel,
        subject: form.subject.trim() || null,
        body: form.body,
        variables: form.variables.split(",").map((v) => v.trim()).filter(Boolean),
      };
      if (editingId) {
        await apiClient.patch(`/api/admin/message-templates/${editingId}`, payload);
      } else {
        await apiClient.post("/api/admin/message-templates", payload);
      }
      setIsFormOpen(false);
      await loadTemplates();
    } catch (err) {
      setFormError(friendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;
    try {
      await apiClient.delete(`/api/admin/message-templates/${deletingId}`);
      setDeletingId(null);
      await loadTemplates();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  }

  const columns: DataTableColumn<MessageTemplate>[] = [
    { key: "name", header: "Name" },
    { key: "channel", header: "Channel" },
    { key: "variables", header: "Variables", render: (row) => row.variables.join(", ") },
  ];

  return (
    <div>
      <PageHeader title="Message Templates" description="Reusable message bodies for campaigns, with declared variables." />

      <Can permission="message_template:manage" userPermissions={userPermissions}>
        <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={openCreate}>New Template</Button>
        </div>
      </Can>

      <DataTable<MessageTemplate>
        columns={columns}
        rows={templates}
        isLoading={isLoading}
        error={error}
        onRetry={loadTemplates}
        emptyTitle="No templates yet."
        emptyDescription="Create a message template to use in campaigns."
        renderRowActions={
          canManage
            ? (row) => (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <Button variant="secondary" onClick={() => openEdit(row)}>
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => setDeletingId(row.id)}>
                    Delete
                  </Button>
                </div>
              )
            : undefined
        }
      />

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingId ? "Edit Template" : "New Template"}
        footer={
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitForm} isLoading={isSubmitting}>
              Save
            </Button>
          </div>
        }
      >
        {formError ? (
          <div role="alert" style={{ marginBottom: "1rem", padding: "0.75rem", borderRadius: 6, background: "#fef2f2", color: "#dc2626", fontSize: "0.875rem" }}>
            {formError}
          </div>
        ) : null}
        <FormField label="Name" htmlFor="template-name" required>
          <Input id="template-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </FormField>
        <FormField label="Channel" htmlFor="template-channel" required>
          <Select
            id="template-channel"
            value={form.channel}
            onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as NotificationChannel }))}
            options={CHANNELS}
          />
        </FormField>
        {form.channel === "email" ? (
          <FormField label="Subject" htmlFor="template-subject">
            <Input id="template-subject" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
          </FormField>
        ) : null}
        <FormField label="Body" htmlFor="template-body" required hint="Use {{variableName}} placeholders.">
          <Input id="template-body" value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
        </FormField>
        <FormField label="Variables" htmlFor="template-variables" hint="Comma-separated list of declared variable names.">
          <Input
            id="template-variables"
            value={form.variables}
            onChange={(e) => setForm((f) => ({ ...f, variables: e.target.value }))}
          />
        </FormField>
      </Modal>

      <ConfirmDialog
        isOpen={deletingId !== null}
        title="Delete template?"
        message="This message template will be permanently removed."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
