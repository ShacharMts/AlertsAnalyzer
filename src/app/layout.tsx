import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "./leaflet-overrides.css";

export const metadata: Metadata = {
  title: "Alerts Analyzer | מנתח התרעות",
  description: "Israel Alert Monitoring Dashboard — לוח מעקב התרעות ישראל",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
