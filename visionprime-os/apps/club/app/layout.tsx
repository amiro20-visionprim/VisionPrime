import React from "react";

export const metadata = {
  title: "VisionPrime Club",
  description: "Customer Club — mobile-first",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          maxWidth: 480,
          marginLeft: "auto",
          marginRight: "auto",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
