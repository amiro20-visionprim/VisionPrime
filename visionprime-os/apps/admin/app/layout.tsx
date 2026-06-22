import React from "react";
import { ToastProvider } from "@visionprime/ui";

export const metadata = {
  title: "VisionPrime OS — Admin",
  description: "VisionPrime OS Admin console",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
