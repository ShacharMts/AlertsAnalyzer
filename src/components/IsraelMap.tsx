"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { CityAlertCount } from "@/types/alerts";
import cities from "@/data/cities.json";

interface Props {
  cityAlerts: CityAlertCount[];
  loading: boolean;
  stretch?: boolean;
}

// Missile count color ranges per spec
const MISSILE_COLORS: { min: number; max: number; color: string; label: string }[] = [
  { min: 0, max: 10, color: "#22c55e", label: "0–10" },
  { min: 11, max: 20, color: "#84cc16", label: "11–20" },
  { min: 21, max: 40, color: "#eab308", label: "21–40" },
  { min: 41, max: 70, color: "#f59e0b", label: "41–70" },
  { min: 71, max: 100, color: "#fdba74", label: "71–100" },
  { min: 101, max: 150, color: "#ef4444", label: "101–150" },
  { min: 151, max: 200, color: "#dc2626", label: "151–200" },
  { min: 201, max: 300, color: "#b91c1c", label: "201–300" },
  { min: 301, max: Infinity, color: "#7f1d1d", label: "301+" },
];

function getMissileColor(missileCount: number): string {
  for (const range of MISSILE_COLORS) {
    if (missileCount >= range.min && missileCount <= range.max) return range.color;
  }
  return MISSILE_COLORS[MISSILE_COLORS.length - 1].color;
}

function getMarkerRadius(missileCount: number): number {
  if (missileCount <= 10) return 8;
  if (missileCount <= 40) return 10;
  if (missileCount <= 100) return 12;
  if (missileCount <= 200) return 14;
  return 16;
}

function isMobile(): boolean {
  return typeof window !== "undefined" && window.innerWidth < 768;
}

function LeafletMap({ cityAlerts, locale, alertsLabel, stretch }: {
  cityAlerts: CityAlertCount[];
  locale: string;
  alertsLabel: string;
  stretch?: boolean;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize the map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      try {
        const L = await import("leaflet");
        leafletRef.current = L;

        const container = mapRef.current;
        if (!container) return;

        const map = L.map(container, {
          center: [31.5, 34.85],
          zoom: 8,
          scrollWheelZoom: true,
          zoomControl: true,
        });
        mapInstanceRef.current = map;

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 18,
        }).addTo(map);

        setTimeout(() => map.invalidateSize(), 100);
      } catch (e) {
        setError(String(e));
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      leafletRef.current = null;
    };
  }, []);

  // Update markers when data, locale, or alertsLabel changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) {
      // Map not ready yet — retry after a short delay
      const timer = setTimeout(() => {
        const m = mapInstanceRef.current;
        const l = leafletRef.current;
        if (m && l) updateMarkers(m, l);
      }, 300);
      return () => clearTimeout(timer);
    }
    updateMarkers(map, L);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function updateMarkers(map: any, L: any) {
      // Remove existing markers
      for (const m of markersRef.current) {
        map.removeLayer(m);
      }
      markersRef.current = [];

      const alertMap = new Map(cityAlerts.map((c) => [c.cityId, c]));

      cities.forEach((city) => {
        const alerts = alertMap.get(city.id);
        const missileCount = alerts?.missileCount ?? 0;
        const warningCount = alerts?.warningCount ?? 0;
        const totalCount = alerts?.totalCount ?? 0;
        const color = getMissileColor(missileCount);
        const radius = getMarkerRadius(missileCount);
        const name = locale === "he" ? city.he : city.en;

        const circle = L.circleMarker([city.lat, city.lng], {
          radius,
          fillColor: color,
          color: "white",
          weight: 2,
          fillOpacity: 0.85,
        }).addTo(map);

        circle.bindPopup(
          `<div style="text-align:center;font-family:sans-serif">
            <strong style="font-size:14px">${name}</strong><br/>
            <span style="color:#ef4444">🚀 ${missileCount}</span> &nbsp;
            <span style="color:#fdba74">⚠️ ${warningCount}</span><br/>
            <span style="font-size:12px;color:#666">${totalCount} ${alertsLabel}</span>
          </div>`
        );

        const mobile = isMobile();
        circle.bindTooltip(name, {
          permanent: !mobile,
          direction: "right",
          offset: [radius + 2, 0],
          className: "city-label",
        });

        markersRef.current.push(circle);
      });
    }
  }, [cityAlerts, locale, alertsLabel]);

  if (error) {
    return <div className="p-4 text-red-500">Map error: {error}</div>;
  }

  return <div ref={mapRef} id="leaflet-map" className="w-full rounded-xl" style={{ height: stretch ? undefined : "50vh", flex: stretch ? 1 : undefined, minHeight: "400px", zIndex: 0 }} />;
}

export default function IsraelMap({ cityAlerts, loading, stretch }: Props) {
  const { t, locale } = useI18n();

  if (loading) {
    return (
      <div className="animate-pulse rounded-xl bg-gray-100 p-6 dark:bg-gray-800">
        <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-4 rounded bg-gray-200 dark:bg-gray-700" style={{ height: "50vh" }} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900" style={{ position: "relative", zIndex: 0, overflow: "hidden", ...(stretch ? { display: "flex", flexDirection: "column" as const, height: "100%" } : {}) }}>
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {t.map.title}
      </h3>
      <LeafletMap cityAlerts={cityAlerts} locale={locale} alertsLabel={t.map.alerts} stretch={stretch} />
      {/* Color legend */}
      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        {MISSILE_COLORS.map((range) => (
          <div key={range.label} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: range.color }}
            />
            {range.label}
          </div>
        ))}
      </div>
    </div>
  );
}
