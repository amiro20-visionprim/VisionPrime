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
  RuleBuilder,
  RuleBuilderRule,
  Select,
  StatusBadge,
  Switch,
} from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-client";
import { friendlyErrorMessage } from "../../lib/error-message";
import { PaginationMeta, Segment, SegmentMember } from "../../lib/types";

const CONDITION_TYPES = [
  { value: "purchase_count", label: "Purchase count" },
  { value: "total_spent", label: "Total spent" },
  { value: "last_purchase_at", label: "Days since last purchase" },
  { value: "average_order_value", label: "Average order value" },
  { value: "city", label: "City" },
  { value: "gender", label: "Gender" },
  { value: "tier", label: "Loyalty tier" },
  { value: "wallet_balance", label: "Wallet balance" },
  { value: "points", label: "Points balance" },
  { value: "reward_status", label: "Reward claim status" },
  { value: "campaign_received", label: "Received campaign" },
  { value: "campaign_clicked", label: "Clicked campaign" },
  { value: "churn_risk", label: "Churn risk (days since last purchase)" },
  { value: "woocommerce_product_bought", label: "Bought WooCommerce product" },
  { value: "woocommerce_category_bought", label: "Bought from category" },
  { value: "coupon_used", label: "Used coupon" },
];

const OPERATORS = [
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "eq", label: "=" },
  { value: "in", label: "in" },
];

const PAGE_SIZE = 20;
const EMPTY_META: PaginationMeta = { page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 };

interface SegmentFormState {
  name: string;
  description: string;
  segmentType: "dynamic" | "static";
  isActive: boolean;
  rules: RuleBuilderRule[];
  memberCustomerIds: string;
}

const EMPTY_FORM: SegmentFormState = {
  name: "",
  description: "",
  segmentType: "dynamic",
  isActive: true,
  rules: [],
  memberCustomerIds: "",
};

function conditionValueToString(value: unknown): string {
  if (value && typeof value === "object") {
    const v = value as { value?: unknown; values?: unknown[] };
    if (Array.isArray(v.values)) return v.values.join(",");
    if (v.value !== undefined) return String(v.value);
  }
  return "";
}

function ruleToConditionValue(rule: RuleBuilderRule): unknown {
  if (rule.operator === "in") {
    return { values: rule.value.split(",").map((v) => v.trim()).filter(Boolean) };
  }
  return { value: rule.value };
}

export default function SegmentsPage() {
  const { permissions, isSuperAdmin } = useAuth();
  const userPermissions = isSuperAdmin ? undefined : permissions;
  const canManage = isSuperAdmin || (permissions ?? []).includes("segment:update");
  const canDelete = isSuperAdmin || (permissions ?? []).includes("segment:delete");
  const canEvaluate = isSuperAdmin || (permissions ?? []).includes("segment:evaluate");

  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SegmentFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);

  const [detailSegment, setDetailSegment] = useState<Segment | null>(null);
  const [members, setMembers] = useState<SegmentMember[]>([]);
  const [membersMeta, setMembersMeta] = useState<PaginationMeta>(EMPTY_META);
  const [membersPage, setMembersPage] = useState(1);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const loadSegments = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.getWithMeta<Segment[]>("/api/admin/segments?pageSize=100");
      setSegments(result.data);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSegments();
  }, [loadSegments]);

  const loadMembers = useCallback(async (segmentId: string, targetPage: number) => {
    setIsLoadingMembers(true);
    try {
      const result = await apiClient.getWithMeta<SegmentMember[]>(
        `/api/admin/segments/${segmentId}/members?page=${targetPage}&pageSize=${PAGE_SIZE}`,
      );
      setMembers(result.data);
      setMembersMeta(result.meta as unknown as PaginationMeta);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setIsLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    if (detailSegment) loadMembers(detailSegment.id, membersPage);
  }, [detailSegment, membersPage, loadMembers]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEdit(segment: Segment) {
    setEditingId(segment.id);
    setForm({
      name: segment.name,
      description: segment.description ?? "",
      segmentType: segment.segmentType,
      isActive: segment.isActive,
      rules: segment.conditions.map((c) => ({
        conditionType: c.conditionType,
        operator: c.operator,
        value: conditionValueToString(c.value),
      })),
      memberCustomerIds: "",
    });
    setFormError(null);
    setIsFormOpen(true);
  }

  function openDetail(segment: Segment) {
    setMembersPage(1);
    setDetailSegment(segment);
  }

  async function submitForm() {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const conditions = form.rules
        .filter((r) => r.conditionType)
        .map((r) => ({ conditionType: r.conditionType, operator: r.operator, value: ruleToConditionValue(r) }));
      if (editingId) {
        await apiClient.patch(`/api/admin/segments/${editingId}`, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          isActive: form.isActive,
          conditions,
        });
      } else {
        const payload: Record<string, unknown> = {
          name: form.name.trim(),
          description: form.description.trim() || null,
          segmentType: form.segmentType,
          isActive: form.isActive,
        };
        if (form.segmentType === "dynamic") {
          payload.conditions = conditions;
        } else {
          payload.memberCustomerIds = form.memberCustomerIds.split(",").map((v) => v.trim()).filter(Boolean);
        }
        await apiClient.post("/api/admin/segments", payload);
      }
      setIsFormOpen(false);
      await loadSegments();
    } catch (err) {
      setFormError(friendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;
    try {
      await apiClient.delete(`/api/admin/segments/${deletingId}`);
      setDeletingId(null);
      await loadSegments();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  }

  async function evaluateSegment(id: string) {
    setEvaluatingId(id);
    try {
      await apiClient.post(`/api/admin/segments/${id}/evaluate`, {});
      await loadSegments();
      if (detailSegment?.id === id) {
        await loadMembers(id, membersPage);
      }
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setEvaluatingId(null);
    }
  }

  const columns: DataTableColumn<Segment>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <a onClick={() => openDetail(row)} style={{ cursor: "pointer", color: "#2563eb" }}>
          {row.name}
        </a>
      ),
    },
    { key: "segmentType", header: "Type" },
    { key: "memberCount", header: "Members" },
    {
      key: "lastEvaluatedAt",
      header: "Last evaluated",
      render: (row) => (row.lastEvaluatedAt ? new Date(row.lastEvaluatedAt).toLocaleString() : "Never"),
    },
    { key: "isActive", header: "Status", render: (row) => <StatusBadge status={row.isActive ? "active" : "inactive"} /> },
  ];

  return (
    <div>
      <PageHeader title="Segments" description="Group customers by behavior or attributes to target with campaigns." />

      <Can permission="segment:create" userPermissions={userPermissions}>
        <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={openCreate}>New Segment</Button>
        </div>
      </Can>

      <DataTable<Segment>
        columns={columns}
        rows={segments}
        isLoading={isLoading}
        error={error}
        onRetry={loadSegments}
        emptyTitle="No segments yet."
        emptyDescription="Create a segment to target customers by behavior or attributes."
        renderRowActions={
          canManage || canDelete || canEvaluate
            ? (row) => (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {canEvaluate && row.segmentType === "dynamic" ? (
                    <Button variant="secondary" onClick={() => evaluateSegment(row.id)} isLoading={evaluatingId === row.id}>
                      Evaluate
                    </Button>
                  ) : null}
                  {canManage ? (
                    <Button variant="secondary" onClick={() => openEdit(row)}>
                      Edit
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
        title={editingId ? "Edit Segment" : "New Segment"}
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
        <FormField label="Name" htmlFor="segment-name" required>
          <Input id="segment-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </FormField>
        <FormField label="Description" htmlFor="segment-description">
          <Input
            id="segment-description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </FormField>
        {!editingId ? (
          <FormField label="Type" htmlFor="segment-type" required>
            <Select
              id="segment-type"
              value={form.segmentType}
              onChange={(e) => setForm((f) => ({ ...f, segmentType: e.target.value as "dynamic" | "static" }))}
              options={[
                { value: "dynamic", label: "Dynamic (rule-based)" },
                { value: "static", label: "Static (fixed member list)" },
              ]}
            />
          </FormField>
        ) : null}
        <FormField label="Active" htmlFor="segment-active">
          <Switch checked={form.isActive} onChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))} aria-label="Active" />
        </FormField>
        {form.segmentType === "dynamic" ? (
          <FormField label="Conditions">
            <RuleBuilder
              rules={form.rules}
              conditionTypes={CONDITION_TYPES}
              operators={OPERATORS}
              onChange={(rules) => setForm((f) => ({ ...f, rules }))}
            />
          </FormField>
        ) : !editingId ? (
          <FormField label="Member customer IDs" hint="Comma-separated customer IDs.">
            <Input
              value={form.memberCustomerIds}
              onChange={(e) => setForm((f) => ({ ...f, memberCustomerIds: e.target.value }))}
            />
          </FormField>
        ) : null}
      </Modal>

      <Drawer isOpen={detailSegment !== null} onClose={() => setDetailSegment(null)} title={detailSegment?.name ?? "Segment"}>
        {detailSegment ? (
          <div>
            <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>{detailSegment.description ?? "No description."}</p>
            <p style={{ fontSize: "0.875rem" }}>
              Type: <strong>{detailSegment.segmentType}</strong> · Members: <strong>{detailSegment.memberCount}</strong>
            </p>
            <h4 style={{ marginTop: "1.5rem" }}>Conditions</h4>
            {detailSegment.conditions.length === 0 ? (
              <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>No conditions.</p>
            ) : (
              <ul style={{ fontSize: "0.875rem" }}>
                {detailSegment.conditions.map((c) => (
                  <li key={c.id}>
                    {c.conditionType} {c.operator} {conditionValueToString(c.value)}
                  </li>
                ))}
              </ul>
            )}
            <h4 style={{ marginTop: "1.5rem" }}>Members</h4>
            <DataTable<SegmentMember & { id: string }>
              columns={[
                { key: "customerId", header: "Customer ID" },
                { key: "addedAt", header: "Added", render: (row) => new Date(row.addedAt).toLocaleString() },
              ]}
              rows={members.map((m) => ({ ...m, id: m.customerId }))}
              isLoading={isLoadingMembers}
              emptyTitle="No members yet."
              pagination={{
                page: membersMeta.page,
                pageSize: membersMeta.pageSize,
                totalItems: membersMeta.totalItems,
                totalPages: membersMeta.totalPages,
                onPageChange: setMembersPage,
              }}
            />
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        isOpen={deletingId !== null}
        title="Delete segment?"
        message="This segment and its conditions will be permanently removed."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
