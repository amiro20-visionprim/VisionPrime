import { PageHeader, DataTable } from "@visionprime/ui";

interface SegmentRow {
  id: string;
}

export default function SegmentsPage() {
  return (
    <div>
      <PageHeader title="Segments" description="Customer segmentation lands in a later phase." />
      <DataTable<SegmentRow>
        columns={[{ key: "id", header: "ID" }]}
        rows={[]}
        emptyTitle="No segments yet."
        emptyDescription="Segments will appear here once the Segments module ships."
      />
    </div>
  );
}
