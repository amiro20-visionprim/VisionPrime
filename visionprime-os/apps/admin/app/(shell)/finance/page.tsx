import { PageHeader, DataTable } from "@visionprime/ui";

interface FinanceRow {
  id: string;
}

export default function FinancePage() {
  return (
    <div>
      <PageHeader title="Finance" description="Financial reconciliation lands in a later phase." />
      <DataTable<FinanceRow>
        columns={[{ key: "id", header: "ID" }]}
        rows={[]}
        emptyTitle="No finance records yet."
        emptyDescription="Finance records will appear here once the Finance module ships."
      />
    </div>
  );
}
