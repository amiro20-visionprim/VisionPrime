import React from "react";

export const metadata = {
  title: "VisionPrime OS — Admin",
  description: "VisionPrime OS Admin console",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
