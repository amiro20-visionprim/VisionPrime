/**
 * Placeholder login page. Real authentication is implemented in a
 * later phase — this only establishes the route and basic form markup.
 */
export default function LoginPage() {
  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
      <form style={{ width: 320, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>VisionPrime OS</h1>
        <input type="email" placeholder="Email" disabled />
        <input type="password" placeholder="Password" disabled />
        <button type="button" disabled>
          Sign in (not implemented yet)
        </button>
      </form>
    </div>
  );
}
