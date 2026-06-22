import { PageHeader, DataTable } from "@visionprime/ui";

interface ReportRow {
  id: string;
}

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="Reports" description="Reporting dashboards land in a later phase." />
      <DataTable<ReportRow>
        columns={[{ key: "id", header: "ID" }]}
        rows={[]}
        emptyTitle="No reports yet."
        emptyDescription="Reports will appear here once the Reports module ships."
      />
    </div>
  );
}
