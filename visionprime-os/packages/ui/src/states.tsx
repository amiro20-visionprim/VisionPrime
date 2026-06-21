import React from "react";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>{label}</div>;
}

export function EmptyState({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
      <p>{title}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message = "Something went wrong." }: { message?: string }) {
  return (
    <div style={{ padding: "2rem", textAlign: "center", color: "#b91c1c" }}>
      <p>{message}</p>
    </div>
  );
}
