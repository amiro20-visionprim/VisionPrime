import { PageHeader, DataTable } from "@visionprime/ui";

interface UserRow {
  id: string;
}

export default function UsersPage() {
  return (
    <div>
      <PageHeader title="Users" description="Admin user and role management lands in a later phase." />
      <DataTable<UserRow>
        columns={[{ key: "id", header: "ID" }]}
        rows={[]}
        emptyTitle="No admin users yet."
        emptyDescription="Admin users will appear here once the Users module ships."
      />
    </div>
  );
}
