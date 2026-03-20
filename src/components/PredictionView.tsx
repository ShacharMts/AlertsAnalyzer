"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { Prediction, HourlyAverage } from "@/types/alerts";
import { ForecastLinePoint } from "@/lib/predictor";
import cities from "@/data/cities.json";
import { withDevice } from "@/lib/deviceName";
import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from "recharts";

interface Props {
  hourlyAverages: HourlyAverage[];
  loading: boolean;
  gpsCityId?: string | null;
  selectedCityId: string;
  onCityChange: (cityId: string) => void;
}

export default function PredictionView({ hourlyAverages: initialAverages, loading, gpsCityId, selectedCityId, onCityChange }: Props) {
  const { t, locale } = useI18n();

  // Default date: now, formatted for datetime-local input
  const getDefaultDateTime = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  const [selectedDateTime, setSelectedDateTime] = useState(getDefaultDateTime);
  const selectedCity = selectedCityId;
  const handleCityChange = onCityChange;
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [hourlyAverages, setHourlyAverages] = useState<HourlyAverage[]>(initialAverages);
  const [forecastLines, setForecastLines] = useState<ForecastLinePoint[]>([]);
  const [predLoading, setPredLoading] = useState(false);

  // Auto-detect closest city via GPS if no city is saved
  useEffect(() => {
    if (!gpsCityId) return;
    if (selectedCityId) return; // already have a selection
    onCityChange(gpsCityId);
  }, [gpsCityId, selectedCityId, onCityChange]);

  // Sort cities alphabetically by locale
  const sortedCities = [...cities].sort((a, b) => {
    const nameA = locale === "he" ? a.he : a.en;
    const nameB = locale === "he" ? b.he : b.en;
    return nameA.localeCompare(nameB, locale);
  });

  // Re-fetch hourly averages when city changes
  // First refresh city data from oref if stale (>15 min)
  const fetchHourlyAverages = useCallback(async (cityId: string) => {
    if (cityId) {
      await fetch(withDevice(`/api/alerts?action=refresh-city&cityId=${encodeURIComponent(cityId)}`));
    }
    const url = cityId
      ? `/api/alerts?action=hourly-averages&cityId=${encodeURIComponent(cityId)}`
      : `/api/alerts?action=hourly-averages`;
    const res = await fetch(withDevice(url));
    const data = await res.json();
    setHourlyAverages(data);
  }, []);

  useEffect(() => {
    setHourlyAverages(initialAverages);
  }, [initialAverages]);

  useEffect(() => {
    fetchHourlyAverages(selectedCity);
  }, [selectedCity, fetchHourlyAverages]);

  // Fetch forecast lines whenever city or selected date changes
  const fetchForecastLines = useCallback(async (cityId: string, dateTime: string) => {
    const dt = dateTime ? new Date(dateTime) : new Date();
    const dow = dt.getDay();
    // Ensure fresh city data is in cache before computing forecast
    if (cityId) {
      await fetch(withDevice(`/api/alerts?action=refresh-city&cityId=${encodeURIComponent(cityId)}`));
    }
    let url = `/api/alerts?action=forecast-lines&dayOfWeek=${dow}`;
    if (cityId) url += `&cityId=${encodeURIComponent(cityId)}`;
    const res = await fetch(withDevice(url));
    const data = await res.json();
    setForecastLines(data);
  }, []);

  useEffect(() => {
    fetchForecastLines(selectedCity, selectedDateTime);
  }, [selectedCity, selectedDateTime, fetchForecastLines]);

  // Auto-calculate prediction whenever city or datetime changes
  const fetchPrediction = useCallback(async (cityId: string, dateTime: string) => {
    if (!dateTime) return;
    setPredLoading(true);
    // Ensure fresh city data is in cache before predicting
    if (cityId) {
      await fetch(withDevice(`/api/alerts?action=refresh-city&cityId=${encodeURIComponent(cityId)}`));
    }
    let predictUrl = `/api/alerts?action=predict&dateTime=${encodeURIComponent(dateTime)}`;
    if (cityId) {
      predictUrl += `&cityId=${encodeURIComponent(cityId)}`;
    }
    const predRes = await fetch(withDevice(predictUrl));
    const predData = await predRes.json();
    setPrediction(predData);
    setPredLoading(false);
  }, []);

  useEffect(() => {
    fetchPrediction(selectedCity, selectedDateTime);
  }, [selectedCity, selectedDateTime, fetchPrediction]);

  // Get minimum datetime (now) for the input
  const now = new Date();
  const minDateTime = now.toISOString().slice(0, 16);

  // selectedHour for the reference line
  const selectedHour = selectedDateTime ? new Date(selectedDateTime).getHours() : null;

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 rounded-xl bg-gray-100 p-6 dark:bg-gray-800">
        <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-64 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Prediction input */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t.prediction.title}
        </h3>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          {t.prediction.description}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.prediction.selectDateTime}
            </label>
            <input
              type="datetime-local"
              min={minDateTime}
              value={selectedDateTime}
              onChange={(e) => setSelectedDateTime(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.prediction.selectCity}
            </label>
            <div className="flex items-center gap-1">
              <select
                value={selectedCity}
                onChange={(e) => handleCityChange(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 min-w-[180px]"
              >
                <option value="">{t.prediction.allCities}</option>
                {sortedCities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {locale === "he" ? city.he : city.en}
                  </option>
                ))}
              </select>
              {gpsCityId && (
                <button
                  onClick={() => handleCityChange(gpsCityId)}
                  title={locale === "he" ? "עיר קרובה לפי GPS" : "Nearest city by GPS"}
                  className="flex items-center justify-center rounded-lg border border-gray-300 bg-white p-1 transition-colors hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
                >
                  <img
                    src="https://maps.google.com/mapfiles/ms/icons/red-dot.png"
                    alt="GPS"
                    width={28}
                    height={28}
                  />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Prediction result */}
        {prediction && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20">
              <div className="text-sm text-orange-600 dark:text-orange-400">
                {t.prediction.estimatedWarnings}
              </div>
              <div className="mt-1 text-2xl font-bold text-orange-700 dark:text-orange-300">
                {prediction.pctWarnings}%
              </div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <div className="text-sm text-red-600 dark:text-red-400">
                {t.prediction.estimatedMissiles}
              </div>
              <div className="mt-1 text-2xl font-bold text-red-700 dark:text-red-300">
                {prediction.pctMissiles}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Forecast line chart — 2 lines per hour */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t.prediction.forecastChart}
          {selectedCity && (
            <span className="ml-2 text-sm font-normal text-blue-600 dark:text-blue-400">
              — {locale === "he"
                ? cities.find((c) => c.id === selectedCity)?.he
                : cities.find((c) => c.id === selectedCity)?.en}
            </span>
          )}
        </h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={forecastLines.map((p) => ({
                hour: `${p.hour.toString().padStart(2, "0")}:00`,
                [t.prediction.forecastAllDays]: p.pctAllDays,
                [t.prediction.forecastSameDay]: p.pctSameDay,
                [t.prediction.forecastStdDev]: p.stdDev,
                stdDevRange: [
                  Math.max(0, p.pctAllDays - Math.round(p.stdDev / (p.avgAllDays || 1) * p.pctAllDays)),
                  Math.min(100, p.pctAllDays + Math.round(p.stdDev / (p.avgAllDays || 1) * p.pctAllDays)),
                ],
              }))}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={1} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} domain={[0, 100]} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(17, 24, 39, 0.95)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#f3f4f6",
                }}
              />
              <Legend />
              {selectedHour !== null && (
                <ReferenceLine
                  x={`${selectedHour.toString().padStart(2, "0")}:00`}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{ value: "▼", position: "top", fill: "#3b82f6" }}
                />
              )}
              <Area
                type="monotone"
                dataKey="stdDevRange"
                fill="#ef4444"
                fillOpacity={0.1}
                stroke="none"
                name={t.prediction.forecastStdDev}
                legendType="square"
              />
              <Line
                type="monotone"
                dataKey={t.prediction.forecastAllDays}
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey={t.prediction.forecastSameDay}
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
