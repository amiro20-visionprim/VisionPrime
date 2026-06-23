"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Can,
  DataTable,
  DataTableColumn,
  FormField,
  Input,
  MetricCard,
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
import { PaginationMeta, Reward, RewardClaim, RewardRedemption, RewardType } from "../../lib/types";

type TabKey = "catalog" | "claims" | "redemptions" | "analytics";

interface RewardAnalytics {
  totalClaims: number;
  totalRedemptions: number;
}

const PAGE_SIZE = 20;
const EMPTY_META: PaginationMeta = { page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 };

interface RewardFormState {
  name: string;
  description: string;
  rewardType: RewardType;
  pointsCost: string;
  claimValidityDays: string;
  isActive: boolean;
  maxClaims: string;
}

const EMPTY_REWARD_FORM: RewardFormState = {
  name: "",
  description: "",
  rewardType: "free_item",
  pointsCost: "0",
  claimValidityDays: "30",
  isActive: true,
  maxClaims: "",
};

export default function RewardsPage() {
  const { permissions, isSuperAdmin } = useAuth();
  const userPermissions = isSuperAdmin ? undefined : permissions;
  const canManage = isSuperAdmin || (permissions ?? []).includes("reward:update");
  const canDelete = isSuperAdmin || (permissions ?? []).includes("reward:delete");

  const [activeTab, setActiveTab] = useState<TabKey>("catalog");

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [isLoadingRewards, setIsLoadingRewards] = useState(true);
  const [rewardsError, setRewardsError] = useState<string | undefined>(undefined);

  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [claimsMeta, setClaimsMeta] = useState<PaginationMeta>(EMPTY_META);
  const [claimsPage, setClaimsPage] = useState(1);
  const [isLoadingClaims, setIsLoadingClaims] = useState(true);
  const [claimsError, setClaimsError] = useState<string | undefined>(undefined);

  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [redemptionsMeta, setRedemptionsMeta] = useState<PaginationMeta>(EMPTY_META);
  const [redemptionsPage, setRedemptionsPage] = useState(1);
  const [isLoadingRedemptions, setIsLoadingRedemptions] = useState(true);
  const [redemptionsError, setRedemptionsError] = useState<string | undefined>(undefined);

  const [analytics, setAnalytics] = useState<RewardAnalytics | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | undefined>(undefined);

  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [rewardForm, setRewardForm] = useState<RewardFormState>(EMPTY_REWARD_FORM);
  const [isSubmittingReward, setIsSubmittingReward] = useState(false);
  const [rewardFormError, setRewardFormError] = useState<string | null>(null);

  const loadRewards = useCallback(async () => {
    setIsLoadingRewards(true);
    setRewardsError(undefined);
    try {
      const result = await apiClient.getWithMeta<Reward[]>("/api/admin/rewards?pageSize=100");
      setRewards(result.data);
    } catch (err) {
      setRewardsError(friendlyErrorMessage(err));
    } finally {
      setIsLoadingRewards(false);
    }
  }, []);

  const loadClaims = useCallback(async (targetPage: number) => {
    setIsLoadingClaims(true);
    setClaimsError(undefined);
    try {
      const result = await apiClient.getWithMeta<RewardClaim[]>(
        `/api/admin/reward-claims?page=${targetPage}&pageSize=${PAGE_SIZE}`,
      );
      setClaims(result.data);
      setClaimsMeta(result.meta as unknown as PaginationMeta);
    } catch (err) {
      setClaimsError(friendlyErrorMessage(err));
    } finally {
      setIsLoadingClaims(false);
    }
  }, []);

  const loadRedemptions = useCallback(async (targetPage: number) => {
    setIsLoadingRedemptions(true);
    setRedemptionsError(undefined);
    try {
      const result = await apiClient.getWithMeta<RewardRedemption[]>(
        `/api/admin/reward-redemptions?page=${targetPage}&pageSize=${PAGE_SIZE}`,
      );
      setRedemptions(result.data);
      setRedemptionsMeta(result.meta as unknown as PaginationMeta);
    } catch (err) {
      setRedemptionsError(friendlyErrorMessage(err));
    } finally {
      setIsLoadingRedemptions(false);
    }
  }, []);

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  useEffect(() => {
    if (activeTab === "claims") loadClaims(claimsPage);
  }, [activeTab, claimsPage, loadClaims]);

  useEffect(() => {
    if (activeTab === "redemptions") loadRedemptions(redemptionsPage);
  }, [activeTab, redemptionsPage, loadRedemptions]);

  const loadAnalytics = useCallback(async () => {
    setIsLoadingAnalytics(true);
    setAnalyticsError(undefined);
    try {
      const [claimsCount, redemptionsCount] = await Promise.all([
        apiClient.getWithMeta<RewardClaim[]>("/api/admin/reward-claims?pageSize=1"),
        apiClient.getWithMeta<RewardRedemption[]>("/api/admin/reward-redemptions?pageSize=1"),
      ]);
      setAnalytics({
        totalClaims: (claimsCount.meta as unknown as PaginationMeta).totalItems,
        totalRedemptions: (redemptionsCount.meta as unknown as PaginationMeta).totalItems,
      });
    } catch (err) {
      setAnalyticsError(friendlyErrorMessage(err));
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "analytics") loadAnalytics();
  }, [activeTab, loadAnalytics]);

  function openCreateReward() {
    setEditingRewardId(null);
    setRewardForm(EMPTY_REWARD_FORM);
    setRewardFormError(null);
    setIsRewardModalOpen(true);
  }

  function openEditReward(reward: Reward) {
    setEditingRewardId(reward.id);
    setRewardForm({
      name: reward.name,
      description: reward.description ?? "",
      rewardType: reward.rewardType,
      pointsCost: String(reward.pointsCost),
      claimValidityDays: String(reward.claimValidityDays),
      isActive: reward.isActive,
      maxClaims: reward.maxClaims != null ? String(reward.maxClaims) : "",
    });
    setRewardFormError(null);
    setIsRewardModalOpen(true);
  }

  async function submitReward() {
    setRewardFormError(null);
    if (!rewardForm.name.trim()) {
      setRewardFormError("Name is required.");
      return;
    }
    setIsSubmittingReward(true);
    try {
      const payload = {
        name: rewardForm.name.trim(),
        description: rewardForm.description.trim() || null,
        rewardType: rewardForm.rewardType,
        pointsCost: Number(rewardForm.pointsCost) || 0,
        claimValidityDays: Number(rewardForm.claimValidityDays) || 30,
        isActive: rewardForm.isActive,
        maxClaims: rewardForm.maxClaims.trim() ? Number(rewardForm.maxClaims) : null,
      };
      if (editingRewardId) {
        await apiClient.patch(`/api/admin/rewards/${editingRewardId}`, payload);
      } else {
        await apiClient.post("/api/admin/rewards", payload);
      }
      setIsRewardModalOpen(false);
      await loadRewards();
    } catch (err) {
      setRewardFormError(friendlyErrorMessage(err));
    } finally {
      setIsSubmittingReward(false);
    }
  }

  async function deleteReward(id: string) {
    try {
      await apiClient.delete(`/api/admin/rewards/${id}`);
      await loadRewards();
    } catch (err) {
      setRewardsError(friendlyErrorMessage(err));
    }
  }

  const rewardColumns: DataTableColumn<Reward>[] = [
    { key: "name", header: "Name" },
    { key: "rewardType", header: "Type" },
    { key: "pointsCost", header: "Points Cost" },
    { key: "claimValidityDays", header: "Claim Validity (days)" },
    { key: "isActive", header: "Status", render: (row) => <StatusBadge status={row.isActive ? "active" : "inactive"} /> },
  ];

  const claimColumns: DataTableColumn<RewardClaim>[] = [
    { key: "rewardId", header: "Reward", render: (row) => rewards.find((r) => r.id === row.rewardId)?.name ?? row.rewardId },
    { key: "customerId", header: "Customer" },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "expiresAt", header: "Expires", render: (row) => new Date(row.expiresAt).toLocaleString() },
  ];

  const redemptionColumns: DataTableColumn<RewardRedemption>[] = [
    { key: "rewardId", header: "Reward", render: (row) => rewards.find((r) => r.id === row.rewardId)?.name ?? row.rewardId },
    { key: "customerId", header: "Customer" },
    { key: "cartKey", header: "Cart Key", render: (row) => row.cartKey ?? "—" },
    { key: "woocommerceOrderId", header: "WooCommerce Order", render: (row) => row.woocommerceOrderId ?? "—" },
    { key: "createdAt", header: "Redeemed At", render: (row) => new Date(row.createdAt).toLocaleString() },
  ];

  return (
    <div>
      <PageHeader title="Rewards" description="Reward catalog, claims, and redemptions for the loyalty program." />

      <Tabs
        tabs={[
          { key: "catalog", label: "Catalog" },
          { key: "claims", label: "Claims" },
          { key: "redemptions", label: "Redemptions" },
          { key: "analytics", label: "Analytics" },
        ]}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as TabKey)}
      />

      <div style={{ marginTop: "1rem" }}>
        {activeTab === "catalog" ? (
          <>
            <Can permission="reward:create" userPermissions={userPermissions}>
              <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
                <Button onClick={openCreateReward}>New Reward</Button>
              </div>
            </Can>
            <DataTable<Reward>
              columns={rewardColumns}
              rows={rewards}
              isLoading={isLoadingRewards}
              error={rewardsError}
              onRetry={loadRewards}
              emptyTitle="No rewards yet."
              emptyDescription="Create a reward for customers to claim with points."
              renderRowActions={
                canManage || canDelete
                  ? (row) => (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {canManage ? (
                          <Button variant="secondary" onClick={() => openEditReward(row)}>
                            Edit
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button variant="danger" onClick={() => deleteReward(row.id)}>
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    )
                  : undefined
              }
            />
          </>
        ) : null}

        {activeTab === "claims" ? (
          <DataTable<RewardClaim>
            columns={claimColumns}
            rows={claims}
            isLoading={isLoadingClaims}
            error={claimsError}
            onRetry={() => loadClaims(claimsPage)}
            emptyTitle="No reward claims yet."
            emptyDescription="Claims appear here once customers redeem points for a reward."
            pagination={{
              page: claimsMeta.page,
              pageSize: claimsMeta.pageSize,
              totalItems: claimsMeta.totalItems,
              totalPages: claimsMeta.totalPages,
              onPageChange: setClaimsPage,
            }}
          />
        ) : null}

        {activeTab === "redemptions" ? (
          <DataTable<RewardRedemption>
            columns={redemptionColumns}
            rows={redemptions}
            isLoading={isLoadingRedemptions}
            error={redemptionsError}
            onRetry={() => loadRedemptions(redemptionsPage)}
            emptyTitle="No reward redemptions yet."
            emptyDescription="Redemptions appear here once a claimed reward is applied at checkout."
            pagination={{
              page: redemptionsMeta.page,
              pageSize: redemptionsMeta.pageSize,
              totalItems: redemptionsMeta.totalItems,
              totalPages: redemptionsMeta.totalPages,
              onPageChange: setRedemptionsPage,
            }}
          />
        ) : null}

        {activeTab === "analytics" ? (
          <>
            {analyticsError ? (
              <div role="alert" style={{ marginBottom: "1rem", padding: "0.75rem", borderRadius: 6, background: "#fef2f2", color: "#dc2626", fontSize: "0.875rem" }}>
                {analyticsError}
              </div>
            ) : null}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
              <MetricCard label="Rewards in catalog" value={rewards.length} isLoading={isLoadingRewards} />
              <MetricCard
                label="Active rewards"
                value={rewards.filter((r) => r.isActive).length}
                isLoading={isLoadingRewards}
              />
              <MetricCard label="Total claims" value={analytics?.totalClaims ?? 0} isLoading={isLoadingAnalytics} />
              <MetricCard
                label="Total redemptions"
                value={analytics?.totalRedemptions ?? 0}
                isLoading={isLoadingAnalytics}
              />
            </div>
          </>
        ) : null}
      </div>

      <Modal
        isOpen={isRewardModalOpen}
        onClose={() => setIsRewardModalOpen(false)}
        title={editingRewardId ? "Edit Reward" : "New Reward"}
        footer={
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => setIsRewardModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitReward} isLoading={isSubmittingReward}>
              Save
            </Button>
          </div>
        }
      >
        {rewardFormError ? (
          <div role="alert" style={{ marginBottom: "1rem", padding: "0.75rem", borderRadius: 6, background: "#fef2f2", color: "#dc2626", fontSize: "0.875rem" }}>
            {rewardFormError}
          </div>
        ) : null}
        <FormField label="Name" htmlFor="reward-name" required>
          <Input id="reward-name" value={rewardForm.name} onChange={(e) => setRewardForm((f) => ({ ...f, name: e.target.value }))} />
        </FormField>
        <FormField label="Description" htmlFor="reward-description">
          <Input
            id="reward-description"
            value={rewardForm.description}
            onChange={(e) => setRewardForm((f) => ({ ...f, description: e.target.value }))}
          />
        </FormField>
        <FormField label="Type" htmlFor="reward-type" required>
          <Select
            id="reward-type"
            value={rewardForm.rewardType}
            onChange={(e) => setRewardForm((f) => ({ ...f, rewardType: e.target.value as RewardType }))}
            options={[
              { value: "free_item", label: "Free Item" },
              { value: "coupon", label: "Coupon" },
              { value: "other", label: "Other" },
            ]}
          />
        </FormField>
        <FormField label="Points cost" htmlFor="reward-points-cost" required>
          <Input
            id="reward-points-cost"
            type="number"
            min={0}
            value={rewardForm.pointsCost}
            onChange={(e) => setRewardForm((f) => ({ ...f, pointsCost: e.target.value }))}
          />
        </FormField>
        <FormField label="Claim validity (days)" htmlFor="reward-validity" required>
          <Input
            id="reward-validity"
            type="number"
            min={1}
            value={rewardForm.claimValidityDays}
            onChange={(e) => setRewardForm((f) => ({ ...f, claimValidityDays: e.target.value }))}
          />
        </FormField>
        <FormField label="Max claims (optional)" htmlFor="reward-max-claims">
          <Input
            id="reward-max-claims"
            type="number"
            min={1}
            value={rewardForm.maxClaims}
            onChange={(e) => setRewardForm((f) => ({ ...f, maxClaims: e.target.value }))}
          />
        </FormField>
        <FormField label="Active" htmlFor="reward-active">
          <Switch
            checked={rewardForm.isActive}
            onChange={(checked) => setRewardForm((f) => ({ ...f, isActive: checked }))}
            aria-label="Active"
          />
        </FormField>
      </Modal>
    </div>
  );
}
