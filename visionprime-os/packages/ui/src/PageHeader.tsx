import React from "react";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

/**
 * Shared page header per /docs/ui-ux-guidelines.md — every Admin OS
 * page should start with this instead of hand-rolled header markup.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
      <div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>{title}</h1>
        {description ? <p style={{ color: "#6b7280", marginTop: "0.25rem" }}>{description}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </header>
  );
}
