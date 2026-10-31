import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Team Italfit · Workspace", template: "%s · Team Italfit" },
  description:
    "Lo spazio di lavoro di Team Italfit. Persone, percorsi e allenamento, insieme.",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/favicon.png", apple: "/brand/favicon.png" },
};

export const viewport: Viewport = { themeColor: "#191919" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body className="antialiased">{children}</body>
    </html>
  );
}
