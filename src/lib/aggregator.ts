import { Alert, AlertsSummary, CityAlertCount, TimeRange } from "@/types/alerts";

const RANGE_HOURS: Record<TimeRange, number> = {
  "6h": 6,
  "12h": 12,
  "24h": 24,
  "2d": 48,
  "7d": 168,
  "14d": 336,
};

export function filterByTimeRange(alerts: Alert[], range: TimeRange): Alert[] {
  const hours = RANGE_HOURS[range];
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  return alerts.filter((a) => new Date(a.timestamp) >= cutoff);
}

export function summarize(alerts: Alert[], range: TimeRange): AlertsSummary {
  const filtered = filterByTimeRange(alerts, range);
  const warningCount = filtered.filter((a) => a.type === "warning").length;
  const missileCount = filtered.filter((a) => a.type === "missile").length;
  return {
    timeRange: range,
    warningCount,
    missileCount,
    totalCount: warningCount + missileCount,
  };
}

export function countByCity(alerts: Alert[]): CityAlertCount[] {
  const map = new Map<string, CityAlertCount>();
  for (const alert of alerts) {
    let entry = map.get(alert.cityId);
    if (!entry) {
      entry = { cityId: alert.cityId, warningCount: 0, missileCount: 0, totalCount: 0 };
      map.set(alert.cityId, entry);
    }
    if (alert.type === "warning") entry.warningCount++;
    else entry.missileCount++;
    entry.totalCount++;
  }
  return Array.from(map.values()).sort((a, b) => b.totalCount - a.totalCount);
}

export interface TimeSeriesPoint {
  label: string;
  warnings: number;
  missiles: number;
}

export function buildTimeSeries(alerts: Alert[], range: TimeRange, cityId?: string): TimeSeriesPoint[] {
  const hours = RANGE_HOURS[range];
  const now = Date.now();
  let filtered = filterByTimeRange(alerts, range);
  if (cityId) {
    filtered = filtered.filter((a) => a.cityId === cityId);
  }

  // Determine bucket size
  let bucketMs: number;
  let bucketCount: number;
  let formatLabel: (date: Date) => string;

  if (hours <= 24) {
    // Hourly buckets — align to hour boundaries so current hour is included
    bucketMs = 60 * 60 * 1000;
    bucketCount = hours + 1; // +1 to include the current partial hour
    formatLabel = (d) =>
      `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:00`;
  } else if (hours <= 168) {
    // 6-hour buckets
    bucketMs = 6 * 60 * 60 * 1000;
    bucketCount = Math.ceil(hours / 6);
    formatLabel = (d) =>
      `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:00`;
  } else {
    // Daily buckets
    bucketMs = 24 * 60 * 60 * 1000;
    bucketCount = Math.ceil(hours / 24);
    formatLabel = (d) =>
      `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
  }

  // Align to hour/period boundaries so labels match actual hours
  const nowDate = new Date(now);
  const alignedEnd = hours <= 24
    ? new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), nowDate.getHours() + 1, 0, 0, 0).getTime()
    : hours <= 168
      ? (() => { const d = new Date(nowDate); d.setMinutes(0,0,0); d.setHours(d.getHours() + 6 - (d.getHours() % 6)); return d.getTime(); })()
      : new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + 1, 0, 0, 0, 0).getTime();

  const buckets: TimeSeriesPoint[] = [];
  for (let i = bucketCount - 1; i >= 0; i--) {
    const bucketStart = alignedEnd - (i + 1) * bucketMs;
    const bucketEnd = alignedEnd - i * bucketMs;
    const inBucket = filtered.filter((a) => {
      const t = new Date(a.timestamp).getTime();
      return t >= bucketStart && t < bucketEnd;
    });
    buckets.push({
      label: formatLabel(new Date(bucketStart)),
      warnings: inBucket.filter((a) => a.type === "warning").length,
      missiles: inBucket.filter((a) => a.type === "missile").length,
    });
  }

  return buckets;
}
