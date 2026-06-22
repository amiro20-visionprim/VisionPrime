"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Can,
  DataTable,
  DataTableColumn,
  FormField,
  Input,
  Modal,
  PageHeader,
  StatusBadge,
  Switch,
  Tabs,
} from "@visionprime/ui";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-client";
import { friendlyErrorMessage } from "../../lib/error-message";
import { LoyaltyProgram, LoyaltyRule, LoyaltyTier, PaginationMeta } from "../../lib/types";

type TabKey = "programs" | "tiers" | "rules";

const EMPTY_META: PaginationMeta = { page: 1, pageSize: 50, totalItems: 0, totalPages: 1 };

interface ProgramFormState {
  name: string;
  description: string;
  isActive: boolean;
  pointsPerCurrencyUnit: string;
}

const EMPTY_PROGRAM_FORM: ProgramFormState = { name: "", description: "", isActive: true, pointsPerCurrencyUnit: "1" };

interface TierFormState {
  programId: string;
  name: string;
  minLifetimePoints: string;
}

interface RuleFormState {
  programId: string;
  name: string;
  ruleType: string;
  isActive: boolean;
}

const EMPTY_RULE_FORM: RuleFormState = { programId: "", name: "", ruleType: "", isActive: true };

export default function LoyaltyPage() {
  const { permissions, isSuperAdmin } = useAuth();
  const userPermissions = isSuperAdmin ? undefined : permissions;
  const canManage = isSuperAdmin || (permissions ?? []).includes("loyalty:manage");

  const [activeTab, setActiveTab] = useState<TabKey>("programs");

  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(true);
  const [programsError, setProgramsError] = useState<string | undefined>(undefined);

  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [isLoadingTiers, setIsLoadingTiers] = useState(true);
  const [tiersError, setTiersError] = useState<string | undefined>(undefined);

  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [programForm, setProgramForm] = useState<ProgramFormState>(EMPTY_PROGRAM_FORM);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [isSubmittingProgram, setIsSubmittingProgram] = useState(false);
  const [programFormError, setProgramFormError] = useState<string | null>(null);

  const [isTierModalOpen, setIsTierModalOpen] = useState(false);
  const [tierForm, setTierForm] = useState<TierFormState>({ programId: "", name: "", minLifetimePoints: "0" });
  const [isSubmittingTier, setIsSubmittingTier] = useState(false);
  const [tierFormError, setTierFormError] = useState<string | null>(null);

  const [rules, setRules] = useState<LoyaltyRule[]>([]);
  const [isLoadingRules, setIsLoadingRules] = useState(true);
  const [rulesError, setRulesError] = useState<string | undefined>(undefined);

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState<RuleFormState>(EMPTY_RULE_FORM);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [isSubmittingRule, setIsSubmittingRule] = useState(false);
  const [ruleFormError, setRuleFormError] = useState<string | null>(null);

  const loadPrograms = useCallback(async () => {
    setIsLoadingPrograms(true);
    setProgramsError(undefined);
    try {
      const result = await apiClient.getWithMeta<LoyaltyProgram[]>("/api/admin/loyalty/programs?pageSize=100");
      setPrograms(result.data);
    } catch (err) {
      setProgramsError(friendlyErrorMessage(err));
    } finally {
      setIsLoadingPrograms(false);
    }
  }, []);

  const loadTiers = useCallback(async () => {
    setIsLoadingTiers(true);
    setTiersError(undefined);
    try {
      const result = await apiClient.getWithMeta<LoyaltyTier[]>("/api/admin/loyalty/tiers?pageSize=100");
      setTiers(result.data);
    } catch (err) {
      setTiersError(friendlyErrorMessage(err));
    } finally {
      setIsLoadingTiers(false);
    }
  }, []);

  const loadRules = useCallback(async () => {
    setIsLoadingRules(true);
    setRulesError(undefined);
    try {
      const result = await apiClient.getWithMeta<LoyaltyRule[]>("/api/admin/loyalty/rules?pageSize=100");
      setRules(result.data);
    } catch (err) {
      setRulesError(friendlyErrorMessage(err));
    } finally {
      setIsLoadingRules(false);
    }
  }, []);

  useEffect(() => {
    loadPrograms();
    loadTiers();
    loadRules();
  }, [loadPrograms, loadTiers, loadRules]);

  function openCreateProgram() {
    setEditingProgramId(null);
    setProgramForm(EMPTY_PROGRAM_FORM);
    setProgramFormError(null);
    setIsProgramModalOpen(true);
  }

  function openEditProgram(program: LoyaltyProgram) {
    setEditingProgramId(program.id);
    setProgramForm({
      name: program.name,
      description: program.description ?? "",
      isActive: program.isActive,
      pointsPerCurrencyUnit: String(program.pointsPerCurrencyUnit),
    });
    setProgramFormError(null);
    setIsProgramModalOpen(true);
  }

  async function submitProgram() {
    setProgramFormError(null);
    if (!programForm.name.trim()) {
      setProgramFormError("Name is required.");
      return;
    }
    setIsSubmittingProgram(true);
    try {
      const payload = {
        name: programForm.name.trim(),
        description: programForm.description.trim() || null,
        isActive: programForm.isActive,
        pointsPerCurrencyUnit: Number(programForm.pointsPerCurrencyUnit) || 0,
      };
      if (editingProgramId) {
        await apiClient.patch(`/api/admin/loyalty/programs/${editingProgramId}`, payload);
      } else {
        await apiClient.post("/api/admin/loyalty/programs", payload);
      }
      setIsProgramModalOpen(false);
      await loadPrograms();
    } catch (err) {
      setProgramFormError(friendlyErrorMessage(err));
    } finally {
      setIsSubmittingProgram(false);
    }
  }

  function openCreateTier() {
    setTierForm({ programId: programs[0]?.id ?? "", name: "", minLifetimePoints: "0" });
    setTierFormError(null);
    setIsTierModalOpen(true);
  }

  async function submitTier() {
    setTierFormError(null);
    if (!tierForm.programId) {
      setTierFormError("Select a program.");
      return;
    }
    if (!tierForm.name.trim()) {
      setTierFormError("Name is required.");
      return;
    }
    setIsSubmittingTier(true);
    try {
      await apiClient.post("/api/admin/loyalty/tiers", {
        programId: tierForm.programId,
        name: tierForm.name.trim(),
        minLifetimePoints: Number(tierForm.minLifetimePoints) || 0,
      });
      setIsTierModalOpen(false);
      await loadTiers();
    } catch (err) {
      setTierFormError(friendlyErrorMessage(err));
    } finally {
      setIsSubmittingTier(false);
    }
  }

  async function deleteTier(id: string) {
    try {
      await apiClient.delete(`/api/admin/loyalty/tiers/${id}`);
      await loadTiers();
    } catch (err) {
      setTiersError(friendlyErrorMessage(err));
    }
  }

  function openCreateRule() {
    setEditingRuleId(null);
    setRuleForm({ ...EMPTY_RULE_FORM, programId: programs[0]?.id ?? "" });
    setRuleFormError(null);
    setIsRuleModalOpen(true);
  }

  function openEditRule(rule: LoyaltyRule) {
    setEditingRuleId(rule.id);
    setRuleForm({ programId: rule.programId, name: rule.name, ruleType: rule.ruleType, isActive: rule.isActive });
    setRuleFormError(null);
    setIsRuleModalOpen(true);
  }

  async function submitRule() {
    setRuleFormError(null);
    if (!ruleForm.programId) {
      setRuleFormError("Select a program.");
      return;
    }
    if (!ruleForm.name.trim()) {
      setRuleFormError("Name is required.");
      return;
    }
    if (!ruleForm.ruleType.trim()) {
      setRuleFormError("Rule type is required.");
      return;
    }
    setIsSubmittingRule(true);
    try {
      if (editingRuleId) {
        await apiClient.patch(`/api/admin/loyalty/rules/${editingRuleId}`, {
          name: ruleForm.name.trim(),
          ruleType: ruleForm.ruleType.trim(),
          isActive: ruleForm.isActive,
        });
      } else {
        await apiClient.post("/api/admin/loyalty/rules", {
          programId: ruleForm.programId,
          name: ruleForm.name.trim(),
          ruleType: ruleForm.ruleType.trim(),
          isActive: ruleForm.isActive,
        });
      }
      setIsRuleModalOpen(false);
      await loadRules();
    } catch (err) {
      setRuleFormError(friendlyErrorMessage(err));
    } finally {
      setIsSubmittingRule(false);
    }
  }

  async function deleteRule(id: string) {
    try {
      await apiClient.delete(`/api/admin/loyalty/rules/${id}`);
      await loadRules();
    } catch (err) {
      setRulesError(friendlyErrorMessage(err));
    }
  }

  const programColumns: DataTableColumn<LoyaltyProgram>[] = [
    { key: "name", header: "Name" },
    { key: "pointsPerCurrencyUnit", header: "Points / Currency Unit" },
    { key: "isActive", header: "Status", render: (row) => <StatusBadge status={row.isActive ? "active" : "inactive"} /> },
  ];

  const tierColumns: DataTableColumn<LoyaltyTier>[] = [
    { key: "name", header: "Name" },
    {
      key: "programId",
      header: "Program",
      render: (row) => programs.find((p) => p.id === row.programId)?.name ?? row.programId,
    },
    { key: "minLifetimePoints", header: "Min Lifetime Points" },
  ];

  const ruleColumns: DataTableColumn<LoyaltyRule>[] = [
    { key: "name", header: "Name" },
    {
      key: "programId",
      header: "Program",
      render: (row) => programs.find((p) => p.id === row.programId)?.name ?? row.programId,
    },
    { key: "ruleType", header: "Type" },
    { key: "isActive", header: "Status", render: (row) => <StatusBadge status={row.isActive ? "active" : "inactive"} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Loyalty"
        description="Loyalty programs award points per currency unit spent and unlock tiers as customers accumulate lifetime points."
      />

      <Tabs
        tabs={[
          { key: "programs", label: "Programs" },
          { key: "tiers", label: "Tiers" },
          { key: "rules", label: "Rules" },
        ]}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as TabKey)}
      />

      <div style={{ marginTop: "1rem" }}>
        {activeTab === "rules" ? (
          <>
            <Can permission="loyalty:manage" userPermissions={userPermissions}>
              <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
                <Button onClick={openCreateRule} disabled={programs.length === 0}>
                  New Rule
                </Button>
              </div>
            </Can>
            <DataTable<LoyaltyRule>
              columns={ruleColumns}
              rows={rules}
              isLoading={isLoadingRules}
              error={rulesError}
              onRetry={loadRules}
              emptyTitle="No points rules yet."
              emptyDescription="Rules customize how points are awarded beyond the base per-currency-unit rate."
              renderRowActions={
                canManage
                  ? (row) => (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <Button variant="secondary" onClick={() => openEditRule(row)}>
                          Edit
                        </Button>
                        <Button variant="danger" onClick={() => deleteRule(row.id)}>
                          Delete
                        </Button>
                      </div>
                    )
                  : undefined
              }
            />
          </>
        ) : activeTab === "programs" ? (
          <>
            <Can permission="loyalty:manage" userPermissions={userPermissions}>
              <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
                <Button onClick={openCreateProgram}>New Program</Button>
              </div>
            </Can>
            <DataTable<LoyaltyProgram>
              columns={programColumns}
              rows={programs}
              isLoading={isLoadingPrograms}
              error={programsError}
              onRetry={loadPrograms}
              emptyTitle="No loyalty programs yet."
              emptyDescription="Create a program to start awarding points on purchase."
              renderRowActions={
                canManage
                  ? (row) => (
                      <Button variant="secondary" onClick={() => openEditProgram(row)}>
                        Edit
                      </Button>
                    )
                  : undefined
              }
            />
          </>
        ) : (
          <>
            <Can permission="loyalty:manage" userPermissions={userPermissions}>
              <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
                <Button onClick={openCreateTier} disabled={programs.length === 0}>
                  New Tier
                </Button>
              </div>
            </Can>
            <DataTable<LoyaltyTier>
              columns={tierColumns}
              rows={tiers}
              isLoading={isLoadingTiers}
              error={tiersError}
              onRetry={loadTiers}
              emptyTitle="No tiers yet."
              emptyDescription="Tiers unlock automatically as customers cross lifetime point thresholds."
              renderRowActions={
                canManage
                  ? (row) => (
                      <Button variant="secondary" onClick={() => deleteTier(row.id)}>
                        Delete
                      </Button>
                    )
                  : undefined
              }
            />
          </>
        )}
      </div>

      <Modal
        isOpen={isProgramModalOpen}
        onClose={() => setIsProgramModalOpen(false)}
        title={editingProgramId ? "Edit Program" : "New Program"}
        footer={
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => setIsProgramModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitProgram} isLoading={isSubmittingProgram}>
              Save
            </Button>
          </div>
        }
      >
        {programFormError ? (
          <div role="alert" style={{ marginBottom: "1rem", padding: "0.75rem", borderRadius: 6, background: "#fef2f2", color: "#dc2626", fontSize: "0.875rem" }}>
            {programFormError}
          </div>
        ) : null}
        <FormField label="Name" htmlFor="program-name" required>
          <Input
            id="program-name"
            value={programForm.name}
            onChange={(e) => setProgramForm((f) => ({ ...f, name: e.target.value }))}
          />
        </FormField>
        <FormField label="Description" htmlFor="program-description">
          <Input
            id="program-description"
            value={programForm.description}
            onChange={(e) => setProgramForm((f) => ({ ...f, description: e.target.value }))}
          />
        </FormField>
        <FormField label="Points per currency unit" htmlFor="program-rate">
          <Input
            id="program-rate"
            type="number"
            min={0}
            step="0.01"
            value={programForm.pointsPerCurrencyUnit}
            onChange={(e) => setProgramForm((f) => ({ ...f, pointsPerCurrencyUnit: e.target.value }))}
          />
        </FormField>
        <FormField label="Active" htmlFor="program-active">
          <Switch
            checked={programForm.isActive}
            onChange={(checked) => setProgramForm((f) => ({ ...f, isActive: checked }))}
            aria-label="Active"
          />
        </FormField>
      </Modal>

      <Modal
        isOpen={isTierModalOpen}
        onClose={() => setIsTierModalOpen(false)}
        title="New Tier"
        footer={
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => setIsTierModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitTier} isLoading={isSubmittingTier}>
              Save
            </Button>
          </div>
        }
      >
        {tierFormError ? (
          <div role="alert" style={{ marginBottom: "1rem", padding: "0.75rem", borderRadius: 6, background: "#fef2f2", color: "#dc2626", fontSize: "0.875rem" }}>
            {tierFormError}
          </div>
        ) : null}
        <FormField label="Program" htmlFor="tier-program" required>
          <select
            id="tier-program"
            value={tierForm.programId}
            onChange={(e) => setTierForm((f) => ({ ...f, programId: e.target.value }))}
            style={{ width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db" }}
          >
            <option value="" disabled>
              Select a program
            </option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Name" htmlFor="tier-name" required>
          <Input id="tier-name" value={tierForm.name} onChange={(e) => setTierForm((f) => ({ ...f, name: e.target.value }))} />
        </FormField>
        <FormField label="Minimum lifetime points" htmlFor="tier-min-points" required>
          <Input
            id="tier-min-points"
            type="number"
            min={0}
            value={tierForm.minLifetimePoints}
            onChange={(e) => setTierForm((f) => ({ ...f, minLifetimePoints: e.target.value }))}
          />
        </FormField>
      </Modal>

      <Modal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        title={editingRuleId ? "Edit Rule" : "New Rule"}
        footer={
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => setIsRuleModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitRule} isLoading={isSubmittingRule}>
              Save
            </Button>
          </div>
        }
      >
        {ruleFormError ? (
          <div role="alert" style={{ marginBottom: "1rem", padding: "0.75rem", borderRadius: 6, background: "#fef2f2", color: "#dc2626", fontSize: "0.875rem" }}>
            {ruleFormError}
          </div>
        ) : null}
        <FormField label="Program" htmlFor="rule-program" required>
          <select
            id="rule-program"
            value={ruleForm.programId}
            onChange={(e) => setRuleForm((f) => ({ ...f, programId: e.target.value }))}
            disabled={!!editingRuleId}
            style={{ width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db" }}
          >
            <option value="" disabled>
              Select a program
            </option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Name" htmlFor="rule-name" required>
          <Input id="rule-name" value={ruleForm.name} onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))} />
        </FormField>
        <FormField label="Rule type" htmlFor="rule-type" required>
          <Input
            id="rule-type"
            value={ruleForm.ruleType}
            onChange={(e) => setRuleForm((f) => ({ ...f, ruleType: e.target.value }))}
          />
        </FormField>
        <FormField label="Active" htmlFor="rule-active">
          <Switch
            checked={ruleForm.isActive}
            onChange={(checked) => setRuleForm((f) => ({ ...f, isActive: checked }))}
            aria-label="Active"
          />
        </FormField>
      </Modal>
    </div>
  );
}
