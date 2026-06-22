import { PageHeader, DataTable } from "@visionprime/ui";

interface CampaignRow {
  id: string;
}

export default function CampaignsPage() {
  return (
    <div>
      <PageHeader title="Campaigns" description="Marketing campaigns land in a later phase." />
      <DataTable<CampaignRow>
        columns={[{ key: "id", header: "ID" }]}
        rows={[]}
        emptyTitle="No campaigns yet."
        emptyDescription="Campaigns will appear here once the Campaigns module ships."
      />
    </div>
  );
}
