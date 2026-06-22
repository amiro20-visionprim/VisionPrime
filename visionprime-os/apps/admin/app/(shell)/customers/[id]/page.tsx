"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Can,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  StatusBadge,
  Tabs,
  useToast,
} from "@visionprime/ui";
import { apiClient } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-client";
import { friendlyErrorMessage } from "../../../lib/error-message";
import { Customer360 } from "../../../lib/types";

type TabKey = "overview" | "notes" | "tags" | "identities" | "events";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
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

  const { customer, notes, tags, identities, events } = data;

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
