import { PageHeader, DataTable } from "@visionprime/ui";

interface WalletEntryRow {
  id: string;
}

export default function WalletPage() {
  return (
    <div>
      <PageHeader title="Wallet" description="Append-only wallet ledger lands in a later phase." />
      <DataTable<WalletEntryRow>
        columns={[{ key: "id", header: "ID" }]}
        rows={[]}
        emptyTitle="No wallet activity yet."
        emptyDescription="Wallet ledger entries will appear here once the Wallet module ships."
      />
    </div>
  );
}
