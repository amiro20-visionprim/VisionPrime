"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Can,
  ChartCard,
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
} from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-client";
import { friendlyErrorMessage } from "../../lib/error-message";
import {
  Campaign,
  CampaignPreview,
  CampaignRecipient,
  CampaignReport,
  MessageTemplate,
  NotificationChannel,
  PaginationMeta,
  Segment,
} from "../../lib/types";

const CHANNELS: { value: NotificationChannel; label: string }[] = [
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "in_app", label: "In-app" },
];

const PAGE_SIZE = 20;
const EMPTY_META: PaginationMeta = { page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 };

interface CampaignFormState {
  name: string;
  segmentId: string;
  channel: NotificationChannel;
  messageTemplateId: string;
  requiresApproval: boolean;
}

const EMPTY_FORM: CampaignFormState = {
  name: "",
  segmentId: "",
  channel: "email",
  messageTemplateId: "",
  requiresApproval: false,
};

export default function CampaignsPage() {
  const { permissions, isSuperAdmin } = useAuth();
  const userPermissions = isSuperAdmin ? undefined : permissions;
  const canManage = isSuperAdmin || (permissions ?? []).includes("campaign:update");
  const canDelete = isSuperAdmin || (permissions ?? []).includes("campaign:delete");
  const canSend = isSuperAdmin || (permissions ?? []).includes("campaign:send");
  const canViewReport = isSuperAdmin || (permissions ?? []).includes("campaign:report:view");

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<CampaignFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [preview, setPreview] = useState<CampaignPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [recipientsMeta, setRecipientsMeta] = useState<PaginationMeta>(EMPTY_META);
  const [recipientsPage, setRecipientsPage] = useState(1);
  const [report, setReport] = useState<CampaignReport | null>(null);

  const loadCampaigns = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.getWithMeta<Campaign[]>("/api/admin/campaigns?pageSize=100");
      setCampaigns(result.data);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
    apiClient
      .getWithMeta<Segment[]>("/api/admin/segments?pageSize=100")
      .then((r) => setSegments(r.data))
      .catch(() => undefined);
    apiClient
      .getWithMeta<MessageTemplate[]>("/api/admin/message-templates?pageSize=100")
      .then((r) => setTemplates(r.data))
      .catch(() => undefined);
  }, [loadCampaigns]);

  const loadDetail = useCallback(async (campaign: Campaign, targetPage: number) => {
    setIsLoadingPreview(true);
    setReport(null);
    setPreview(null);
    try {
      const previewResult = await apiClient.post<CampaignPreview>(`/api/admin/campaigns/${campaign.id}/preview`, {});
      setPreview(previewResult);
      const recipientsResult = await apiClient.getWithMeta<CampaignRecipient[]>(
        `/api/admin/campaigns/${campaign.id}/recipients?page=${targetPage}&pageSize=${PAGE_SIZE}`,
      );
      setRecipients(recipientsResult.data);
      setRecipientsMeta(recipientsResult.meta as unknown as PaginationMeta);
      if (campaign.status !== "draft" && campaign.status !== "pending_approval") {
        const reportResult = await apiClient.get<CampaignReport>(`/api/admin/campaigns/${campaign.id}/report`);
        setReport(reportResult);
      }
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setIsLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    if (detailCampaign) loadDetail(detailCampaign, recipientsPage);
  }, [detailCampaign, recipientsPage, loadDetail]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setIsFormOpen(true);
  }

  function openDetail(campaign: Campaign) {
    setRecipientsPage(1);
    setDetailCampaign(campaign);
  }

  async function submitForm() {
    setFormError(null);
    if (!form.name.trim() || !form.segmentId) {
      setFormError("Name and segment are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post("/api/admin/campaigns", {
        name: form.name.trim(),
        segmentId: form.segmentId,
        channel: form.channel,
        messageTemplateId: form.messageTemplateId || null,
        requiresApproval: form.requiresApproval,
      });
      setIsFormOpen(false);
      await loadCampaigns();
    } catch (err) {
      setFormError(friendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;
    try {
      await apiClient.delete(`/api/admin/campaigns/${deletingId}`);
      setDeletingId(null);
      await loadCampaigns();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  }

  async function sendCampaign(id: string) {
    setSendingId(id);
    try {
      await apiClient.post(`/api/admin/campaigns/${id}/send`, {});
      await loadCampaigns();
      if (detailCampaign?.id === id) {
        const updated = await apiClient.get<Campaign>(`/api/admin/campaigns/${id}`);
        setDetailCampaign(updated);
      }
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSendingId(null);
    }
  }

  const segmentOptions = segments.map((s) => ({ value: s.id, label: s.name }));
  const templateOptions = [{ value: "", label: "None" }, ...templates.map((t) => ({ value: t.id, label: t.name }))];

  const columns: DataTableColumn<Campaign>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <a onClick={() => openDetail(row)} style={{ cursor: "pointer", color: "#2563eb" }}>
          {row.name}
        </a>
      ),
    },
    { key: "channel", header: "Channel" },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "sentAt",
      header: "Sent",
      render: (row) => (row.sentAt ? new Date(row.sentAt).toLocaleString() : "Never"),
    },
  ];

  return (
    <div>
      <PageHeader title="Campaigns" description="Send targeted messages to customer segments." />

      <Can permission="campaign:create" userPermissions={userPermissions}>
        <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={openCreate}>New Campaign</Button>
        </div>
      </Can>

      <DataTable<Campaign>
        columns={columns}
        rows={campaigns}
        isLoading={isLoading}
        error={error}
        onRetry={loadCampaigns}
        emptyTitle="No campaigns yet."
        emptyDescription="Create a campaign to message a customer segment."
        renderRowActions={
          canSend || canDelete
            ? (row) => (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {canSend && (row.status === "draft" || row.status === "approved") ? (
                    <Button variant="secondary" onClick={() => sendCampaign(row.id)} isLoading={sendingId === row.id}>
                      Send
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button variant="danger" onClick={() => setDeletingId(row.id)}>
                      Delete
                    </Button>
                  ) : null}
                </div>
              )
            : undefined
        }
      />

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="New Campaign"
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
        <FormField label="Name" htmlFor="campaign-name" required>
          <Input id="campaign-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </FormField>
        <FormField label="Segment" htmlFor="campaign-segment" required>
          <Select
            id="campaign-segment"
            value={form.segmentId}
            onChange={(e) => setForm((f) => ({ ...f, segmentId: e.target.value }))}
            options={[{ value: "", label: "Select a segment" }, ...segmentOptions]}
          />
        </FormField>
        <FormField label="Channel" htmlFor="campaign-channel" required>
          <Select
            id="campaign-channel"
            value={form.channel}
            onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as NotificationChannel }))}
            options={CHANNELS}
          />
        </FormField>
        <FormField label="Message template" htmlFor="campaign-template">
          <Select
            id="campaign-template"
            value={form.messageTemplateId}
            onChange={(e) => setForm((f) => ({ ...f, messageTemplateId: e.target.value }))}
            options={templateOptions}
          />
        </FormField>
      </Modal>

      <Drawer isOpen={detailCampaign !== null} onClose={() => setDetailCampaign(null)} title={detailCampaign?.name ?? "Campaign"}>
        {detailCampaign ? (
          <div>
            <p style={{ fontSize: "0.875rem" }}>
              Channel: <strong>{detailCampaign.channel}</strong> · Status: <StatusBadge status={detailCampaign.status} />
            </p>

            <h4 style={{ marginTop: "1.5rem" }}>Recipient preview</h4>
            {isLoadingPreview ? (
              <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>Loading...</p>
            ) : preview ? (
              <p style={{ fontSize: "0.875rem" }}>
                Eligible recipients: <strong>{preview.eligibleRecipientCount}</strong>
              </p>
            ) : null}

            {canViewReport && report ? (
              <div style={{ marginTop: "1.5rem" }}>
                <ChartCard
                  title="Campaign report"
                  data={[
                    { label: "Sent", value: report.sent },
                    { label: "Failed", value: report.failed },
                    { label: "Skipped", value: report.skipped },
                    { label: "Pending", value: report.pending },
                  ]}
                />
              </div>
            ) : null}

            <h4 style={{ marginTop: "1.5rem" }}>Recipients</h4>
            <DataTable<CampaignRecipient & { id: string }>
              columns={[
                { key: "customerId", header: "Customer ID" },
                { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
                { key: "errorMessage", header: "Error", render: (row) => row.errorMessage ?? "" },
              ]}
              rows={recipients.map((r) => ({ ...r, id: r.id }))}
              isLoading={isLoadingPreview}
              emptyTitle="No recipients yet."
              pagination={{
                page: recipientsMeta.page,
                pageSize: recipientsMeta.pageSize,
                totalItems: recipientsMeta.totalItems,
                totalPages: recipientsMeta.totalPages,
                onPageChange: setRecipientsPage,
              }}
            />
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        isOpen={deletingId !== null}
        title="Delete campaign?"
        message="This campaign and its recipient records will be permanently removed."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
