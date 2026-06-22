import { PageHeader, DataTable } from "@visionprime/ui";

interface RewardRow {
  id: string;
}

export default function RewardsPage() {
  return (
    <div>
      <PageHeader title="Rewards" description="Reward catalog and redemptions land in a later phase." />
      <DataTable<RewardRow>
        columns={[{ key: "id", header: "ID" }]}
        rows={[]}
        emptyTitle="No rewards yet."
        emptyDescription="Rewards will appear here once the Rewards module ships."
      />
    </div>
  );
}
