import { PageHeader, DataTable } from "@visionprime/ui";

interface CustomerRow {
  id: string;
}

export default function CustomersPage() {
  return (
    <div>
      <PageHeader title="Customers" description="Customer 360 records land in a later phase." />
      <DataTable<CustomerRow>
        columns={[{ key: "id", header: "ID" }]}
        rows={[]}
        emptyTitle="No customers yet."
        emptyDescription="Customer records will appear here once the Customer 360 module ships."
      />
    </div>
  );
}
