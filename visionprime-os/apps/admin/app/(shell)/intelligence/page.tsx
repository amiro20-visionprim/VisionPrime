import { PageHeader, DataTable } from "@visionprime/ui";

interface InsightRow {
  id: string;
}

export default function IntelligencePage() {
  return (
    <div>
      <PageHeader title="Intelligence" description="AI recommendations land in a later phase." />
      <DataTable<InsightRow>
        columns={[{ key: "id", header: "ID" }]}
        rows={[]}
        emptyTitle="No insights yet."
        emptyDescription="AI-generated insights will appear here once the Intelligence module ships."
      />
    </div>
  );
}
