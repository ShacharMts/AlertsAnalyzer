"use client";

import { useI18n } from "@/lib/i18n";
import { TimeSeriesPoint } from "@/lib/aggregator";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: TimeSeriesPoint[];
  loading: boolean;
  title?: string;
  onClearFilter?: () => void;
}

export default function AlertsChart({ data, loading, title, onClearFilter }: Props) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="animate-pulse rounded-xl bg-gray-100 p-6 dark:bg-gray-800">
        <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-4 h-64 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  if (!data.length) return null;

  const chartTitle = title ?? t.chart.title;

  const tooltipStyle = {
    backgroundColor: "rgba(17, 24, 39, 0.95)",
    border: "none",
    borderRadius: "8px",
    color: "#f3f4f6",
  };

  return (
    <div>
      {onClearFilter && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={onClearFilter}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            {t.clearFilter}
          </button>
        </div>
      )}
      {/* Combined chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">
          {chartTitle}
        </h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="missiles" name={`🚀 ${t.chart.missiles}`} fill="#ef4444" radius={[2, 2, 0, 0]} />
              <Bar dataKey="warnings" name={`⚠️ ${t.chart.warnings}`} fill="#fdba74" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data table */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <th className="px-3 py-2 text-start font-semibold text-gray-700 dark:text-gray-300">
                {t.chart.dateHour ?? "Date:Hour"}
              </th>
              <th className="px-3 py-2 text-center font-semibold text-red-600">
                🚀 {t.chart.missiles}
              </th>
              <th className="px-3 py-2 text-center font-semibold text-orange-500">
                ⚠️ {t.chart.warnings}
              </th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().filter((row) => row.missiles > 0 || row.warnings > 0).map((row, i) => (
              <tr
                key={row.label}
                className={
                  i % 2 === 0
                    ? "bg-white dark:bg-gray-900"
                    : "bg-gray-50 dark:bg-gray-800/50"
                }
              >
                <td className="px-3 py-1.5 text-gray-800 dark:text-gray-200 whitespace-nowrap">
                  {row.label}
                </td>
                <td className="px-3 py-1.5 text-center font-medium text-red-600 dark:text-red-400">
                  {row.missiles}
                </td>
                <td className="px-3 py-1.5 text-center font-medium text-orange-500 dark:text-orange-400">
                  {row.warnings}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
