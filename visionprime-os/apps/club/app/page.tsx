import { PageHeader } from "@visionprime/ui";

/**
 * Placeholder mobile-first home page. Real customer auth, wallet/points
 * balances, and rewards are added in later phases.
 */
export default function ClubHomePage() {
  return (
    <main style={{ padding: "1rem" }}>
      <PageHeader title="Welcome" description="VisionPrime Club — Phase 01 placeholder." />
      <p style={{ color: "#6b7280" }}>Your wallet, points, and rewards will appear here once those modules ship.</p>
    </main>
  );
}
