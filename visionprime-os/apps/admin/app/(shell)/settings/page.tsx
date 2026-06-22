import { PageHeader, DataTable } from "@visionprime/ui";

interface SettingRow {
  id: string;
}

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="System configuration lands in a later phase." />
      <DataTable<SettingRow>
        columns={[{ key: "id", header: "ID" }]}
        rows={[]}
        emptyTitle="No settings configured yet."
        emptyDescription="Configuration options will appear here once the Settings module ships."
      />
    </div>
  );
}
