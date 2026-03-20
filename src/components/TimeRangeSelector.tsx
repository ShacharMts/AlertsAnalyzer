"use client";

import { TimeRange } from "@/types/alerts";
import { useI18n } from "@/lib/i18n";

const ranges: TimeRange[] = ["6h", "12h", "24h", "2d", "7d", "14d"];

interface Props {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
}

export default function TimeRangeSelector({ selected, onChange }: Props) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap gap-2">
      {ranges.map((range) => (
        <button
          key={range}
          onClick={() => onChange(range)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            selected === range
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          {t.timeRanges[range]}
        </button>
      ))}
    </div>
  );
}
