import { PageHeader, DataTable } from "@visionprime/ui";

interface SyncLogRow {
  id: string;
}

export default function WordPressSyncPage() {
  return (
    <div>
      <PageHeader title="WordPress Sync" description="WooCommerce/WordPress sync activity lands in a later phase." />
      <DataTable<SyncLogRow>
        columns={[{ key: "id", header: "ID" }]}
        rows={[]}
        emptyTitle="No sync activity yet."
        emptyDescription="Sync runs will appear here once the WordPress connector ships."
      />
    </div>
  );
}
