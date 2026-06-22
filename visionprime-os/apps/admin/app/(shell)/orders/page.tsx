import { PageHeader, DataTable } from "@visionprime/ui";

interface OrderRow {
  id: string;
}

export default function OrdersPage() {
  return (
    <div>
      <PageHeader title="Orders" description="WooCommerce order sync lands in a later phase." />
      <DataTable<OrderRow>
        columns={[{ key: "id", header: "ID" }]}
        rows={[]}
        emptyTitle="No orders yet."
        emptyDescription="Orders will appear here once WooCommerce sync ships."
      />
    </div>
  );
}
