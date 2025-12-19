// apps/web/app/embed/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: "noindex, nofollow",
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "transparent",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <main
          style={{
            maxWidth: 760,
            margin: "0 auto",
            padding: "12px 16px",
            background: "transparent",
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
