"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Can,
  Checkbox,
  ConfirmDialog,
  DataTable,
  DataTableColumn,
  ErrorState,
  FormField,
  LoadingState,
  MetricCard,
  Modal,
  MoneyInput,
  PageHeader,
  StatusBadge,
  Textarea,
  useToast,
} from "@visionprime/ui";
import { apiClient } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-client";
import { friendlyErrorMessage } from "../../../lib/error-message";
import { Customer, PaginationMeta, Wallet, WalletLedgerEntry } from "../../../lib/types";

function centsToMajor(cents: number): string {
  return (cents / 100).toFixed(2);
}

interface ManualEntryFormState {
  amount: number | "";
  reason: string;
  internalNote: string;
  confirmed: boolean;
}

const EMPTY_FORM: ManualEntryFormState = { amount: "", reason: "", internalNote: "", confirmed: false };

function ManualEntryModal({
  isOpen,
  direction,
  customerName,
  currentBalanceCents,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  direction: "credit" | "debit";
  customerName: string;
  currentBalanceCents: number;
  onClose: () => void;
  onSubmit: (form: ManualEntryFormState) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState<ManualEntryFormState>(EMPTY_FORM);

  useEffect(() => {
    if (isOpen) setForm(EMPTY_FORM);
  }, [isOpen]);

  const amountCents = form.amount === "" ? 0 : Math.round(form.amount * 100);
  const balanceAfterCents = direction === "credit" ? currentBalanceCents + amountCents : currentBalanceCents - amountCents;
  const canSubmit = form.amount !== "" && form.amount > 0 && form.reason.trim().length > 0 && form.confirmed;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={direction === "credit" ? "Manual Wallet Credit" : "Manual Wallet Debit"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={direction === "credit" ? "primary" : "danger"}
            onClick={() => onSubmit(form)}
            disabled={!canSubmit}
            isLoading={isSubmitting}
          >
            {direction === "credit" ? "Issue Credit" : "Issue Debit"}
          </Button>
        </>
      }
    >
      <p style={{ marginTop: 0 }}>
        <strong>Customer:</strong> {customerName}
      </p>
      <p>
        <strong>Current available balance:</strong> ${centsToMajor(currentBalanceCents)}
      </p>

      <FormField label="Amount" htmlFor="manual-entry-amount" required>
        <MoneyInput
          id="manual-entry-amount"
          value={form.amount}
          onChange={(value) => setForm((prev) => ({ ...prev, amount: value }))}
          autoFocus
        />
      </FormField>

      <p>
        <strong>Balance after this operation:</strong> ${centsToMajor(balanceAfterCents)}
        {balanceAfterCents < 0 ? " (will be rejected — exceeds available balance)" : ""}
      </p>

      <FormField label="Reason" htmlFor="manual-entry-reason" required hint="Required — visible to the customer's statement.">
        <Textarea
          id="manual-entry-reason"
          rows={2}
          value={form.reason}
          onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
        />
      </FormField>

      <FormField label="Internal note" htmlFor="manual-entry-note" hint="Optional — staff-only, never shown to the customer.">
        <Textarea
          id="manual-entry-note"
          rows={2}
          value={form.internalNote}
          onChange={(e) => setForm((prev) => ({ ...prev, internalNote: e.target.value }))}
        />
      </FormField>

      <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 6, padding: "0.75rem", marginBottom: "1rem" }}>
        This action creates a permanent, immutable ledger entry. It cannot be edited or deleted — only reversed by a
        separate, explicit reversal.
      </div>

      <Checkbox
        label="I understand this action is permanent and will be recorded in the audit log."
        checked={form.confirmed}
        onChange={(e) => setForm((prev) => ({ ...prev, confirmed: e.target.checked }))}
      />
    </Modal>
  );
}

export default function WalletDetailPage({ params }: { params: { customerId: string } }) {
  const { permissions, isSuperAdmin } = useAuth();
  const userPermissions = isSuperAdmin ? undefined : permissions;
  const { showToast } = useToast();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ledger, setLedger] = useState<WalletLedgerEntry[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [debitModalOpen, setDebitModalOpen] = useState(false);
  const [isSubmittingEntry, setIsSubmittingEntry] = useState(false);

  const [reverseTarget, setReverseTarget] = useState<WalletLedgerEntry | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [isReversing, setIsReversing] = useState(false);

  const load = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    setError(undefined);
    try {
      const [customerResult, walletResult, ledgerResult] = await Promise.all([
        apiClient.get<Customer>(`/api/admin/customers/${params.customerId}`),
        apiClient.get<Wallet>(`/api/admin/wallets/${params.customerId}`),
        apiClient.getWithMeta<WalletLedgerEntry[]>(
          `/api/admin/wallets/${params.customerId}/ledger?page=${targetPage}&pageSize=20`,
        ),
      ]);
      setCustomer(customerResult);
      setWallet(walletResult);
      setLedger(ledgerResult.data);
      setMeta(ledgerResult.meta as unknown as PaginationMeta);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [params.customerId]);

  useEffect(() => {
    load(page);
  }, [page, load]);

  async function handleManualEntry(direction: "credit" | "debit", form: ManualEntryFormState) {
    setIsSubmittingEntry(true);
    try {
      await apiClient.post(`/api/admin/wallets/${params.customerId}/manual-${direction}`, {
        amount: form.amount,
        reason: form.reason.trim(),
        internalNote: form.internalNote.trim() || undefined,
      });
      showToast(direction === "credit" ? "Manual credit issued." : "Manual debit issued.", "success");
      setCreditModalOpen(false);
      setDebitModalOpen(false);
      await load(page);
    } catch (err) {
      showToast(friendlyErrorMessage(err), "error");
    } finally {
      setIsSubmittingEntry(false);
    }
  }

  async function handleReverse() {
    if (!reverseTarget) return;
    setIsReversing(true);
    try {
      await apiClient.post(`/api/admin/wallets/ledger/${reverseTarget.id}/reverse`, { reason: reverseReason.trim() });
      showToast("Ledger entry reversed.", "success");
      setReverseTarget(null);
      setReverseReason("");
      await load(page);
    } catch (err) {
      showToast(friendlyErrorMessage(err), "error");
    } finally {
      setIsReversing(false);
    }
  }

  if (isLoading && !wallet) {
    return <LoadingState />;
  }

  if (error || !wallet || !customer) {
    return <ErrorState message={error ?? "Unable to load wallet."} action={<Button onClick={() => load(page)}>Retry</Button>} />;
  }

  const columns: DataTableColumn<WalletLedgerEntry>[] = [
    { key: "created_at", header: "Date", render: (row) => new Date(row.created_at).toLocaleString() },
    { key: "type", header: "Type" },
    { key: "direction", header: "Direction", render: (row) => <StatusBadge status={row.direction === "credit" ? "active" : "failed"} /> },
    {
      key: "amount_cents",
      header: "Amount",
      render: (row) => `${row.direction === "credit" ? "+" : "-"}$${centsToMajor(row.amount_cents)}`,
    },
    { key: "reason", header: "Reason" },
    {
      key: "reversed_entry_id",
      header: "Status",
      render: (row) => (row.type === "reversal" ? "Reversal" : row.reversed_entry_id ? "—" : "Active"),
    },
  ];

  return (
    <div>
      <PageHeader
        title={`Wallet — ${customer.full_name}`}
        description="Append-only ledger. Balance is always derived from ledger entries; corrections are made via reversal, never by editing or deleting a row."
        actions={
          <Can permission="wallet:manual_credit" userPermissions={userPermissions}>
            <Button onClick={() => setCreditModalOpen(true)}>Manual Credit</Button>
          </Can>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", maxWidth: 720, marginBottom: "1.5rem" }}>
        <MetricCard label="Available Balance" value={`$${centsToMajor(wallet.availableBalanceCents)}`} />
        <MetricCard label="Currency" value={wallet.currency} />
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <Can permission="wallet:manual_debit" userPermissions={userPermissions}>
          <Button variant="danger" onClick={() => setDebitModalOpen(true)}>
            Manual Debit
          </Button>
        </Can>
      </div>

      <DataTable<WalletLedgerEntry>
        columns={columns}
        rows={ledger}
        isLoading={isLoading}
        emptyTitle="No ledger entries yet."
        emptyDescription="Manual credits, debits, and cashback will appear here."
        renderRowActions={(row) =>
          row.type !== "reversal" ? (
            <Can permission="wallet:reverse" userPermissions={userPermissions}>
              <Button variant="secondary" onClick={() => setReverseTarget(row)}>
                Reverse
              </Button>
            </Can>
          ) : null
        }
        pagination={{
          page: meta.page,
          pageSize: meta.pageSize,
          totalItems: meta.totalItems,
          totalPages: meta.totalPages,
          onPageChange: setPage,
        }}
      />

      <ManualEntryModal
        isOpen={creditModalOpen}
        direction="credit"
        customerName={customer.full_name}
        currentBalanceCents={wallet.availableBalanceCents}
        onClose={() => setCreditModalOpen(false)}
        onSubmit={(form) => handleManualEntry("credit", form)}
        isSubmitting={isSubmittingEntry}
      />

      <ManualEntryModal
        isOpen={debitModalOpen}
        direction="debit"
        customerName={customer.full_name}
        currentBalanceCents={wallet.availableBalanceCents}
        onClose={() => setDebitModalOpen(false)}
        onSubmit={(form) => handleManualEntry("debit", form)}
        isSubmitting={isSubmittingEntry}
      />

      <ConfirmDialog
        isOpen={reverseTarget !== null}
        title="Reverse Ledger Entry"
        message={
          <div>
            <p>
              This creates a new, opposite-direction ledger entry. The original entry is never edited or deleted.
            </p>
            <FormField label="Reason for reversal" htmlFor="reverse-reason" required>
              <Textarea
                id="reverse-reason"
                rows={2}
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
              />
            </FormField>
          </div>
        }
        confirmLabel="Reverse Entry"
        isDestructive
        isConfirming={isReversing}
        onConfirm={handleReverse}
        onCancel={() => {
          setReverseTarget(null);
          setReverseReason("");
        }}
      />
    </div>
  );
}
