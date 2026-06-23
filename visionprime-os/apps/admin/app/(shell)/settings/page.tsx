"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Can,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Switch,
  Tabs,
  Textarea,
  useToast,
} from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-client";
import { friendlyErrorMessage } from "../../lib/error-message";
import { BusinessSettings } from "../../lib/types";

type TabKey = "business" | "features" | "appearance";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBoolean(value: unknown): boolean {
  return Boolean(value);
}

export default function SettingsPage() {
  const { permissions, isSuperAdmin } = useAuth();
  const userPermissions = isSuperAdmin ? undefined : permissions;
  const canManage = isSuperAdmin || permissions.includes("settings:manage");
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>("business");
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const [businessForm, setBusinessForm] = useState({ name: "", supportEmail: "", phone: "", address: "" });
  const [featuresForm, setFeaturesForm] = useState<Record<string, boolean>>({});
  const [appearanceForm, setAppearanceForm] = useState({ primaryColor: "", logoUrl: "" });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(undefined);
    try {
      const data = await apiClient.get<BusinessSettings>("/api/admin/settings/business");
      setSettings(data);
      setBusinessForm({
        name: asString(data.general.name),
        supportEmail: asString(data.general.supportEmail),
        phone: asString(data.general.phone),
        address: asString(data.general.address),
      });
      setFeaturesForm(
        Object.fromEntries(Object.entries(data.features).map(([key, value]) => [key, asBoolean(value)])),
      );
      setAppearanceForm({
        primaryColor: asString(data.appearance.primaryColor),
        logoUrl: asString(data.appearance.logoUrl),
      });
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSaveBusiness() {
    setSaveError(null);
    setIsSaving(true);
    try {
      const updated = await apiClient.patch<BusinessSettings>("/api/admin/settings/business", {
        name: businessForm.name,
        supportEmail: businessForm.supportEmail,
        phone: businessForm.phone,
        address: businessForm.address,
      });
      setSettings(updated);
      showToast("Business info saved.", "success");
    } catch (err) {
      setSaveError(friendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveFeatures() {
    setSaveError(null);
    setIsSaving(true);
    try {
      const updated = await apiClient.patch<BusinessSettings>("/api/admin/settings/features", featuresForm);
      setSettings(updated);
      showToast("Feature flags saved.", "success");
    } catch (err) {
      setSaveError(friendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveAppearance() {
    setSaveError(null);
    setIsSaving(true);
    try {
      const updated = await apiClient.patch<BusinessSettings>("/api/admin/settings/appearance", {
        primaryColor: appearanceForm.primaryColor,
        logoUrl: appearanceForm.logoUrl,
      });
      setSettings(updated);
      showToast("Appearance saved.", "success");
    } catch (err) {
      setSaveError(friendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Settings" description="Business configuration." />

      <Can permission="settings:view" userPermissions={userPermissions} fallback={<p>You don't have permission to view settings.</p>}>
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} action={<Button onClick={load}>Retry</Button>} />
        ) : (
          <>
            <Tabs
              tabs={[
                { key: "business", label: "Business Info" },
                { key: "features", label: "Features" },
                { key: "appearance", label: "Appearance" },
              ]}
              activeKey={activeTab}
              onChange={(key) => setActiveTab(key as TabKey)}
            />

            {saveError ? (
              <div role="alert" style={{ marginTop: "1rem", padding: "0.75rem", borderRadius: 6, background: "#fef2f2", color: "#dc2626", fontSize: "0.875rem" }}>
                {saveError}
              </div>
            ) : null}

            <div style={{ marginTop: "1.5rem", maxWidth: 480 }}>
              {activeTab === "business" ? (
                <>
                  <FormField label="Business name" htmlFor="settings-name">
                    <Input
                      id="settings-name"
                      value={businessForm.name}
                      disabled={!canManage}
                      onChange={(e) => setBusinessForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Support email" htmlFor="settings-support-email">
                    <Input
                      id="settings-support-email"
                      type="email"
                      value={businessForm.supportEmail}
                      disabled={!canManage}
                      onChange={(e) => setBusinessForm((f) => ({ ...f, supportEmail: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Phone" htmlFor="settings-phone">
                    <Input
                      id="settings-phone"
                      value={businessForm.phone}
                      disabled={!canManage}
                      onChange={(e) => setBusinessForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Address" htmlFor="settings-address">
                    <Textarea
                      id="settings-address"
                      value={businessForm.address}
                      disabled={!canManage}
                      onChange={(e) => setBusinessForm((f) => ({ ...f, address: e.target.value }))}
                    />
                  </FormField>
                  <Can permission="settings:manage" userPermissions={userPermissions}>
                    <Button onClick={handleSaveBusiness} isLoading={isSaving}>
                      Save Business Info
                    </Button>
                  </Can>
                </>
              ) : null}

              {activeTab === "features" ? (
                <>
                  {Object.keys(featuresForm).length === 0 ? (
                    <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>No feature flags configured yet.</p>
                  ) : (
                    Object.entries(featuresForm).map(([key, value]) => (
                      <FormField key={key} label={key}>
                        <Switch
                          aria-label={key}
                          checked={value}
                          disabled={!canManage}
                          onChange={(checked) => setFeaturesForm((f) => ({ ...f, [key]: checked }))}
                        />
                      </FormField>
                    ))
                  )}
                  <Can permission="settings:manage" userPermissions={userPermissions}>
                    <Button onClick={handleSaveFeatures} isLoading={isSaving}>
                      Save Features
                    </Button>
                  </Can>
                </>
              ) : null}

              {activeTab === "appearance" ? (
                <>
                  <FormField label="Primary color" htmlFor="settings-color" hint="Hex value, e.g. #4f46e5">
                    <Input
                      id="settings-color"
                      value={appearanceForm.primaryColor}
                      disabled={!canManage}
                      onChange={(e) => setAppearanceForm((f) => ({ ...f, primaryColor: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Logo URL" htmlFor="settings-logo">
                    <Input
                      id="settings-logo"
                      value={appearanceForm.logoUrl}
                      disabled={!canManage}
                      onChange={(e) => setAppearanceForm((f) => ({ ...f, logoUrl: e.target.value }))}
                    />
                  </FormField>
                  <Can permission="settings:manage" userPermissions={userPermissions}>
                    <Button onClick={handleSaveAppearance} isLoading={isSaving}>
                      Save Appearance
                    </Button>
                  </Can>
                </>
              ) : null}
            </div>
          </>
        )}
      </Can>
    </div>
  );
}
