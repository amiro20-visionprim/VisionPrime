import { PageHeader, DataTable } from "@visionprime/ui";

interface NotificationRow {
  id: string;
}

export default function NotificationsPage() {
  return (
    <div>
      <PageHeader title="Notifications" description="Outbound notification history lands in a later phase." />
      <DataTable<NotificationRow>
        columns={[{ key: "id", header: "ID" }]}
        rows={[]}
        emptyTitle="No notifications yet."
        emptyDescription="Sent notifications will appear here once the Notifications module ships."
      />
    </div>
  );
}
