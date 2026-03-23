"use client";

import { I18nProvider } from "@/lib/i18n";
import AlertsDashboard from "@/components/AlertsDashboard";

export default function MapPage() {
  return (
    <I18nProvider>
      <AlertsDashboard />
    </I18nProvider>
  );
}
