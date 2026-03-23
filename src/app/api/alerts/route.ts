import { NextResponse } from "next/server";
import { getAlerts, refreshCityAlerts, getLastRefreshMeta, ingestAndGetAlerts } from "@/lib/orefClient";
import type { OrefAlert } from "@/lib/orefClient";
import { summarize, countByCity, buildTimeSeries, filterByTimeRange } from "@/lib/aggregator";
import { computeHourlyAverages, predict, dailySameTime, computeForecastLines } from "@/lib/predictor";
import { computeAIPrediction } from "@/lib/aiPredictor";
import { computeAI2Prediction } from "@/lib/aiModel";
import { TimeRange } from "@/types/alerts";

const VALID_RANGES: TimeRange[] = ["6h", "12h", "24h", "2d", "7d", "14d"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = (searchParams.get("range") || "24h") as TimeRange;
  const action = searchParams.get("action") || "summary";
  const cityId = searchParams.get("cityId") || undefined;

  if (!VALID_RANGES.includes(range)) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const forceRefresh = searchParams.get("refresh") === "true";

  if (action === "refresh") {
    const alerts = await getAlerts(15, true);
    return NextResponse.json({ ok: true, count: alerts.length });
  }

  if (action === "refresh-city") {
    if (!cityId) {
      return NextResponse.json({ error: "cityId required" }, { status: 400 });
    }
    const force = searchParams.get("force") === "true";
    const result = await refreshCityAlerts(cityId, force);
    return NextResponse.json(result);
  }

  const alerts = await getAlerts(15, forceRefresh);

  if (action === "summary") {
    const summary = summarize(alerts, range);
    return NextResponse.json(summary);
  }

  if (action === "timeseries") {
    const series = buildTimeSeries(alerts, range, cityId);
    return NextResponse.json(series);
  }

  if (action === "cities") {
    const filtered = filterByTimeRange(alerts, range);
    const byCities = countByCity(filtered);
    return NextResponse.json(byCities);
  }

  if (action === "predict") {
    const dateTime = searchParams.get("dateTime");
    if (!dateTime) {
      return NextResponse.json({ error: "dateTime required" }, { status: 400 });
    }
    const prediction = predict(alerts, dateTime, cityId);
    return NextResponse.json(prediction);
  }

  if (action === "hourly-averages") {
    const averages = computeHourlyAverages(alerts, cityId);
    return NextResponse.json(averages);
  }

  if (action === "daily-same-time") {
    const hour = searchParams.get("hour");
    if (hour === null) {
      return NextResponse.json({ error: "hour required" }, { status: 400 });
    }
    const hourNum = parseInt(hour, 10);
    if (isNaN(hourNum) || hourNum < 0 || hourNum > 23) {
      return NextResponse.json({ error: "Invalid hour (0-23)" }, { status: 400 });
    }
    const data = dailySameTime(alerts, hourNum, cityId);
    return NextResponse.json(data);
  }

  if (action === "forecast-lines") {
    const dayOfWeek = searchParams.get("dayOfWeek");
    if (dayOfWeek === null) {
      return NextResponse.json({ error: "dayOfWeek required (0-6)" }, { status: 400 });
    }
    const dow = parseInt(dayOfWeek, 10);
    if (isNaN(dow) || dow < 0 || dow > 6) {
      return NextResponse.json({ error: "Invalid dayOfWeek (0-6)" }, { status: 400 });
    }
    const data = computeForecastLines(alerts, dow, cityId);
    return NextResponse.json(data);
  }

  if (action === "ai-predict") {
    if (!cityId) {
      return NextResponse.json({ error: "cityId required" }, { status: 400 });
    }
    const data = computeAIPrediction(alerts, cityId);
    return NextResponse.json(data);
  }

  if (action === "ai2-predict") {
    if (!cityId) {
      return NextResponse.json({ error: "cityId required" }, { status: 400 });
    }
    const data = computeAI2Prediction(alerts, cityId);
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

/**
 * POST handler: refresh data in a single invocation.
 * Fetches latest from oref server-side, merges with cached data,
 * and returns summary + timeseries + cities in one response.
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = (searchParams.get("range") || "24h") as TimeRange;
  const cityId = searchParams.get("cityId") || undefined;

  if (!VALID_RANGES.includes(range)) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  let body: { orefData?: OrefAlert[]; source?: string; orefUrl?: string } = {};
  try {
    body = await request.json();
  } catch { /* empty body is OK — legacy compat */ }

  try {
    let alerts;
    let meta;

    if (body.source === "browser" && body.orefData && body.orefData.length > 0) {
      // Client fetched oref directly from the browser — ingest the data
      alerts = await ingestAndGetAlerts(body.orefData, 15);
      meta = {
        orefCalled: true,
        orefUrl: body.orefUrl || "browser-direct",
        orefStatus: 200,
        freshRecords: body.orefData.length,
        cachedRecords: 0,
        totalRecords: alerts.length,
        source: "browser",
        orefResponseSample: body.orefData.slice(0, 3),
      };
    } else if (cityId) {
      // Server-side: city-specific refresh (with mode=3 → mode=0 fallback)
      await refreshCityAlerts(cityId, true);
      meta = getLastRefreshMeta();
      // getAlerts with forceRefresh=true to ensure cache is loaded even if oref failed
      alerts = await getAlerts(15, true);
    } else {
      // Server-side: general refresh (mode=0)
      alerts = await getAlerts(15, true);
      meta = getLastRefreshMeta();
    }

    const summary = summarize(alerts, range);
    const timeseries = buildTimeSeries(alerts, range);
    const filtered = filterByTimeRange(alerts, range);
    const cities = countByCity(filtered);
    const cityTimeseries = cityId ? buildTimeSeries(alerts, range, cityId) : undefined;

    return NextResponse.json({ summary, timeseries, cities, cityTimeseries, refreshMeta: meta });
  } catch (err) {
    console.error("Refresh error:", err);
    return NextResponse.json({ error: "Failed to refresh data" }, { status: 500 });
  }
}
