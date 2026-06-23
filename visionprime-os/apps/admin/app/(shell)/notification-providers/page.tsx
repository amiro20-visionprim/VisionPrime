"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Can,
  ConfirmDialog,
  DataTable,
  DataTableColumn,
  Drawer,
  FormField,
  Input,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  Switch,
  Tabs,
} from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-client";
import { friendlyErrorMessage } from "../../lib/error-message";
import {
  NotificationChannel,
  NotificationOptOut,
  NotificationProvider,
  PaginationMeta,
  SuppressionList,
  SuppressionListMember,
} from "../../lib/types";

const CHANNELS: { value: NotificationChannel; label: string }[] = [
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "in_app", label: "In-app" },
];

const PAGE_SIZE = 20;
const EMPTY_META: PaginationMeta = { page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 };

interface ProviderFormState {
  name: string;
  channel: NotificationChannel;
  providerType: string;
  credentials: string;
  isActive: boolean;
}

const EMPTY_PROVIDER_FORM: ProviderFormState = {
  name: "",
  channel: "email",
  providerType: "",
  credentials: "",
  isActive: true,
};

export default function NotificationProvidersPage() {
  const { permissions, isSuperAdmin } = useAuth();
  const userPermissions = isSuperAdmin ? undefined : permissions;
  const canManage = isSuperAdmin || (permissions ?? []).includes("notification_provider:manage");

  const [tab, setTab] = useState("providers");

  const [providers, setProviders] = useState<NotificationProvider[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [providersError, setProvidersError] = useState<string | undefined>(undefined);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProviderFormState>(EMPTY_PROVIDER_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [optOuts, setOptOuts] = useState<NotificationOptOut[]>([]);
  const [isLoadingOptOuts, setIsLoadingOptOuts] = useState(false);

  const [suppressionLists, setSuppressionLists] = useState<SuppressionList[]>([]);
  const [isLoadingSuppressionLists, setIsLoadingSuppressionLists] = useState(false);
  const [detailList, setDetailList] = useState<SuppressionList | null>(null);
  const [listMembers, setListMembers] = useState<SuppressionListMember[]>([]);
  const [newListName, setNewListName] = useState("");
  const [newMemberCustomerId, setNewMemberCustomerId] = useState("");

  const loadProviders = useCallback(async () => {
    setIsLoadingProviders(true);
    setProvidersError(undefined);
    try {
      const result = await apiClient.getWithMeta<NotificationProvider[]>("/api/admin/notification-providers?pageSize=100");
      setProviders(result.data);
    } catch (err) {
      setProvidersError(friendlyErrorMessage(err));
    } finally {
      setIsLoadingProviders(false);
    }
  }, []);

  const loadOptOuts = useCallback(async () => {
    setIsLoadingOptOuts(true);
    try {
      const result = await apiClient.get<NotificationOptOut[]>("/api/admin/notification-opt-outs");
      setOptOuts(result);
    } catch (err) {
      setProvidersError(friendlyErrorMessage(err));
    } finally {
      setIsLoadingOptOuts(false);
    }
  }, []);

  const loadSuppressionLists = useCallback(async () => {
    setIsLoadingSuppressionLists(true);
    try {
      const result = await apiClient.getWithMeta<SuppressionList[]>("/api/admin/suppression-lists?pageSize=100");
      setSuppressionLists(result.data);
    } catch (err) {
      setProvidersError(friendlyErrorMessage(err));
    } finally {
      setIsLoadingSuppressionLists(false);
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  useEffect(() => {
    if (tab === "opt-outs") loadOptOuts();
    if (tab === "suppression") loadSuppressionLists();
  }, [tab, loadOptOuts, loadSuppressionLists]);

  useEffect(() => {
    if (detailList) {
      apiClient
        .get<SuppressionListMember[]>(`/api/admin/suppression-lists/${detailList.id}/members`)
        .then(setListMembers)
        .catch((err) => setProvidersError(friendlyErrorMessage(err)));
    }
  }, [detailList]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_PROVIDER_FORM);
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEdit(provider: NotificationProvider) {
    setEditingId(provider.id);
    setForm({
      name: provider.name,
      channel: provider.channel,
      providerType: provider.providerType,
      credentials: "",
      isActive: provider.isActive,
    });
    setFormError(null);
    setIsFormOpen(true);
  }

  async function submitForm() {
    setFormError(null);
    if (!form.name.trim() || !form.providerType.trim()) {
      setFormError("Name and provider type are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingId) {
        await apiClient.patch(`/api/admin/notification-providers/${editingId}`, {
          name: form.name.trim(),
          providerType: form.providerType.trim(),
          credentials: form.credentials.trim() || undefined,
          isActive: form.isActive,
        });
      } else {
        await apiClient.post("/api/admin/notification-providers", {
          name: form.name.trim(),
          channel: form.channel,
          providerType: form.providerType.trim(),
          credentials: form.credentials.trim() || null,
          isActive: form.isActive,
        });
      }
      setIsFormOpen(false);
      await loadProviders();
    } catch (err) {
      setFormError(friendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function removeOptOut(customerId: string, channel: string) {
    try {
      await apiClient.delete(`/api/admin/notification-opt-outs/${customerId}/${channel}`);
      await loadOptOuts();
    } catch (err) {
      setProvidersError(friendlyErrorMessage(err));
    }
  }

  async function createSuppressionList() {
    if (!newListName.trim()) return;
    try {
      await apiClient.post("/api/admin/suppression-lists", { name: newListName.trim() });
      setNewListName("");
      await loadSuppressionLists();
    } catch (err) {
      setProvidersError(friendlyErrorMessage(err));
    }
  }

  async function addMember() {
    if (!detailList || !newMemberCustomerId.trim()) return;
    try {
      await apiClient.post(`/api/admin/suppression-lists/${detailList.id}/members`, { customerId: newMemberCustomerId.trim() });
      setNewMemberCustomerId("");
      const members = await apiClient.get<SuppressionListMember[]>(`/api/admin/suppression-lists/${detailList.id}/members`);
      setListMembers(members);
    } catch (err) {
      setProvidersError(friendlyErrorMessage(err));
    }
  }

  async function removeMember(customerId: string) {
    if (!detailList) return;
    try {
      await apiClient.delete(`/api/admin/suppression-lists/${detailList.id}/members/${customerId}`);
      const members = await apiClient.get<SuppressionListMember[]>(`/api/admin/suppression-lists/${detailList.id}/members`);
      setListMembers(members);
    } catch (err) {
      setProvidersError(friendlyErrorMessage(err));
    }
  }

  const providerColumns: DataTableColumn<NotificationProvider>[] = [
    { key: "name", header: "Name" },
    { key: "channel", header: "Channel" },
    { key: "providerType", header: "Type" },
    { key: "credentialsPreview", header: "Credentials", render: (row) => row.credentialsPreview ?? "Not set" },
    { key: "isActive", header: "Status", render: (row) => <StatusBadge status={row.isActive ? "active" : "inactive"} /> },
  ];

  return (
    <div>
      <PageHeader title="Notification Providers" description="Configure SMS/email providers, opt-outs, and suppression lists." />

      <Tabs
        tabs={[
          { key: "providers", label: "Providers" },
          { key: "opt-outs", label: "Opt-outs" },
          { key: "suppression", label: "Suppression lists" },
        ]}
        activeKey={tab}
        onChange={setTab}
      />

      <div style={{ marginTop: "1rem" }}>
        {tab === "providers" ? (
          <div>
            <Can permission="notification_provider:manage" userPermissions={userPermissions}>
              <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
                <Button onClick={openCreate}>New Provider</Button>
              </div>
            </Can>
            <DataTable<NotificationProvider>
              columns={providerColumns}
              rows={providers}
              isLoading={isLoadingProviders}
              error={providersError}
              onRetry={loadProviders}
              emptyTitle="No providers configured."
              emptyDescription="Add an SMS or email provider to enable campaign sending."
              renderRowActions={
                canManage
                  ? (row) => (
                      <Button variant="secondary" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                    )
                  : undefined
              }
            />
          </div>
        ) : null}

        {tab === "opt-outs" ? (
          <DataTable<NotificationOptOut>
            columns={[
              { key: "customerId", header: "Customer ID" },
              { key: "channel", header: "Channel" },
              { key: "reason", header: "Reason", render: (row) => row.reason ?? "" },
              { key: "createdAt", header: "Created", render: (row) => new Date(row.createdAt).toLocaleString() },
            ]}
            rows={optOuts}
            isLoading={isLoadingOptOuts}
            emptyTitle="No opt-outs."
            renderRowActions={
              canManage
                ? (row) => (
                    <Button variant="danger" onClick={() => removeOptOut(row.customerId, row.channel)}>
                      Remove
                    </Button>
                  )
                : undefined
            }
          />
        ) : null}

        {tab === "suppression" ? (
          <div>
            <Can permission="notification_provider:manage" userPermissions={userPermissions}>
              <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem" }}>
                <Input
                  placeholder="New list name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button onClick={createSuppressionList}>Create list</Button>
              </div>
            </Can>
            <DataTable<SuppressionList>
              columns={[
                {
                  key: "name",
                  header: "Name",
                  render: (row) => (
                    <a onClick={() => setDetailList(row)} style={{ cursor: "pointer", color: "#2563eb" }}>
                      {row.name}
                    </a>
                  ),
                },
                { key: "isActive", header: "Status", render: (row) => <StatusBadge status={row.isActive ? "active" : "inactive"} /> },
              ]}
              rows={suppressionLists}
              isLoading={isLoadingSuppressionLists}
              emptyTitle="No suppression lists."
            />
          </div>
        ) : null}
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingId ? "Edit Provider" : "New Provider"}
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
        <FormField label="Name" htmlFor="provider-name" required>
          <Input id="provider-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </FormField>
        {!editingId ? (
          <FormField label="Channel" htmlFor="provider-channel" required>
            <Select
              id="provider-channel"
              value={form.channel}
              onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as NotificationChannel }))}
              options={CHANNELS}
            />
          </FormField>
        ) : null}
        <FormField label="Provider type" htmlFor="provider-type" required hint="e.g. twilio, sendgrid">
          <Input
            id="provider-type"
            value={form.providerType}
            onChange={(e) => setForm((f) => ({ ...f, providerType: e.target.value }))}
          />
        </FormField>
        <FormField label="Credentials" htmlFor="provider-credentials" hint="Stored encrypted. Leave blank to keep existing.">
          <Input
            id="provider-credentials"
            type="password"
            value={form.credentials}
            onChange={(e) => setForm((f) => ({ ...f, credentials: e.target.value }))}
          />
        </FormField>
        <FormField label="Active" htmlFor="provider-active">
          <Switch checked={form.isActive} onChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))} aria-label="Active" />
        </FormField>
      </Modal>

      <Drawer isOpen={detailList !== null} onClose={() => setDetailList(null)} title={detailList?.name ?? "Suppression list"}>
        {detailList ? (
          <div>
            <Can permission="notification_provider:manage" userPermissions={userPermissions}>
              <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem" }}>
                <Input
                  placeholder="Customer ID"
                  value={newMemberCustomerId}
                  onChange={(e) => setNewMemberCustomerId(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button onClick={addMember}>Add</Button>
              </div>
            </Can>
            <DataTable<SuppressionListMember & { id: string }>
              columns={[{ key: "customerId", header: "Customer ID" }]}
              rows={listMembers.map((m) => ({ ...m, id: m.customerId }))}
              emptyTitle="No members yet."
              renderRowActions={
                canManage
                  ? (row) => (
                      <Button variant="danger" onClick={() => removeMember(row.customerId)}>
                        Remove
                      </Button>
                    )
                  : undefined
              }
            />
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
