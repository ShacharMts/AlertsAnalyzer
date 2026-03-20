"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { AI2Result, AI2HourlyPrediction } from "@/lib/aiModel";
import cities from "@/data/cities.json";
import { withDevice } from "@/lib/deviceName";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

interface Props {
  gpsCityId?: string | null;
  selectedCityId: string;
  onCityChange: (cityId: string) => void;
}

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

const RISK_BG: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function AI2PredictionView({ gpsCityId, selectedCityId, onCityChange }: Props) {
  const { t, locale } = useI18n();
  const [prediction, setPrediction] = useState<AI2Result | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gpsCityId) return;
    if (selectedCityId) return;
    onCityChange(gpsCityId);
  }, [gpsCityId, selectedCityId, onCityChange]);

  const sortedCities = [...cities].sort((a, b) => {
    const nameA = locale === "he" ? a.he : a.en;
    const nameB = locale === "he" ? b.he : b.en;
    return nameA.localeCompare(nameB, locale);
  });

  const fetchPrediction = useCallback(async (cityId: string) => {
    if (!cityId) { setPrediction(null); return; }
    setLoading(true);
    try {
      const res = await fetch(withDevice(`/api/alerts?action=ai2-predict&cityId=${encodeURIComponent(cityId)}`));
      const data = await res.json();
      setPrediction(data);
    } catch (err) {
      console.error("AI2 prediction failed:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedCityId) fetchPrediction(selectedCityId);
  }, [selectedCityId, fetchPrediction]);

  const cityName = (id: string) => {
    const c = cities.find((c) => c.id === id);
    return c ? (locale === "he" ? c.he : c.en) : id;
  };

  const ai2 = t.ai2;
  const riskLabel = (level: string) => {
    const labels = ai2?.riskLevels || { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
    return labels[level as keyof typeof labels] || level;
  };

  return (
    <div className="space-y-6">
      {/* City selector */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {ai2?.selectCity || "Select City"}
          </label>
          <select
            value={selectedCityId}
            onChange={(e) => onCityChange(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="">{ai2?.selectCityPrompt || "Select a city"}</option>
            {sortedCities.map((city) => (
              <option key={city.id} value={city.id}>
                {locale === "he" ? city.he : city.en}
              </option>
            ))}
          </select>
          {gpsCityId && (
            <button
              onClick={() => onCityChange(gpsCityId)}
              title={locale === "he" ? "עיר קרובה לפי GPS" : "Nearest city by GPS"}
              className="flex items-center justify-center rounded-lg border border-gray-300 bg-white p-1 transition-colors hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <img src="https://maps.google.com/mapfiles/ms/icons/red-dot.png" alt="GPS" width={28} height={28} />
            </button>
          )}
        </div>
      </div>

      {/* No city */}
      {!selectedCityId && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="text-gray-500 dark:text-gray-400">{ai2?.selectCityPrompt || "Select a city to see AI predictions"}</p>
        </div>
      )}

      {/* Loading */}
      {loading && selectedCityId && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">{ai2?.training || "Training neural network..."}</p>
        </div>
      )}

      {/* Results */}
      {prediction && !loading && (
        <>
          {/* Overview cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{ai2?.overallRisk || "Overall Risk"}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-2xl font-bold" style={{ color: RISK_COLORS[prediction.overallLevel] }}>
                  {prediction.overallRisk}%
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RISK_BG[prediction.overallLevel]}`}>
                  {riskLabel(prediction.overallLevel)}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{ai2?.peakHour || "Peak Risk Hour"}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {prediction.peakHour.toString().padStart(2, "0")}:00
              </p>
              <p className="text-xs text-gray-500">{prediction.peakRisk}% {ai2?.risk || "risk"}</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{ai2?.accuracy || "Model Accuracy"}</p>
              <p className="mt-1 text-2xl font-bold text-purple-600">{prediction.modelAccuracy}%</p>
              <p className="text-xs text-gray-500">
                {prediction.trainingSamples} {ai2?.samples || "samples"}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{ai2?.attacks30d || "Attacks (30d)"}</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{prediction.totalCityAttacks30d}</p>
              <p className="text-xs text-gray-500">
                + {prediction.totalNearbyAttacks30d} {ai2?.nearby || "nearby"}
              </p>
            </div>
          </div>

          {/* Neural network badge */}
          <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 dark:border-purple-800 dark:bg-purple-900/30">
            <span className="text-lg">🧠</span>
            <span className="text-sm text-purple-800 dark:text-purple-200">
              {ai2?.modelInfo || "2-layer neural network (12 features → 8 hidden neurons → sigmoid output) trained on 30 days of data"}
            </span>
          </div>

          {/* 24h Risk Bar Chart */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {ai2?.timeline || "24-Hour Neural Network Prediction"}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={prediction.next24h.map((h) => {
                  const dt = new Date(Date.now() + h.hourOffset * 60 * 60 * 1000);
                  return {
                    ...h,
                    chartLabel: `${dt.getDate().toString().padStart(2, "0")}/${(dt.getMonth() + 1).toString().padStart(2, "0")} ${h.label}`,
                  };
                })}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="chartLabel" tick={{ fontSize: 9 }} interval={2} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  label={{ value: ai2?.probability || "Probability %", angle: -90, position: "insideLeft", fontSize: 12 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as AI2HourlyPrediction & { chartLabel: string };
                    return (
                      <div className="rounded-lg border bg-white p-3 text-sm shadow-lg dark:border-gray-600 dark:bg-gray-800">
                        <p className="font-semibold">{d.chartLabel}</p>
                        <p style={{ color: RISK_COLORS[d.riskLevel] }}>
                          {ai2?.probability || "Probability"}: {d.riskPct}% ({riskLabel(d.riskLevel)})
                        </p>
                        <p>{ai2?.confidence || "Confidence"}: {d.confidence}%</p>
                        <p>{ai2?.rawOutput || "Raw output"}: {d.probability}</p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={25} stroke="#22c55e" strokeDasharray="3 3" />
                <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" />
                <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="3 3" />
                <Bar dataKey="riskPct" radius={[4, 4, 0, 0]}>
                  {prediction.next24h.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={RISK_COLORS[entry.riskLevel]}
                      stroke={entry.hourOffset === 0 ? "#7c3aed" : undefined}
                      strokeWidth={entry.hourOffset === 0 ? 2 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded" style={{ background: RISK_COLORS.low }}></span>
                {riskLabel("low")} (0-24%)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded" style={{ background: RISK_COLORS.medium }}></span>
                {riskLabel("medium")} (25-49%)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded" style={{ background: RISK_COLORS.high }}></span>
                {riskLabel("high")} (50-74%)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded" style={{ background: RISK_COLORS.critical }}></span>
                {riskLabel("critical")} (75-100%)
              </span>
            </div>
          </div>

          {/* Hourly breakdown table */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {ai2?.hourlyBreakdown || "Hourly Predictions"}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-start text-xs font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <th className="px-2 py-2">{ai2?.dateTime || "Date/Time"}</th>
                    <th className="px-2 py-2">{ai2?.probability || "Probability"}</th>
                    <th className="px-2 py-2">{ai2?.level || "Level"}</th>
                    <th className="px-2 py-2">{ai2?.confidence || "Confidence"}</th>
                  </tr>
                </thead>
                <tbody>
                  {prediction.next24h.map((h) => {
                    const dt = new Date(Date.now() + h.hourOffset * 60 * 60 * 1000);
                    const dateLabel = `${dt.getDate().toString().padStart(2, "0")}/${(dt.getMonth() + 1).toString().padStart(2, "0")} ${h.label}`;
                    return (
                      <tr
                        key={h.hourOffset}
                        className={`border-b dark:border-gray-700 ${
                          h.hourOffset === 0 ? "bg-purple-50 dark:bg-purple-900/20" : ""
                        }`}
                      >
                        <td className="px-2 py-1.5 font-medium">{dateLabel}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${h.riskPct}%`, background: RISK_COLORS[h.riskLevel] }}
                              ></div>
                            </div>
                            <span className="text-xs">{h.riskPct}%</span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RISK_BG[h.riskLevel]}`}>
                            {riskLabel(h.riskLevel)}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-xs">{h.confidence}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Nearby cities */}
          {prediction.nearbyCityIds.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {ai2?.nearbyCitiesTitle || "Nearby Cities in Model"} ({prediction.nearbyCityIds.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {prediction.nearbyCityIds.map((id) => (
                  <span key={id} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {cityName(id)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            {ai2?.disclaimer || "Neural network predictions are based on historical patterns. Model is retrained on each request. Always follow official emergency instructions."}
          </p>
        </>
      )}
    </div>
  );
}
