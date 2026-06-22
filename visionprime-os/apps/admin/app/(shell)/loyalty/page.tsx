import { PageHeader, DataTable } from "@visionprime/ui";

interface LoyaltyRow {
  id: string;
}

export default function LoyaltyPage() {
  return (
    <div>
      <PageHeader title="Loyalty" description="Points and tiers land in a later phase." />
      <DataTable<LoyaltyRow>
        columns={[{ key: "id", header: "ID" }]}
        rows={[]}
        emptyTitle="No loyalty activity yet."
        emptyDescription="Points and tier history will appear here once the Loyalty module ships."
      />
    </div>
  );
}
