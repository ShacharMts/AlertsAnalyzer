"use client";

import { AlertsSummary } from "@/types/alerts";
import { useI18n } from "@/lib/i18n";

interface Props {
  summary: AlertsSummary | null;
  loading: boolean;
}

export default function AlertsSummaryCards({ summary, loading }: Props) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="animate-pulse rounded-xl bg-gray-100 p-6 dark:bg-gray-800">
            <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mt-3 h-8 w-16 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const cards = [
    {
      label: t.missiles,
      value: summary.missileCount,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
      icon: "🚀",
    },
    {
      label: t.warnings,
      value: summary.warningCount,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800",
      icon: "⚠️",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border p-6 ${card.bg}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">{card.icon}</span>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {card.label}
            </span>
          </div>
          <div className={`mt-2 text-3xl font-bold ${card.color}`}>
            {card.value.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
