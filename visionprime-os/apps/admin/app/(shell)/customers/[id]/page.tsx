"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Can,
  DataTable,
  DataTableColumn,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  MetricCard,
  PageHeader,
  StatusBadge,
  Tabs,
  useToast,
} from "@visionprime/ui";
import { apiClient } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-client";
import { friendlyErrorMessage } from "../../../lib/error-message";
import {
  Customer360,
  Customer360Order,
  CustomerLoyaltyStatus,
  PointsBalance,
  RewardClaim,
  Wallet,
  WalletReservation,
} from "../../../lib/types";

type TabKey = "overview" | "metrics" | "orders" | "notes" | "tags" | "identities" | "events" | "reservations" | "loyalty";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "metrics", label: "Metrics" },
  { key: "orders", label: "Orders" },
  { key: "reservations", label: "Reservations" },
  { key: "loyalty", label: "Loyalty" },
  { key: "notes", label: "Notes" },
  { key: "tags", label: "Tags" },
  { key: "identities", label: "Identities" },
  { key: "events", label: "Events" },
];

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { permissions, isSuperAdmin } = useAuth();
  const userPermissions = isSuperAdmin ? undefined : permissions;
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [data, setData] = useState<Customer360 | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const [noteText, setNoteText] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [tagText, setTagText] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);

  const [reservations, setReservations] = useState<WalletReservation[]>([]);
  const [isLoadingReservations, setIsLoadingReservations] = useState(true);

  const [pointsBalance, setPointsBalance] = useState<PointsBalance | null>(null);
  const [isLoadingPoints, setIsLoadingPoints] = useState(true);

  const [loyaltyStatus, setLoyaltyStatus] = useState<CustomerLoyaltyStatus | null>(null);
  const [isLoadingLoyalty, setIsLoadingLoyalty] = useState(true);

  const [rewardClaims, setRewardClaims] = useState<RewardClaim[]>([]);
  const [isLoadingRewardClaims, setIsLoadingRewardClaims] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.get<Customer360>(`/api/admin/customers/${params.id}/360`);
      setData(result);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!userPermissions || userPermissions.includes("wallet:view")) {
      apiClient
        .get<Wallet>(`/api/admin/wallets/${params.id}`)
        .then(setWallet)
        .catch(() => setWallet(null))
        .finally(() => setIsLoadingWallet(false));
    } else {
      setIsLoadingWallet(false);
    }
  }, [params.id, userPermissions]);

  useEffect(() => {
    if (!userPermissions || userPermissions.includes("wallet_reservation:view")) {
      apiClient
        .getWithMeta<WalletReservation[]>(`/api/admin/wallet-reservations/customer/${params.id}`)
        .then((result) => setReservations(result.data))
        .catch(() => setReservations([]))
        .finally(() => setIsLoadingReservations(false));
    } else {
      setIsLoadingReservations(false);
    }
  }, [params.id, userPermissions]);

  useEffect(() => {
    if (!userPermissions || userPermissions.includes("points:view")) {
      apiClient
        .get<PointsBalance>(`/api/admin/points/customer/${params.id}`)
        .then(setPointsBalance)
        .catch(() => setPointsBalance(null))
        .finally(() => setIsLoadingPoints(false));
    } else {
      setIsLoadingPoints(false);
    }
  }, [params.id, userPermissions]);

  useEffect(() => {
    if (!userPermissions || userPermissions.includes("loyalty:view")) {
      apiClient
        .get<CustomerLoyaltyStatus>(`/api/admin/loyalty/customer/${params.id}/status`)
        .then(setLoyaltyStatus)
        .catch(() => setLoyaltyStatus(null))
        .finally(() => setIsLoadingLoyalty(false));
    } else {
      setIsLoadingLoyalty(false);
    }
  }, [params.id, userPermissions]);

  useEffect(() => {
    if (!userPermissions || userPermissions.includes("reward_claim:view")) {
      apiClient
        .getWithMeta<RewardClaim[]>(`/api/admin/reward-claims?customerId=${params.id}&pageSize=50`)
        .then((result) => setRewardClaims(result.data))
        .catch(() => setRewardClaims([]))
        .finally(() => setIsLoadingRewardClaims(false));
    } else {
      setIsLoadingRewardClaims(false);
    }
  }, [params.id, userPermissions]);

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setIsAddingNote(true);
    try {
      await apiClient.post(`/api/admin/customers/${params.id}/notes`, { note: noteText.trim() });
      setNoteText("");
      showToast("Note added.", "success");
      load();
    } catch (err) {
      showToast(friendlyErrorMessage(err), "error");
    } finally {
      setIsAddingNote(false);
    }
  }

  async function handleAddTag() {
    if (!tagText.trim()) return;
    setIsAddingTag(true);
    try {
      await apiClient.post(`/api/admin/customers/${params.id}/tags`, { tag: tagText.trim() });
      setTagText("");
      showToast("Tag added.", "success");
      load();
    } catch (err) {
      showToast(friendlyErrorMessage(err), "error");
    } finally {
      setIsAddingTag(false);
    }
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !data) {
    return <ErrorState message={error ?? "Unable to load customer."} action={<Button onClick={load}>Retry</Button>} />;
  }

  const { customer, notes, tags, identities, events, orders } = data;

  const orderColumns: DataTableColumn<Customer360Order>[] = [
    { key: "woocommerce_order_id", header: "Order #" },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "total", header: "Total", render: (row) => `${row.total}${row.currency ? ` ${row.currency}` : ""}` },
    { key: "ordered_at", header: "Ordered", render: (row) => (row.ordered_at ? new Date(row.ordered_at).toLocaleString() : "—") },
  ];

  return (
    <div>
      <PageHeader
        title={customer.full_name}
        description="Customer 360 view."
        actions={
          <Button variant="secondary" onClick={() => router.push("/customers")}>
            Back to Customers
          </Button>
        }
      />

      <Tabs tabs={TABS} activeKey={activeTab} onChange={(key) => setActiveTab(key as TabKey)} />

      <div style={{ marginTop: "1.5rem" }}>
        {activeTab === "overview" ? (
          <div style={{ maxWidth: 480 }}>
            <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>Status:</span>
              <StatusBadge status={customer.status} />
            </div>
            <p>
              <strong>Email:</strong> {customer.primary_email ?? "—"}
            </p>
            <p>
              <strong>Mobile:</strong> {customer.primary_mobile ?? "—"}
            </p>
            <p>
              <strong>WordPress user ID:</strong> {customer.wordpress_user_id ?? "—"}
            </p>
            <p>
              <strong>WooCommerce customer ID:</strong> {customer.woocommerce_customer_id ?? "—"}
            </p>
            <p>
              <strong>Created:</strong> {new Date(customer.created_at).toLocaleString()}
            </p>

            <Can permission="wallet:view" userPermissions={userPermissions}>
              <div style={{ marginTop: "1.5rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
                  <MetricCard
                    label="Wallet Balance"
                    value={wallet ? `$${(wallet.availableBalanceCents / 100).toFixed(2)}` : "—"}
                    isLoading={isLoadingWallet}
                  />
                </div>
                <Button variant="secondary" style={{ marginTop: "0.75rem" }} onClick={() => router.push(`/wallet/${customer.id}`)}>
                  View Wallet
                </Button>
              </div>
            </Can>
          </div>
        ) : null}

        {activeTab === "metrics" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", maxWidth: 720 }}>
            <MetricCard label="Purchase Count" value={customer.purchase_count} />
            <MetricCard label="Total Spent" value={customer.total_spent} />
            <MetricCard label="Average Order Value" value={customer.average_order_value} />
            <MetricCard label="Lifetime Value" value={customer.lifetime_value} />
            <MetricCard
              label="Last Purchase"
              value={customer.last_purchase_at ? new Date(customer.last_purchase_at).toLocaleString() : "—"}
            />
          </div>
        ) : null}

        {activeTab === "orders" ? (
          <DataTable<Customer360Order>
            columns={orderColumns}
            rows={orders}
            emptyTitle="No orders yet."
            emptyDescription="Orders will appear here once synced from WooCommerce."
          />
        ) : null}

        {activeTab === "reservations" ? (
          <div style={{ maxWidth: 720 }}>
            {isLoadingReservations ? <p>Loading…</p> : null}
            {!isLoadingReservations && reservations.length === 0 ? <p>No wallet reservations yet.</p> : null}
            <ul style={{ listStyle: "none", padding: 0 }}>
              {reservations.map((reservation) => (
                <li key={reservation.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #e5e7eb" }}>
                  <p>
                    {`$${(reservation.amountCents / 100).toFixed(2)} ${reservation.currency}`} — <StatusBadge status={reservation.status === "active" || reservation.status === "confirmed" ? "active" : "failed"} /> ({reservation.status})
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                    Cart {reservation.cartKey} · Created {new Date(reservation.createdAt).toLocaleString()}
                    {reservation.woocommerceOrderId ? ` · Order ${reservation.woocommerceOrderId}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {activeTab === "loyalty" ? (
          <div style={{ maxWidth: 720 }}>
            <Can permission="points:view" userPermissions={userPermissions}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                <MetricCard label="Points Balance" value={pointsBalance ? pointsBalance.balance : "—"} isLoading={isLoadingPoints} />
                <MetricCard label="Lifetime Points" value={pointsBalance ? pointsBalance.lifetimePoints : "—"} isLoading={isLoadingPoints} />
              </div>
            </Can>

            <Can permission="loyalty:view" userPermissions={userPermissions}>
              <div style={{ marginBottom: "1.5rem" }}>
                {isLoadingLoyalty ? <p>Loading tier…</p> : null}
                {!isLoadingLoyalty && loyaltyStatus ? (
                  <>
                    <p>
                      <strong>Current tier:</strong> {loyaltyStatus.currentTier?.name ?? "—"}
                    </p>
                    <p>
                      <strong>Next tier:</strong>{" "}
                      {loyaltyStatus.nextTier
                        ? `${loyaltyStatus.nextTier.name} (${loyaltyStatus.pointsToNextTier} points to go)`
                        : "—"}
                    </p>
                  </>
                ) : null}
              </div>
            </Can>

            <Can permission="reward_claim:view" userPermissions={userPermissions}>
              <div>
                <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>Reward Claims</h3>
                {isLoadingRewardClaims ? <p>Loading…</p> : null}
                {!isLoadingRewardClaims && rewardClaims.length === 0 ? <p>No reward claims yet.</p> : null}
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {rewardClaims.map((claim) => (
                    <li key={claim.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #e5e7eb" }}>
                      <StatusBadge status={claim.status} /> · Expires {new Date(claim.expiresAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>
            </Can>
          </div>
        ) : null}

        {activeTab === "notes" ? (
          <div style={{ maxWidth: 480 }}>
            <Can permission="customer:note:create" userPermissions={userPermissions}>
              <FormField label="Add note" htmlFor="customer-note">
                <Input id="customer-note" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
              </FormField>
              <Button onClick={handleAddNote} isLoading={isAddingNote} disabled={!noteText.trim()}>
                Add Note
              </Button>
            </Can>
            <ul style={{ marginTop: "1rem", listStyle: "none", padding: 0 }}>
              {notes.length === 0 ? <p>No notes yet.</p> : null}
              {notes.map((note) => (
                <li key={note.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #e5e7eb" }}>
                  <p>{note.note}</p>
                  <p style={{ fontSize: "0.75rem", color: "#6b7280" }}>{new Date(note.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {activeTab === "tags" ? (
          <div style={{ maxWidth: 480 }}>
            <Can permission="customer:tag:update" userPermissions={userPermissions}>
              <FormField label="Add tag" htmlFor="customer-tag">
                <Input id="customer-tag" value={tagText} onChange={(e) => setTagText(e.target.value)} />
              </FormField>
              <Button onClick={handleAddTag} isLoading={isAddingTag} disabled={!tagText.trim()}>
                Add Tag
              </Button>
            </Can>
            <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {tags.length === 0 ? <p>No tags yet.</p> : null}
              {tags.map((tag) => (
                <Badge key={tag.id}>{tag.tag}</Badge>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "identities" ? (
          <div style={{ maxWidth: 480 }}>
            {identities.length === 0 ? <p>No linked identities yet.</p> : null}
            <ul style={{ listStyle: "none", padding: 0 }}>
              {identities.map((identity) => (
                <li key={identity.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #e5e7eb" }}>
                  {identity.identity_type}: {identity.identity_value}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {activeTab === "events" ? (
          <div style={{ maxWidth: 480 }}>
            {events.length === 0 ? <p>No events yet.</p> : null}
            <ul style={{ listStyle: "none", padding: 0 }}>
              {events.map((event) => (
                <li key={event.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #e5e7eb" }}>
                  <p>{event.event_type}</p>
                  <p style={{ fontSize: "0.75rem", color: "#6b7280" }}>{new Date(event.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
