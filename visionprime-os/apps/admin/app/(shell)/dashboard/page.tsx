import { PageHeader, MetricCard } from "@visionprime/ui";

/**
 * Placeholder dashboard page. Real widgets (orders, wallet activity,
 * loyalty stats) are added once their respective modules exist.
 */
export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" description="Phase 02 placeholder — module widgets land in later phases." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <MetricCard label="Customers" value="—" />
        <MetricCard label="Orders" value="—" />
        <MetricCard label="Wallet Balance" value="—" />
        <MetricCard label="Active Campaigns" value="—" />
      </div>
    </div>
  );
}
