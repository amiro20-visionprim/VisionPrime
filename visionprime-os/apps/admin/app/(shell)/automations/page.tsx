import { PageHeader, DataTable } from "@visionprime/ui";

interface AutomationRow {
  id: string;
}

export default function AutomationsPage() {
  return (
    <div>
      <PageHeader title="Automations" description="Triggered automations land in a later phase." />
      <DataTable<AutomationRow>
        columns={[{ key: "id", header: "ID" }]}
        rows={[]}
        emptyTitle="No automations yet."
        emptyDescription="Automations will appear here once the Automations module ships."
      />
    </div>
  );
}
