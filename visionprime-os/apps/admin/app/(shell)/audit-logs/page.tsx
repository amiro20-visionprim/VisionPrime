import { PageHeader, DataTable } from "@visionprime/ui";

interface AuditLogRow {
  id: string;
}

export default function AuditLogsPage() {
  return (
    <div>
      <PageHeader title="Audit Logs" description="System audit trail lands in a later phase." />
      <DataTable<AuditLogRow>
        columns={[{ key: "id", header: "ID" }]}
        rows={[]}
        emptyTitle="No audit log entries yet."
        emptyDescription="Audit log entries will appear here once auditing is wired into each module."
      />
    </div>
  );
}
