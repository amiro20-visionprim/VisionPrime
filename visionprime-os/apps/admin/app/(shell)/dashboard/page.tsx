import { PageHeader } from "@visionprime/ui";

/**
 * Placeholder dashboard page. Real widgets (orders, wallet activity,
 * loyalty stats) are added once their respective modules exist.
 */
export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" description="Phase 01 placeholder — module widgets land in later phases." />
      <p style={{ color: "#6b7280" }}>Nothing to show yet. This page confirms the Admin OS shell renders.</p>
    </div>
  );
}
