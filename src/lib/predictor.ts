import { Alert, HourlyAverage, Prediction } from "@/types/alerts";

/**
 * Compute hourly averages from the last 14 days of alerts.
 * Optionally filter to a specific city.
 */
export function computeHourlyAverages(alerts: Alert[], cityId?: string): HourlyAverage[] {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  let recent = alerts.filter((a) => new Date(a.timestamp) >= cutoff);
  if (cityId) {
    recent = recent.filter((a) => a.cityId === cityId);
  }

  const hourBuckets: { warnings: number; missiles: number }[] = Array.from(
    { length: 24 },
    () => ({ warnings: 0, missiles: 0 })
  );

  for (const alert of recent) {
    const hour = new Date(alert.timestamp).getHours();
    if (alert.type === "warning") hourBuckets[hour].warnings++;
    else hourBuckets[hour].missiles++;
  }

  const daysInRange = 14;
  return hourBuckets.map((bucket, hour) => ({
    hour,
    avgWarnings: Math.round((bucket.warnings / daysInRange) * 10) / 10,
    avgMissiles: Math.round((bucket.missiles / daysInRange) * 10) / 10,
  }));
}

/**
 * Forecast lines for a line chart: 24 data points (one per hour), each with:
 *  - avgAllDays: missile average at that hour across ALL days in the last 2 weeks
 *  - avgSameDay: missile average at that hour across only the SAME day-of-week in the last 2 weeks
 */
export interface ForecastLinePoint {
  hour: number;
  avgAllDays: number;
  avgSameDay: number;
  stdDev: number;
  upperBound: number;
  lowerBound: number;
  pctAllDays: number;
  pctSameDay: number;
}

export function computeForecastLines(
  alerts: Alert[],
  targetDayOfWeek: number,
  cityId?: string
): ForecastLinePoint[] {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  let recent = alerts.filter((a) => new Date(a.timestamp) >= cutoff && a.type === "missile");
  if (cityId) {
    recent = recent.filter((a) => a.cityId === cityId);
  }

  // Count missiles per hour — all days
  const allDaysBuckets = Array.from({ length: 24 }, () => 0);
  // Count missiles per hour — same day-of-week only
  const sameDayBuckets = Array.from({ length: 24 }, () => 0);

  // Per-day-per-hour counts for standard deviation
  // dailyHourCounts[hour][dayIndex] = count of missiles at that hour on that day
  const dailyHourCounts: number[][] = Array.from({ length: 24 }, () => []);

  // Track days with at least one missile per hour (for percentage)
  const allDaysHit: number[] = Array.from({ length: 24 }, () => 0);
  const sameDayHit: number[] = Array.from({ length: 24 }, () => 0);

  // Count how many distinct dates fall on the target day-of-week in the last 14 days
  const totalDays = 14;
  let sameDayCount = 0;
  const now = new Date();

  // Build a map of dateKey -> dayIndex
  const dateKeys: string[] = [];
  for (let d = 0; d < 14; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    if (date.getDay() === targetDayOfWeek) sameDayCount++;
    const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
    dateKeys.push(key);
  }
  if (sameDayCount === 0) sameDayCount = 1; // safety

  // Initialize per-day-per-hour counts to 0
  for (let hour = 0; hour < 24; hour++) {
    dailyHourCounts[hour] = new Array(totalDays).fill(0);
  }

  for (const alert of recent) {
    const ts = new Date(alert.timestamp);
    const hour = ts.getHours();
    allDaysBuckets[hour]++;
    if (ts.getDay() === targetDayOfWeek) {
      sameDayBuckets[hour]++;
    }
    // Find which day index this alert belongs to
    const alertKey = `${ts.getFullYear()}-${(ts.getMonth() + 1).toString().padStart(2, "0")}-${ts.getDate().toString().padStart(2, "0")}`;
    const dayIdx = dateKeys.indexOf(alertKey);
    if (dayIdx >= 0) {
      dailyHourCounts[hour][dayIdx]++;
    }
  }

  return Array.from({ length: 24 }, (_, hour) => {
    const avg = allDaysBuckets[hour] / totalDays;
    // Compute standard deviation across the 14 days for this hour
    const counts = dailyHourCounts[hour];
    const variance = counts.reduce((sum, c) => sum + (c - avg) * (c - avg), 0) / totalDays;
    const sd = Math.sqrt(variance);
    const roundedAvg = Math.round(avg * 10) / 10;
    const roundedSd = Math.round(sd * 10) / 10;

    // Percentage: how many days had at least 1 missile at this hour
    const daysWithMissile = counts.filter((c) => c > 0).length;
    const pctAll = Math.round((daysWithMissile / totalDays) * 100);

    // Same-day percentage: count same-DOW days with missiles at this hour
    // We need to check dailyHourCounts for same-DOW day indices
    let sameDayHitCount = 0;
    for (let d = 0; d < totalDays; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      if (date.getDay() === targetDayOfWeek && counts[d] > 0) {
        sameDayHitCount++;
      }
    }
    const pctSame = Math.round((sameDayHitCount / sameDayCount) * 100);

    return {
      hour,
      avgAllDays: roundedAvg,
      avgSameDay: Math.round((sameDayBuckets[hour] / sameDayCount) * 10) / 10,
      stdDev: roundedSd,
      upperBound: Math.round((avg + sd) * 10) / 10,
      lowerBound: Math.max(0, Math.round((avg - sd) * 10) / 10),
      pctAllDays: pctAll,
      pctSameDay: pctSame,
    };
  });
}

/**
 * Predict alerts for a given future date/time window (1 hour) based on weekly averages.
 * Optionally filter to a specific city.
 */
export function predict(alerts: Alert[], futureDateTime: string, cityId?: string): Prediction {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  let recent = alerts.filter((a) => new Date(a.timestamp) >= cutoff);
  if (cityId) {
    recent = recent.filter((a) => a.cityId === cityId);
  }

  const targetDate = new Date(futureDateTime);
  const hour = targetDate.getHours();
  const totalDays = 14;

  // Count days with at least one warning/missile at this hour
  let daysWithWarning = 0;
  let daysWithMissile = 0;
  const now = new Date();
  for (let d = 0; d < totalDays; d++) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - d);
    dayStart.setHours(hour, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(hour + 1, 0, 0, 0);

    const inHour = recent.filter((a) => {
      const t = new Date(a.timestamp).getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime();
    });
    if (inHour.some((a) => a.type === "warning")) daysWithWarning++;
    if (inHour.some((a) => a.type === "missile")) daysWithMissile++;
  }

  const averages = computeHourlyAverages(alerts, cityId);
  const avg = averages[hour];

  return {
    dateTime: futureDateTime,
    estimatedWarnings: avg.avgWarnings,
    estimatedMissiles: avg.avgMissiles,
    pctWarnings: Math.round((daysWithWarning / totalDays) * 100),
    pctMissiles: Math.round((daysWithMissile / totalDays) * 100),
  };
}

export interface DailySameTimePoint {
  date: string;
  dayLabel: string;
  warnings: number;
  missiles: number;
}

/**
 * For a given hour, show the actual alert count at that same hour for each of the last 7 days.
 * Optionally filter to a specific city.
 */
export function dailySameTime(alerts: Alert[], hour: number, cityId?: string): DailySameTimePoint[] {
  const points: DailySameTimePoint[] = [];
  const now = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - daysAgo);
    dayStart.setHours(hour, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(hour + 1, 0, 0, 0);

    let filtered = alerts.filter((a) => {
      const t = new Date(a.timestamp).getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime();
    });
    if (cityId) {
      filtered = filtered.filter((a) => a.cityId === cityId);
    }

    const dayName = days[dayStart.getDay()];
    const dateStr = `${(dayStart.getMonth() + 1).toString().padStart(2, "0")}/${dayStart.getDate().toString().padStart(2, "0")}`;

    points.push({
      date: dayStart.toISOString(),
      dayLabel: `${dayName} ${dateStr}`,
      warnings: filtered.filter((a) => a.type === "warning").length,
      missiles: filtered.filter((a) => a.type === "missile").length,
    });
  }

  return points;
}
