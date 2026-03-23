import { Alert, City } from "@/types/alerts";
import cities from "@/data/cities.json";

/** Haversine distance in km between two lat/lng points */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Find cities within `radiusKm` of the given city (excluding itself) */
export function findNearbyCities(cityId: string, radiusKm: number = 10): City[] {
  const target = (cities as City[]).find((c) => c.id === cityId);
  if (!target) return [];
  return (cities as City[]).filter(
    (c) => c.id !== cityId && haversineKm(target.lat, target.lng, c.lat, c.lng) <= radiusKm
  );
}

export interface HourlyRisk {
  /** Hour offset from now: 0 = current hour, 1 = next hour, etc. */
  hourOffset: number;
  /** Absolute hour (0-23) */
  hour: number;
  /** Display label, e.g. "14:00" */
  label: string;
  /** Risk level 0-100 */
  riskPct: number;
  /** Risk category */
  riskLevel: "low" | "medium" | "high" | "critical";
  /** Average missiles at this hour for the target city */
  avgMissiles: number;
  /** Average missiles at this hour across nearby cities */
  nearbyAvgMissiles: number;
  /** Count of nearby cities that had attacks at this hour */
  nearbyCitiesHit: number;
  /** Days with attacks at this hour (out of daysAnalyzed) */
  daysWithAttacks: number;
  /** Total days analyzed */
  daysAnalyzed: number;
}

export interface AIPrediction {
  cityId: string;
  nearbyCityIds: string[];
  generatedAt: string;
  next24h: HourlyRisk[];
  overallRisk: number;
  overallLevel: "low" | "medium" | "high" | "critical";
  peakHour: number;
  peakRisk: number;
  totalCityAttacks30d: number;
  totalNearbyAttacks30d: number;
}

function riskLevel(pct: number): "low" | "medium" | "high" | "critical" {
  if (pct >= 75) return "critical";
  if (pct >= 50) return "high";
  if (pct >= 25) return "medium";
  return "low";
}

/**
 * Build AI-based missile attack predictions for the next 24 hours.
 * Uses the last 30 days of attack data for the target city and nearby cities (≤25km).
 *
 * Scoring factors:
 *  1. Historical frequency at this hour-of-day for the target city (weight 40%)
 *  2. Day-of-week pattern matching (weight 15%)
 *  3. Recency: more recent attacks contribute more (weight 15%)
 *  4. Nearby cities activity at this hour (weight 20%)
 *  5. Trend: is attack frequency increasing or decreasing? (weight 10%)
 */
export function computeAIPrediction(alerts: Alert[], cityId: string): AIPrediction {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
  const currentHour = now.getHours();
  const currentDow = now.getDay();

  const nearbyCities = findNearbyCities(cityId, 10);
  const nearbyCityIds = nearbyCities.map((c) => c.id);
  const nearbySet = new Set(nearbyCityIds);

  // Filter to last 30 days, missiles only
  const cityMissiles = alerts.filter(
    (a) => a.cityId === cityId && a.type === "missile" && new Date(a.timestamp) >= thirtyDaysAgo
  );
  const nearbyMissiles = alerts.filter(
    (a) => nearbySet.has(a.cityId) && a.type === "missile" && new Date(a.timestamp) >= thirtyDaysAgo
  );

  const daysAnalyzed = 30;

  // Build per-hour stats for target city
  const cityHourCounts = Array.from({ length: 24 }, () => ({ total: 0, daysHit: new Set<string>() }));
  const cityDowHourCounts = Array.from({ length: 24 }, () => ({ total: 0, daysHit: new Set<string>() }));
  // Recency: first half (days 16-30 ago) vs second half (last 15 days)
  const cityHourRecent = Array.from({ length: 24 }, () => 0);
  const cityHourOld = Array.from({ length: 24 }, () => 0);

  for (const a of cityMissiles) {
    const ts = new Date(a.timestamp);
    const h = ts.getHours();
    const dateKey = ts.toISOString().slice(0, 10);
    cityHourCounts[h].total++;
    cityHourCounts[h].daysHit.add(dateKey);
    if (ts.getDay() === currentDow) {
      cityDowHourCounts[h].total++;
      cityDowHourCounts[h].daysHit.add(dateKey);
    }
    if (ts >= fifteenDaysAgo) {
      cityHourRecent[h]++;
    } else {
      cityHourOld[h]++;
    }
  }

  // Build per-hour stats for nearby cities
  const nearbyHourCounts = Array.from({ length: 24 }, () => ({
    total: 0,
    citiesHit: new Set<string>(),
  }));
  for (const a of nearbyMissiles) {
    const ts = new Date(a.timestamp);
    const h = ts.getHours();
    nearbyHourCounts[h].total++;
    nearbyHourCounts[h].citiesHit.add(a.cityId);
  }

  // Count same-DOW days in the 30-day window
  let sameDowCount = 0;
  for (let d = 0; d < daysAnalyzed; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    if (date.getDay() === currentDow) sameDowCount++;
  }
  if (sameDowCount === 0) sameDowCount = 1;

  // Generate hourly predictions for next 24 hours
  const next24h: HourlyRisk[] = [];

  for (let offset = 0; offset < 24; offset++) {
    const targetHour = (currentHour + offset) % 24;

    // Factor 1: Historical frequency (40%)
    const freqRate = cityHourCounts[targetHour].daysHit.size / daysAnalyzed;
    const freqScore = Math.min(freqRate * 100, 100) * 0.4;

    // Factor 2: Day-of-week pattern (15%)
    // For offsets that cross midnight, adjust DOW
    const futureDate = new Date(now.getTime() + offset * 60 * 60 * 1000);
    const futureDow = futureDate.getDay();
    let dowRate: number;
    if (futureDow === currentDow) {
      dowRate = cityDowHourCounts[targetHour].daysHit.size / sameDowCount;
    } else {
      // Count same-DOW days for the future DOW
      let futureDowCount = 0;
      for (let d = 0; d < daysAnalyzed; d++) {
        const date = new Date(now);
        date.setDate(date.getDate() - d);
        if (date.getDay() === futureDow) futureDowCount++;
      }
      if (futureDowCount === 0) futureDowCount = 1;
      // Count attacks on that DOW at this hour
      let futureDowAttacks = 0;
      for (const a of cityMissiles) {
        const ts = new Date(a.timestamp);
        if (ts.getDay() === futureDow && ts.getHours() === targetHour) futureDowAttacks++;
      }
      dowRate = futureDowAttacks > 0 ? 1 : 0;
    }
    const dowScore = Math.min(dowRate * 100, 100) * 0.15;

    // Factor 3: Recency trend (15%)
    const recentCount = cityHourRecent[targetHour];
    const oldCount = cityHourOld[targetHour];
    let recencyScore: number;
    if (recentCount + oldCount === 0) {
      recencyScore = 0;
    } else {
      // More recent attacks → higher score
      const recencyRatio = recentCount / (recentCount + oldCount);
      recencyScore = recencyRatio * 100 * 0.15;
    }

    // Factor 4: Nearby cities (20%)
    const nearbyRate = nearbyHourCounts[targetHour].citiesHit.size / Math.max(nearbyCityIds.length, 1);
    const nearbyScore = Math.min(nearbyRate * 100, 100) * 0.2;

    // Factor 5: Trend — is the attack frequency increasing? (10%)
    const totalRecent = cityHourRecent.reduce((s, c) => s + c, 0);
    const totalOld = cityHourOld.reduce((s, c) => s + c, 0);
    let trendScore: number;
    if (totalRecent + totalOld === 0) {
      trendScore = 0;
    } else {
      const trendRatio = totalRecent / (totalRecent + totalOld);
      trendScore = trendRatio * 100 * 0.1;
    }

    const rawRisk = freqScore + dowScore + recencyScore + nearbyScore + trendScore;
    const riskPct = Math.round(Math.min(rawRisk, 100));

    const avgMissiles = Math.round((cityHourCounts[targetHour].total / daysAnalyzed) * 10) / 10;
    const nearbyAvgMissiles =
      Math.round((nearbyHourCounts[targetHour].total / daysAnalyzed) * 10) / 10;

    next24h.push({
      hourOffset: offset,
      hour: targetHour,
      label: `${targetHour.toString().padStart(2, "0")}:00`,
      riskPct,
      riskLevel: riskLevel(riskPct),
      avgMissiles,
      nearbyAvgMissiles,
      nearbyCitiesHit: nearbyHourCounts[targetHour].citiesHit.size,
      daysWithAttacks: cityHourCounts[targetHour].daysHit.size,
      daysAnalyzed,
    });
  }

  const overallRisk = Math.round(next24h.reduce((s, h) => s + h.riskPct, 0) / 24);
  const peak = next24h.reduce((max, h) => (h.riskPct > max.riskPct ? h : max), next24h[0]);

  return {
    cityId,
    nearbyCityIds,
    generatedAt: now.toISOString(),
    next24h,
    overallRisk,
    overallLevel: riskLevel(overallRisk),
    peakHour: peak.hour,
    peakRisk: peak.riskPct,
    totalCityAttacks30d: cityMissiles.length,
    totalNearbyAttacks30d: nearbyMissiles.length,
  };
}
