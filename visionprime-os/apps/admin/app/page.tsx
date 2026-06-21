import Link from "next/link";

export default function RootPage() {
  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1rem" }}>
      <h1>VisionPrime OS — Admin</h1>
      <p>
        <Link href="/login">Login (placeholder)</Link> &middot; <Link href="/dashboard">Dashboard (placeholder)</Link>{" "}
        &middot; <Link href="/design-system">Design System</Link>
      </p>
    </div>
  );
}
