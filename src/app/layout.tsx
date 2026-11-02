import type { Metadata, Viewport } from "next";
import "./globals.css";
import { themeScript } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: { default: "Team Italfit · Workspace", template: "%s · Team Italfit" },
  description:
    "Lo spazio di lavoro di Team Italfit. Persone, percorsi e allenamento, insieme.",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/favicon.png", apple: "/brand/favicon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
