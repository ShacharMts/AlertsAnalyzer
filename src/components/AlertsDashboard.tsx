"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import DebugPanel from "./DebugPanel";
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
  const [debugMode, setDebugMode] = useState(false);

  // Sync tab from URL on mount (avoids hydration mismatch)
  useEffect(() => {
    const path = window.location.pathname;
    if (PATH_TO_TAB[path] && PATH_TO_TAB[path] !== tab) {
      setTabState(PATH_TO_TAB[path]);
    }
    // Detect ?debug in URL
    if (window.location.search.includes("debug")) {
      setDebugMode(true);
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
    const debugParam = debugMode ? "?debug" : "";
    window.history.pushState(null, "", `${newPath}${debugParam}`);
  }, [debugMode]);

  // Swipe gesture support for mobile tab navigation
  const TAB_ORDER: Tab[] = ["dashboard", "map", "prediction", "ai", "ai2"];
  const touchRef = useRef<{ startX: number; startY: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = { startX: touch.clientX, startY: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchRef.current.startX;
    const dy = touch.clientY - touchRef.current.startY;
    touchRef.current = null;

    // Only trigger if horizontal swipe is dominant and long enough
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;

    setTabState((prev) => {
      const idx = TAB_ORDER.indexOf(prev);
      let next: Tab;
      if (dx < 0) {
        // Swipe left → next tab
        next = TAB_ORDER[Math.min(idx + 1, TAB_ORDER.length - 1)];
      } else {
        // Swipe right → previous tab
        next = TAB_ORDER[Math.max(idx - 1, 0)];
      }
      if (next !== prev) {
        const debugParam = debugMode ? "?debug" : "";
        window.history.pushState(null, "", `${TAB_TO_PATH[next]}${debugParam}`);
      }
      return next;
    });
  }, [debugMode]);

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      if (PATH_TO_TAB[path]) setTabState(PATH_TO_TAB[path]);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const [range, setRange] = useState<TimeRange>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("selected_range");
      if (saved && ["6h", "12h", "24h", "2d", "7d", "14d"].includes(saved)) return saved as TimeRange;
    }
    return "24h";
  });
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
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);

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
    setRefreshStatus(null);

    // Build the oref URL to call directly from the browser
    const citiesModule = await import("@/data/cities.json");
    const city = selectedCityId
      ? citiesModule.default.find((c: { id: string }) => c.id === selectedCityId)
      : null;
    const orefUrl = city
      ? `https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx?lang=he&mode=3&city_0=${encodeURIComponent(city.he)}`
      : `https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx?lang=he&mode=0`;

    let clientData: unknown[] | null = null;
    let fetchedFromBrowser = false;

    // Try fetching oref directly from the browser (works from Israeli IPs)
    try {
      const orefRes = await fetch(orefUrl, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (orefRes.ok) {
        clientData = await orefRes.json();
        fetchedFromBrowser = true;
      }
    } catch {
      // CORS or network error — will fall back to server
    }

    try {
      const cityParam = selectedCityId ? `&cityId=${encodeURIComponent(selectedCityId)}` : '';
      let res;
      if (fetchedFromBrowser && clientData && clientData.length > 0) {
        // Send browser-fetched data to server for merging + processing
        res = await fetch(`/api/alerts?range=${range}${cityParam}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orefData: clientData, source: "browser", orefUrl }),
        });
      } else {
        // Fallback: let server fetch from oref
        res = await fetch(`/api/alerts?range=${range}${cityParam}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "server" }),
        });
      }
      const data = await res.json();

      if (data.summary) {
        setSummary(data.summary);
        setTimeSeries(data.timeseries);
        setCityAlerts(data.cities);
        if (data.cityTimeseries) setCityTimeSeries(data.cityTimeseries);
      }
      if (data.refreshMeta) {
        const m = data.refreshMeta;
        if (m.source === 'browser') {
          setRefreshStatus(`\u2713 Browser \u2192 oref.org.il \u2192 ${m.freshRecords} records`);
        } else if (m.source === 'bundled-cache') {
          setRefreshStatus(`\u2713 Bundled cache (${m.cachedRecords} records)`);
        } else if (m.orefCalled && m.freshRecords > 0) {
          setRefreshStatus(`\u2713 Server \u2192 oref.org.il \u2192 ${m.freshRecords} records`);
        } else if (m.orefCalled) {
          setRefreshStatus(`\u2713 Served from cache (${m.totalRecords} records)`);
        } else {
          setRefreshStatus(`✓ Served from cache (${m.totalRecords} records)`);
        }
      }
    } catch (err) {
      console.error("Refresh failed:", err);
      setRefreshStatus("✗ Refresh failed");
      await fetchData(range, true);
      if (selectedCityId) await fetchCityTimeSeries(selectedCityId, range);
    }
    setRefreshing(false);
    setTimeout(() => setRefreshStatus(null), 5000);
  }, [range, selectedCityId, fetchData, fetchCityTimeSeries]);

  useEffect(() => {
    fetchData(range);
  }, [range, fetchData]);

  useEffect(() => {
    fetchHourlyAverages();
  }, [fetchHourlyAverages]);

  // Refetch city timeseries when selected city or range changes
  useEffect(() => {
    if (!selectedCityId) return;
    fetchCityTimeSeries(selectedCityId, range);
  }, [selectedCityId, range, fetchCityTimeSeries]);

  const handleRangeChange = (newRange: TimeRange) => {
    setRange(newRange);
    localStorage.setItem("selected_range", newRange);
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
        {debugMode && refreshStatus && (
          <div className="bg-green-50 dark:bg-green-900/30 border-t border-green-200 dark:border-green-800 px-4 py-2 text-center">
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              {refreshStatus}
            </span>
          </div>
        )}
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
      <main className="mx-auto max-w-6xl px-4 py-6" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
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
                      : { timeRange: range, missileCount: 0, warningCount: 0, totalCount: 0 };
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
        MTS Alerts Analyzer — Data from oref.org.il | Version v{process.env.NEXT_PUBLIC_BUILD_VERSION}
      </footer>

      {/* Debug panel */}
      {debugMode && (
        <div className="mx-auto max-w-6xl px-4 pb-6">
          <DebugPanel />
        </div>
      )}
    </div>
  );
}
