"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Can,
  DataTable,
  DataTableColumn,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  StatusBadge,
  Tabs,
  useToast,
} from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-client";
import { friendlyErrorMessage } from "../../lib/error-message";
import {
  PaginationMeta,
  WordPressConnection,
  WordPressSyncJobRowWithMetadata,
  WordPressSyncLogRow,
} from "../../lib/types";

type TabKey =
  | "connection"
  | "settings"
  | "manual-sync"
  | "sync-jobs"
  | "sync-logs"
  | "webhooks"
  | "mappings"
  | "errors";

const PAGE_SIZE = 20;

const TABS: { key: TabKey; label: string }[] = [
  { key: "connection", label: "Connection" },
  { key: "settings", label: "Settings" },
  { key: "manual-sync", label: "Manual Sync" },
  { key: "sync-jobs", label: "Sync Jobs" },
  { key: "sync-logs", label: "Sync Logs" },
  { key: "webhooks", label: "Webhooks" },
  { key: "mappings", label: "Mappings" },
  { key: "errors", label: "Errors" },
];

export default function WordPressSyncPage() {
  const { permissions, isSuperAdmin } = useAuth();
  const userPermissions = isSuperAdmin ? undefined : permissions;
  const canConnect = isSuperAdmin || permissions.includes("wordpress:connect");
  const canUpdate = isSuperAdmin || permissions.includes("wordpress:update");
  const canTest = isSuperAdmin || permissions.includes("wordpress:test");
  const canRegisterWebhook = isSuperAdmin || permissions.includes("wordpress:webhook_register");
  const canSyncCustomers = isSuperAdmin || permissions.includes("wordpress:sync_customer");
  const canSyncProducts = isSuperAdmin || permissions.includes("wordpress:sync_product");
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>("connection");
  const [connection, setConnection] = useState<WordPressConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const [connectForm, setConnectForm] = useState({ siteUrl: "", consumerKey: "", consumerSecret: "", sharedSecret: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSyncingCustomers, setIsSyncingCustomers] = useState(false);
  const [isSyncingProducts, setIsSyncingProducts] = useState(false);
  const [syncJobsReloadKey, setSyncJobsReloadKey] = useState(0);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const data = await apiClient.get<WordPressConnection>("/api/admin/integrations/wordpress/status");
      setConnection(data);
      setConnectForm((f) => ({ ...f, siteUrl: data.siteUrl ?? "" }));
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleConnect() {
    setFormError(null);
    setIsSaving(true);
    try {
      const updated = await apiClient.post<WordPressConnection>("/api/admin/integrations/wordpress/connect", {
        siteUrl: connectForm.siteUrl,
        consumerKey: connectForm.consumerKey,
        consumerSecret: connectForm.consumerSecret,
        ...(connectForm.sharedSecret ? { sharedSecret: connectForm.sharedSecret } : {}),
      });
      setConnection(updated);
      setConnectForm((f) => ({ ...f, consumerKey: "", consumerSecret: "", sharedSecret: "" }));
      showToast("Connection saved.", "success");
    } catch (err) {
      setFormError(friendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveSiteUrl() {
    setFormError(null);
    setIsSaving(true);
    try {
      const updated = await apiClient.patch<WordPressConnection>("/api/admin/integrations/wordpress/settings", {
        siteUrl: connectForm.siteUrl,
      });
      setConnection(updated);
      showToast("Settings saved.", "success");
    } catch (err) {
      setFormError(friendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestConnection() {
    setFormError(null);
    setIsTesting(true);
    try {
      const updated = await apiClient.post<WordPressConnection>("/api/admin/integrations/wordpress/test-connection");
      setConnection(updated);
      showToast(updated.lastTestSuccess ? "Connection test succeeded." : "Connection test failed.", updated.lastTestSuccess ? "success" : "error");
    } catch (err) {
      setFormError(friendlyErrorMessage(err));
    } finally {
      setIsTesting(false);
    }
  }

  async function handleRegisterWebhook() {
    setFormError(null);
    setIsRegisteringWebhook(true);
    try {
      const updated = await apiClient.post<WordPressConnection>("/api/admin/integrations/wordpress/webhooks/register");
      setConnection(updated);
      showToast(
        updated.webhookRegistrationStatus === "registered" ? "Webhook registered." : "Webhook registration failed.",
        updated.webhookRegistrationStatus === "registered" ? "success" : "error",
      );
    } catch (err) {
      setFormError(friendlyErrorMessage(err));
    } finally {
      setIsRegisteringWebhook(false);
    }
  }

  async function handleSyncCustomers() {
    setIsSyncingCustomers(true);
    try {
      const result = await apiClient.post<{ counts: { created: number; updated: number; failed: number; total: number } }>(
        "/api/admin/integrations/wordpress/sync/customers",
      );
      showToast(
        `Customer sync finished: ${result.counts.created} created, ${result.counts.updated} updated, ${result.counts.failed} failed.`,
        result.counts.failed > 0 ? "error" : "success",
      );
      setSyncJobsReloadKey((k) => k + 1);
    } catch (err) {
      showToast(friendlyErrorMessage(err), "error");
    } finally {
      setIsSyncingCustomers(false);
    }
  }

  async function handleSyncProducts() {
    setIsSyncingProducts(true);
    try {
      const result = await apiClient.post<{ counts: { created: number; updated: number; failed: number; total: number } }>(
        "/api/admin/integrations/wordpress/sync/products",
      );
      showToast(
        `Product sync finished: ${result.counts.created} created, ${result.counts.updated} updated, ${result.counts.failed} failed.`,
        result.counts.failed > 0 ? "error" : "success",
      );
      setSyncJobsReloadKey((k) => k + 1);
    } catch (err) {
      showToast(friendlyErrorMessage(err), "error");
    } finally {
      setIsSyncingProducts(false);
    }
  }

  return (
    <div>
      <PageHeader title="WordPress Sync" description="Manage the WooCommerce/WordPress connection." />

      <Can permission="wordpress:view" userPermissions={userPermissions} fallback={<p>You don't have permission to view this connection.</p>}>
        {isLoading ? (
          <LoadingState />
        ) : error || !connection ? (
          <ErrorState message={error ?? "Unable to load connection status."} action={<Button onClick={load}>Retry</Button>} />
        ) : (
          <>
            <Tabs tabs={TABS} activeKey={activeTab} onChange={(key) => setActiveTab(key as TabKey)} />

            {formError ? (
              <div role="alert" style={{ marginTop: "1rem", padding: "0.75rem", borderRadius: 6, background: "#fef2f2", color: "#dc2626", fontSize: "0.875rem" }}>
                {formError}
              </div>
            ) : null}

            <div style={{ marginTop: "1.5rem" }}>
              {activeTab === "connection" ? (
                <ConnectionTab
                  connection={connection}
                  form={connectForm}
                  setForm={setConnectForm}
                  canConnect={canConnect}
                  canTest={canTest}
                  isSaving={isSaving}
                  isTesting={isTesting}
                  onConnect={handleConnect}
                  onTest={handleTestConnection}
                />
              ) : null}

              {activeTab === "settings" ? (
                <SettingsTab
                  connection={connection}
                  siteUrl={connectForm.siteUrl}
                  onSiteUrlChange={(value) => setConnectForm((f) => ({ ...f, siteUrl: value }))}
                  canUpdate={canUpdate}
                  isSaving={isSaving}
                  onSave={handleSaveSiteUrl}
                />
              ) : null}

              {activeTab === "manual-sync" ? (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {canSyncCustomers ? (
                    <Button onClick={handleSyncCustomers} isLoading={isSyncingCustomers}>
                      Sync Customers
                    </Button>
                  ) : null}
                  {canSyncProducts ? (
                    <Button onClick={handleSyncProducts} isLoading={isSyncingProducts}>
                      Sync Products
                    </Button>
                  ) : null}
                  {!canSyncCustomers && !canSyncProducts ? (
                    <p>You don't have permission to run a manual sync.</p>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "sync-jobs" ? <SyncJobsTab reloadKey={syncJobsReloadKey} /> : null}
              {activeTab === "sync-logs" ? <SyncLogsTab /> : null}

              {activeTab === "webhooks" ? (
                <WebhooksTab
                  connection={connection}
                  canRegisterWebhook={canRegisterWebhook}
                  isRegistering={isRegisteringWebhook}
                  onRegister={handleRegisterWebhook}
                />
              ) : null}

              {activeTab === "mappings" ? (
                <EmptyState
                  title="Entity mappings are not available yet."
                  description="WordPress/WooCommerce entity mapping ships alongside full sync in a later phase."
                />
              ) : null}

              {activeTab === "errors" ? (
                <EmptyState
                  title="Sync errors are not available yet."
                  description="A dedicated error view ships alongside full sync in a later phase."
                />
              ) : null}
            </div>
          </>
        )}
      </Can>
    </div>
  );
}

interface ConnectForm {
  siteUrl: string;
  consumerKey: string;
  consumerSecret: string;
  sharedSecret: string;
}

function ConnectionTab({
  connection,
  form,
  setForm,
  canConnect,
  canTest,
  isSaving,
  isTesting,
  onConnect,
  onTest,
}: {
  connection: WordPressConnection;
  form: ConnectForm;
  setForm: (updater: (f: ConnectForm) => ConnectForm) => void;
  canConnect: boolean;
  canTest: boolean;
  isSaving: boolean;
  isTesting: boolean;
  onConnect: () => void;
  onTest: () => void;
}) {
  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span>Status:</span>
        <StatusBadge status={connection.status} />
      </div>

      <FormField label="WooCommerce site URL" htmlFor="wp-site-url">
        <Input
          id="wp-site-url"
          value={form.siteUrl}
          disabled={!canConnect}
          onChange={(e) => setForm((f) => ({ ...f, siteUrl: e.target.value }))}
          placeholder="https://shop.example.com"
        />
      </FormField>

      <FormField
        label="Consumer key"
        htmlFor="wp-consumer-key"
        hint={connection.hasConsumerKey ? "A consumer key is already saved. Enter a new value to replace it." : undefined}
      >
        <Input
          id="wp-consumer-key"
          type="password"
          value={form.consumerKey}
          disabled={!canConnect}
          onChange={(e) => setForm((f) => ({ ...f, consumerKey: e.target.value }))}
          placeholder={connection.hasConsumerKey ? "••••••••" : ""}
        />
      </FormField>

      <FormField
        label="Consumer secret"
        htmlFor="wp-consumer-secret"
        hint={connection.hasConsumerSecret ? "A consumer secret is already saved. Enter a new value to replace it." : undefined}
      >
        <Input
          id="wp-consumer-secret"
          type="password"
          value={form.consumerSecret}
          disabled={!canConnect}
          onChange={(e) => setForm((f) => ({ ...f, consumerSecret: e.target.value }))}
          placeholder={connection.hasConsumerSecret ? "••••••••" : ""}
        />
      </FormField>

      <FormField
        label="Shared secret (optional)"
        htmlFor="wp-shared-secret"
        hint={connection.hasSharedSecret ? "A shared secret is already saved. Enter a new value to replace it." : undefined}
      >
        <Input
          id="wp-shared-secret"
          type="password"
          value={form.sharedSecret}
          disabled={!canConnect}
          onChange={(e) => setForm((f) => ({ ...f, sharedSecret: e.target.value }))}
          placeholder={connection.hasSharedSecret ? "••••••••" : ""}
        />
      </FormField>

      {canConnect ? (
        <Button
          onClick={onConnect}
          isLoading={isSaving}
          disabled={!form.siteUrl || !form.consumerKey || !form.consumerSecret}
        >
          Save Connection
        </Button>
      ) : null}

      {canTest ? (
        <Button onClick={onTest} isLoading={isTesting} style={{ marginLeft: "0.5rem" }}>
          Test Connection
        </Button>
      ) : null}

      {connection.lastTestedAt ? (
        <p style={{ marginTop: "1rem", fontSize: "0.875rem", color: "#6b7280" }}>
          Last tested {new Date(connection.lastTestedAt).toLocaleString()} —{" "}
          {connection.lastTestSuccess ? "succeeded" : "failed"}
          {connection.lastTestMessage ? `: ${connection.lastTestMessage}` : ""}
        </p>
      ) : null}
    </div>
  );
}

function SettingsTab({
  connection,
  siteUrl,
  onSiteUrlChange,
  canUpdate,
  isSaving,
  onSave,
}: {
  connection: WordPressConnection;
  siteUrl: string;
  onSiteUrlChange: (value: string) => void;
  canUpdate: boolean;
  isSaving: boolean;
  onSave: () => void;
}) {
  return (
    <div style={{ maxWidth: 480 }}>
      <FormField label="WooCommerce site URL" htmlFor="wp-settings-site-url">
        <Input
          id="wp-settings-site-url"
          value={siteUrl}
          disabled={!canUpdate}
          onChange={(e) => onSiteUrlChange(e.target.value)}
        />
      </FormField>
      <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1rem" }}>
        Last updated {new Date(connection.updatedAt).toLocaleString()}.
      </p>
      {canUpdate ? (
        <Button onClick={onSave} isLoading={isSaving}>
          Save Settings
        </Button>
      ) : null}
    </div>
  );
}

function WebhooksTab({
  connection,
  canRegisterWebhook,
  isRegistering,
  onRegister,
}: {
  connection: WordPressConnection;
  canRegisterWebhook: boolean;
  isRegistering: boolean;
  onRegister: () => void;
}) {
  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span>Registration status:</span>
        <StatusBadge status={connection.webhookRegistrationStatus} />
      </div>
      {connection.webhookRegisteredAt ? (
        <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1rem" }}>
          Registered {new Date(connection.webhookRegisteredAt).toLocaleString()}.
        </p>
      ) : null}
      {canRegisterWebhook ? (
        <Button onClick={onRegister} isLoading={isRegistering} disabled={!connection.hasSharedSecret || !connection.siteUrl}>
          Register Webhooks
        </Button>
      ) : null}
      {!connection.hasSharedSecret ? (
        <p style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.5rem" }}>
          Save a shared secret on the Connection tab before registering webhooks.
        </p>
      ) : null}
    </div>
  );
}

function SyncJobsTab({ reloadKey }: { reloadKey: number }) {
  const [rows, setRows] = useState<WordPressSyncJobRowWithMetadata[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.getWithMeta<WordPressSyncJobRowWithMetadata[]>(
        `/api/admin/integrations/wordpress/sync/jobs?page=${targetPage}&pageSize=${PAGE_SIZE}`,
      );
      setRows(result.data);
      setMeta(result.meta as unknown as PaginationMeta);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load, reloadKey]);

  const columns: DataTableColumn<WordPressSyncJobRowWithMetadata>[] = [
    { key: "created_at", header: "Created", render: (row) => new Date(row.created_at).toLocaleString() },
    { key: "job_type", header: "Job Type" },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "started_at", header: "Started", render: (row) => (row.started_at ? new Date(row.started_at).toLocaleString() : "—") },
    { key: "finished_at", header: "Finished", render: (row) => (row.finished_at ? new Date(row.finished_at).toLocaleString() : "—") },
    {
      key: "counts",
      header: "Counts",
      render: (row) =>
        row.metadata
          ? `${row.metadata.created} created, ${row.metadata.updated} updated, ${row.metadata.failed} failed`
          : "—",
    },
  ];

  return (
    <DataTable<WordPressSyncJobRowWithMetadata>
      columns={columns}
      rows={rows}
      isLoading={isLoading}
      error={error}
      onRetry={() => load(page)}
      emptyTitle="No sync jobs yet."
      emptyDescription="Sync jobs will appear here once sync runs ship in a later phase."
      pagination={{
        page: meta.page,
        pageSize: meta.pageSize,
        totalItems: meta.totalItems,
        totalPages: meta.totalPages,
        onPageChange: setPage,
      }}
    />
  );
}

function SyncLogsTab() {
  const [rows, setRows] = useState<WordPressSyncLogRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.getWithMeta<WordPressSyncLogRow[]>(
        `/api/admin/integrations/wordpress/sync/logs?page=${targetPage}&pageSize=${PAGE_SIZE}`,
      );
      setRows(result.data);
      setMeta(result.meta as unknown as PaginationMeta);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  const columns: DataTableColumn<WordPressSyncLogRow>[] = [
    { key: "created_at", header: "Time", render: (row) => new Date(row.created_at).toLocaleString() },
    { key: "level", header: "Level" },
    { key: "message", header: "Message" },
  ];

  return (
    <DataTable<WordPressSyncLogRow>
      columns={columns}
      rows={rows}
      isLoading={isLoading}
      error={error}
      onRetry={() => load(page)}
      emptyTitle="No sync logs yet."
      emptyDescription="Sync logs will appear here once sync runs ship in a later phase."
      pagination={{
        page: meta.page,
        pageSize: meta.pageSize,
        totalItems: meta.totalItems,
        totalPages: meta.totalPages,
        onPageChange: setPage,
      }}
    />
  );
}
