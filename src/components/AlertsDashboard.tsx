"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { TimeRange, AlertsSummary as AlertsSummaryType, CityAlertCount, HourlyAverage } from "@/types/alerts";
import { TimeSeriesPoint } from "@/lib/aggregator";
import { withDevice, requestGpsLocation } from "@/lib/deviceName";
import LanguageSwitcher from "./LanguageSwitcher";
import TimeRangeSelector from "./TimeRangeSelector";
import AlertsSummaryCards from "./AlertsSummaryCards";
import AlertsChart from "./AlertsChart";
import IsraelMap from "./IsraelMap";
import TopCities from "./TopCities";
import PredictionView from "./PredictionView";
import AIPredictionView from "./AIPredictionView";
import AI2PredictionView from "./AI2PredictionView";
import cities from "@/data/cities.json";

type Tab = "dashboard" | "map" | "prediction" | "ai" | "ai2";

const TAB_TO_PATH: Record<Tab, string> = {
  dashboard: "/1",
  map: "/2",
  prediction: "/3",
  ai: "/4",
  ai2: "/5",
};

const PATH_TO_TAB: Record<string, Tab> = {
  "/1": "dashboard",
  "/2": "map",
  "/3": "prediction",
  "/4": "ai",
  "/5": "ai2",
};

function getInitialTab(): Tab {
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    if (PATH_TO_TAB[path]) return PATH_TO_TAB[path];
  }
  return "prediction";
}

export default function AlertsDashboard() {
  const { t, locale } = useI18n();
  const [tab, setTabState] = useState<Tab>("prediction");
  const [gpsCityId, setGpsCityId] = useState<string | null>(null);

  // Sync tab from URL on mount (avoids hydration mismatch)
  useEffect(() => {
    const path = window.location.pathname;
    if (PATH_TO_TAB[path] && PATH_TO_TAB[path] !== tab) {
      setTabState(PATH_TO_TAB[path]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Request GPS on site load (user will be prompted once)
  useEffect(() => {
    requestGpsLocation(cities, (cityId) => {
      setGpsCityId(cityId);
    });
  }, []);

  const setTab = useCallback((newTab: Tab) => {
    setTabState(newTab);
    const newPath = TAB_TO_PATH[newTab];
    window.history.pushState(null, "", newPath);
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      if (PATH_TO_TAB[path]) setTabState(PATH_TO_TAB[path]);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const [range, setRange] = useState<TimeRange>("24h");
  const [summary, setSummary] = useState<AlertsSummaryType | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [cityAlerts, setCityAlerts] = useState<CityAlertCount[]>([]);
  const [hourlyAverages, setHourlyAverages] = useState<HourlyAverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("selected_city") || null;
    }
    return null;
  });
  const [cityTimeSeries, setCityTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [cityTsLoading, setCityTsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (r: TimeRange, forceRefresh = false) => {
    setLoading(true);
    const refreshParam = forceRefresh ? '&refresh=true' : '';
    const [summaryRes, timeSeriesRes, citiesRes] = await Promise.all([
      fetch(withDevice(`/api/alerts?action=summary&range=${r}${refreshParam}`)),
      fetch(withDevice(`/api/alerts?action=timeseries&range=${r}${refreshParam}`)),
      fetch(withDevice(`/api/alerts?action=cities&range=${r}${refreshParam}`)),
    ]);
    const [summaryData, tsData, citiesData] = await Promise.all([
      summaryRes.json(),
      timeSeriesRes.json(),
      citiesRes.json(),
    ]);
    setSummary(summaryData);
    setTimeSeries(tsData);
    setCityAlerts(citiesData);
    setLoading(false);
  }, []);

  const fetchHourlyAverages = useCallback(async () => {
    const res = await fetch(withDevice(`/api/alerts?action=hourly-averages`));
    const data = await res.json();
    setHourlyAverages(data);
  }, []);

  const fetchCityTimeSeries = useCallback(async (cityId: string, r: TimeRange) => {
    setCityTsLoading(true);
    const res = await fetch(withDevice(`/api/alerts?action=timeseries&range=${r}&cityId=${cityId}`));
    const data = await res.json();
    setCityTimeSeries(data);
    setCityTsLoading(false);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Single POST call: server fetches oref + merges + returns all data in one invocation
      const cityParam = selectedCityId ? `&cityId=${encodeURIComponent(selectedCityId)}` : '';
      const res = await fetch(`/api/alerts?range=${range}${cityParam}`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.summary) {
        setSummary(data.summary);
        setTimeSeries(data.timeseries);
        setCityAlerts(data.cities);
        if (data.cityTimeseries) setCityTimeSeries(data.cityTimeseries);
      }
    } catch (err) {
      console.error("Refresh failed:", err);
      // Fallback: regular GET with refresh=true
      await fetchData(range, true);
      if (selectedCityId) await fetchCityTimeSeries(selectedCityId, range);
    }
    setRefreshing(false);
  }, [range, selectedCityId, fetchData, fetchCityTimeSeries]);

  useEffect(() => {
    fetchData(range);
  }, [range, fetchData]);

  useEffect(() => {
    fetchHourlyAverages();
  }, [fetchHourlyAverages]);

  // Refetch city timeseries when selected city or range changes
  // First refresh city data from oref if stale (>15 min)
  useEffect(() => {
    if (!selectedCityId) return;
    const doFetch = async () => {
      await fetch(withDevice(`/api/alerts?action=refresh-city&cityId=${encodeURIComponent(selectedCityId)}`));
      await fetchData(range);
      fetchCityTimeSeries(selectedCityId, range);
    };
    doFetch();
  }, [selectedCityId, range, fetchCityTimeSeries, fetchData]);

  const handleRangeChange = (newRange: TimeRange) => {
    setRange(newRange);
  };

  const handleCityClick = (cityId: string) => {
    setSelectedCityId((prev) => {
      const next = prev === cityId ? null : cityId;
      if (typeof window !== "undefined") {
        if (next) localStorage.setItem("selected_city", next);
        else localStorage.removeItem("selected_city");
      }
      return next;
    });
  };

  const handleClearCityFilter = () => {
    setSelectedCityId(null);
    setCityTimeSeries([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("selected_city");
    }
  };

  const handleCityComboChange = (cityId: string) => {
    if (cityId === "") {
      handleClearCityFilter();
    } else {
      setSelectedCityId(cityId);
      if (typeof window !== "undefined") {
        localStorage.setItem("selected_city", cityId);
      }
    }
  };

  // Get display name for the selected city
  const selectedCityName = selectedCityId
    ? (() => {
        const city = cities.find((c) => c.id === selectedCityId);
        return city ? (locale === "he" ? city.he : city.en) : selectedCityId;
      })()
    : null;

  const chartTitle = selectedCityName
    ? `${t.chartDrillDown}${selectedCityName}`
    : undefined;

  const tabs: { key: Tab; label: string }[] = [
    { key: "dashboard", label: t.tabs.dashboard },
    { key: "map", label: t.tabs.map },
    { key: "prediction", label: t.tabs.prediction },
    { key: "ai", label: t.tabs.ai },
    { key: "ai2", label: t.tabs.ai2 },
  ];

  // Sort cities for combo box by locale
  const sortedCities = [...cities].sort((a, b) => {
    const nameA = locale === "he" ? a.he : a.en;
    const nameB = locale === "he" ? b.he : b.en;
    return nameA.localeCompare(nameB, locale);
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              <span className={refreshing ? "animate-spin" : ""}>↻</span>
              {refreshing ? t.refreshing : t.refreshData}
            </button>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-6xl gap-0 px-4">
          {tabs.map((tabItem) => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key)}
              className={`border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
                tab === tabItem.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Time range selector + city combo (shown on dashboard and map tabs) */}
        {tab !== "prediction" && tab !== "ai" && tab !== "ai2" && (
          <div className="relative z-10 mb-6 flex flex-wrap items-center gap-4">
            <TimeRangeSelector selected={range} onChange={handleRangeChange} />
            {tab === "dashboard" && (
              <div className="flex items-center gap-1">
                <select
                  value={selectedCityId || ""}
                  onChange={(e) => handleCityComboChange(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                >
                  <option value="">{t.allCities}</option>
                  {sortedCities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {locale === "he" ? city.he : city.en}
                    </option>
                  ))}
                </select>
                {gpsCityId && (
                  <button
                    onClick={() => handleCityComboChange(gpsCityId)}
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
            )}
          </div>
        )}

        {/* Dashboard tab */}
        {tab === "dashboard" && (
          <div className="space-y-6">
            <AlertsSummaryCards summary={
              selectedCityId && cityAlerts.length > 0
                ? (() => {
                    const ca = cityAlerts.find((c) => c.cityId === selectedCityId);
                    return ca
                      ? { timeRange: range, missileCount: ca.missileCount, warningCount: ca.warningCount, totalCount: ca.totalCount }
                      : summary;
                  })()
                : summary
            } loading={loading} />
            <AlertsChart
              data={selectedCityId ? cityTimeSeries : timeSeries}
              loading={selectedCityId ? cityTsLoading : loading}
              title={chartTitle}
              onClearFilter={selectedCityId ? handleClearCityFilter : undefined}
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <TopCities
                cityAlerts={cityAlerts}
                mode="top"
                selectedCityId={selectedCityId}
                onCityClick={handleCityClick}
              />
              <TopCities
                cityAlerts={cityAlerts}
                mode="bottom"
                selectedCityId={selectedCityId}
                onCityClick={handleCityClick}
              />
            </div>
          </div>
        )}

        {/* Map tab */}
        {tab === "map" && (
          <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
            <IsraelMap cityAlerts={cityAlerts} loading={loading} stretch />
            <div className="space-y-6">
              <TopCities cityAlerts={cityAlerts} mode="top" />
              <TopCities cityAlerts={cityAlerts} mode="bottom" />
            </div>
          </div>
        )}

        {/* Prediction tab */}
        {tab === "prediction" && (
          <PredictionView
            hourlyAverages={hourlyAverages}
            loading={loading}
            gpsCityId={gpsCityId}
            selectedCityId={selectedCityId || ""}
            onCityChange={handleCityComboChange}
          />
        )}

        {/* AI Prediction tab */}
        {tab === "ai" && (
          <AIPredictionView
            gpsCityId={gpsCityId}
            selectedCityId={selectedCityId || ""}
            onCityChange={handleCityComboChange}
          />
        )}

        {/* AI2 Neural Network tab */}
        {tab === "ai2" && (
          <AI2PredictionView
            gpsCityId={gpsCityId}
            selectedCityId={selectedCityId || ""}
            onCityChange={handleCityComboChange}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-900">
        Alerts Analyzer — Data from oref.org.il | Version v{process.env.NEXT_PUBLIC_BUILD_VERSION}
      </footer>
    </div>
  );
}
