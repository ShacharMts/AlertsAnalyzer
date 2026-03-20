"use client";

import { CityAlertCount } from "@/types/alerts";
import { useI18n } from "@/lib/i18n";
import cities from "@/data/cities.json";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Props {
  cityAlerts: CityAlertCount[];
  mode?: "top" | "bottom";
  selectedCityId?: string | null;
  onCityClick?: (cityId: string) => void;
}

export default function TopCities({ cityAlerts, mode = "top", selectedCityId, onCityClick }: Props) {
  const { t, locale } = useI18n();

  const items = mode === "top"
    ? cityAlerts.slice(0, 10)
    : [...cityAlerts].reverse().slice(0, 10);

  const cityMap = new Map(cities.map((c) => [c.id, c]));

  if (!items.length) return null;

  const title = mode === "top" ? t.topCities : t.bottomCities;

  const chartData = items.map((ca) => {
    const city = cityMap.get(ca.cityId);
    const name = city ? (locale === "he" ? city.he : city.en) : ca.cityId;
    return {
      cityId: ca.cityId,
      name,
      missiles: ca.missileCount,
      warnings: ca.warningCount,
    };
  });

  // Compute Y-axis width based on longest label (~8px per char for Hebrew, ~7px for English)
  const maxLabelLen = Math.max(...chartData.map((d) => d.name.length), 1);
  const charWidth = locale === "he" ? 9 : 7;
  const yAxisWidth = Math.min(Math.max(maxLabelLen * charWidth + 12, 60), 180);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = (data: any) => {
    if (onCityClick && data?.cityId) {
      onCityClick(data.cityId);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h3>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis
              dataKey="name"
              type="category"
              width={yAxisWidth}
              tick={{ fontSize: 11, textAnchor: "end" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(17, 24, 39, 0.95)",
                border: "none",
                borderRadius: "8px",
                color: "#f3f4f6",
              }}
              cursor={{ fill: "rgba(59, 130, 246, 0.1)" }}
            />
            <Legend />
            <Bar
              dataKey="missiles"
              name={t.chart.missiles}
              fill={mode === "bottom" ? "#2563eb" : "#ef4444"}
              radius={[0, 2, 2, 0]}
              onClick={(data) => handleBarClick(data)}
              className={onCityClick ? "cursor-pointer" : ""}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.cityId}
                  fill={selectedCityId === entry.cityId ? "#1e40af" : (mode === "bottom" ? "#2563eb" : "#ef4444")}
                />
              ))}
            </Bar>
            <Bar
              dataKey="warnings"
              name={t.chart.warnings}
              fill={mode === "bottom" ? "#93c5fd" : "#fdba74"}
              radius={[0, 2, 2, 0]}
              onClick={(data) => handleBarClick(data)}
              className={onCityClick ? "cursor-pointer" : ""}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.cityId}
                  fill={selectedCityId === entry.cityId ? "#1e40af" : (mode === "bottom" ? "#93c5fd" : "#fdba74")}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
