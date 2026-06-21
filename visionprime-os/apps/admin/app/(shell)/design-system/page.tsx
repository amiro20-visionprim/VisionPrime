import { PageHeader, DataTable, EmptyState, LoadingState, ErrorState } from "@visionprime/ui";

interface SampleRow {
  id: string;
  name: string;
}

/**
 * Design-system preview page — renders the shared `packages/ui`
 * components in isolation so they can be visually verified without
 * needing a real module/page built on top of them yet.
 */
export default function DesignSystemPreviewPage() {
  const sampleRows: SampleRow[] = [
    { id: "1", name: "Sample row A" },
    { id: "2", name: "Sample row B" },
  ];

  return (
    <div>
      <PageHeader title="Design System Preview" description="Shared @visionprime/ui components." />

      <section style={{ marginBottom: "2rem" }}>
        <h2>DataTable — with rows</h2>
        <DataTable<SampleRow> columns={[{ key: "name", header: "Name" }]} rows={sampleRows} />
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>DataTable — empty state</h2>
        <DataTable<SampleRow> columns={[{ key: "name", header: "Name" }]} rows={[]} />
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>Loading state</h2>
        <LoadingState />
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>Empty state</h2>
        <EmptyState title="No campaigns yet" />
      </section>

      <section>
        <h2>Error state</h2>
        <ErrorState message="Failed to load data." />
      </section>
    </div>
  );
}
