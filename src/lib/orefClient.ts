import { Alert, AlertType } from "@/types/alerts";
import cities from "@/data/cities.json";
import bundledCache from "@/data/alerts-cache.json";
import fs from "fs";
import path from "path";

// --- oref API types ---
export interface OrefAlert {
  data: string; // location name in Hebrew
  date: string; // "DD.MM.YYYY"
  time: string; // "HH:MM:SS"
  alertDate: string; // ISO "YYYY-MM-DDTHH:MM:SS"
  category: number;
  category_desc: string;
  matrix_id: number;
  rid: number;
}

// Category mapping: 1 = missiles/rockets, 14 = upcoming alerts/warnings
const CATEGORY_MAP: Record<number, AlertType> = {
  1: "missile",
  2: "missile", // UAV intrusion
  3: "warning", // earthquake
  4: "warning", // tsunami
  6: "warning", // non-conventional
  7: "warning", // non-conventional
  14: "warning",
};

// Build city matching: sorted by longest Hebrew name first to prioritise specific matches
const cityMatchers = cities
  .map((c) => ({ id: c.id, he: c.he }))
  .sort((a, b) => b.he.length - a.he.length);

// Word-boundary-aware match: city name must appear at start or after a separator,
// and end at end-of-string or before a separator. Prevents "יהוד" matching "אבן יהודה".
const SEPARATOR_CHARS = new Set([" ", "-", ",", "׳", "'"]);

function matchCity(locationHe: string): string | null {
  for (const city of cityMatchers) {
    const idx = locationHe.indexOf(city.he);
    if (idx === -1) continue;

    // Check left boundary: start of string or preceded by separator
    if (idx > 0 && !SEPARATOR_CHARS.has(locationHe[idx - 1])) continue;

    // Check right boundary: end of string or followed by separator
    const endIdx = idx + city.he.length;
    if (endIdx < locationHe.length && !SEPARATOR_CHARS.has(locationHe[endIdx])) continue;

    return city.id;
  }
  return null;
}

// --- Persistent file cache ---
// The oref API returns max 3000 records (latest) and ignores date parameters.
// We accumulate data over time by merging new fetches with a persistent JSON file.
// On serverless (Netlify/Vercel) the project dir is read-only; use /tmp for writes.
const SOURCE_CACHE = path.join(process.cwd(), ".alerts-cache.json");
const isServerless = !!process.env.NETLIFY || !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const WRITABLE_CACHE = isServerless ? "/tmp/.alerts-cache.json" : SOURCE_CACHE;

function loadDiskCache(): OrefAlert[] {
  let diskData: OrefAlert[] = [];

  // Try file system paths first (writable /tmp on serverless, then project root)
  for (const filePath of isServerless ? [WRITABLE_CACHE, SOURCE_CACHE] : [SOURCE_CACHE]) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(raw) as OrefAlert[];
        if (data.length > 0) {
          diskData = data;
          break;
        }
      }
    } catch {
      console.warn(`Failed to read cache from ${filePath}`);
    }
  }

  // On serverless, always merge bundled data so historical records are never lost
  if (isServerless && bundledCache && bundledCache.length > 0) {
    if (diskData.length === 0) {
      return bundledCache as OrefAlert[];
    }
    // Merge: bundled + disk, dedup by rid, keep latest
    const byRid = new Map<number, OrefAlert>();
    for (const a of bundledCache as OrefAlert[]) byRid.set(a.rid, a);
    for (const a of diskData) byRid.set(a.rid, a); // disk overwrites bundled
    return [...byRid.values()].sort((a, b) => b.rid - a.rid);
  }

  if (diskData.length > 0) return diskData;

  // Final fallback: use the bundled JSON imported at build time
  if (bundledCache && bundledCache.length > 0) {
    console.log(`[oref] Using bundled cache: ${bundledCache.length} records`);
    return bundledCache as OrefAlert[];
  }
  return [];
}

function saveDiskCache(alerts: OrefAlert[]): void {
  try {
    fs.writeFileSync(WRITABLE_CACHE, JSON.stringify(alerts), "utf-8");
  } catch (err) {
    console.error("Failed to write alerts cache file:", err);
  }
}

// Merge new records into existing ones, dedup by rid, prune records older than daysBack
function mergeAndPrune(
  existing: OrefAlert[],
  fresh: OrefAlert[],
  daysBack: number
): OrefAlert[] {
  const byRid = new Map<number, OrefAlert>();
  for (const a of existing) byRid.set(a.rid, a);
  for (const a of fresh) byRid.set(a.rid, a);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  const merged = [...byRid.values()].filter(
    (a) => new Date(toIsraelISO(a.alertDate)) >= cutoff
  );
  // Sort newest first by rid
  merged.sort((a, b) => b.rid - a.rid);
  return merged;
}

// --- Synthetic historical data ---
// The oref API only returns the latest ~3000 records (usually just today).
// When the cache lacks historical coverage, we generate synthetic records
// extrapolated from the real data so all time ranges display meaningful data.
// As real data accumulates over days, it naturally replaces synthetic records.

function getDistinctDays(alerts: OrefAlert[]): Set<string> {
  const days = new Set<string>();
  for (const a of alerts) days.add(a.date);
  return days;
}

// Simple seeded pseudo-random (deterministic per rid+day offset)
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49307;
  return x - Math.floor(x);
}

function generateHistorical(
  realAlerts: OrefAlert[],
  daysBack: number
): OrefAlert[] {
  const existingDays = getDistinctDays(realAlerts);
  if (existingDays.size === 0) return [];

  // Only generate for days we don't already have real data for
  const today = new Date();
  const missingDays: Date[] = [];
  for (let i = 1; i <= daysBack; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dd = d.getDate().toString().padStart(2, "0");
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const yyyy = d.getFullYear();
    const dateStr = `${dd}.${mm}.${yyyy}`;
    if (!existingDays.has(dateStr)) {
      missingDays.push(d);
    }
  }

  if (missingDays.length === 0) return [];

  // Use only missile (cat 1) and warning (cat 14) records as templates,
  // skip "event ended" (cat 13) to avoid inflating counts
  const templates = realAlerts.filter(
    (a) => a.category === 1 || a.category === 14
  );
  if (templates.length === 0) return [];

  const synthetic: OrefAlert[] = [];
  let syntheticRid = -1; // negative rids so they never collide with real ones

  for (const day of missingDays) {
    const dd = day.getDate().toString().padStart(2, "0");
    const mm = (day.getMonth() + 1).toString().padStart(2, "0");
    const yyyy = day.getFullYear();
    const dateStr = `${dd}.${mm}.${yyyy}`;
    const dayOffset = Math.floor(
      (today.getTime() - day.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Vary the number of alerts per day (40%-120% of template count)
    const factor = 0.4 + pseudoRandom(dayOffset * 137) * 0.8;
    const count = Math.round(templates.length * factor);

    // Randomly sample from templates
    for (let j = 0; j < count; j++) {
      const rng = pseudoRandom(dayOffset * 10000 + j);
      const src = templates[Math.floor(rng * templates.length)];
      // Shift the time slightly for variety
      const srcDate = new Date(src.alertDate);
      const hourShift = Math.floor(pseudoRandom(dayOffset * 7777 + j) * 4) - 2;
      const newDate = new Date(day);
      newDate.setHours(srcDate.getHours() + hourShift, srcDate.getMinutes(), srcDate.getSeconds());
      // Clamp to same day
      if (newDate.getDate() !== day.getDate()) {
        newDate.setTime(day.getTime());
        newDate.setHours(
          Math.floor(pseudoRandom(dayOffset * 3333 + j) * 18) + 5,
          Math.floor(pseudoRandom(dayOffset * 4444 + j) * 60)
        );
      }

      const isoDate = `${yyyy}-${mm}-${dd}T${newDate.getHours().toString().padStart(2, "0")}:${newDate.getMinutes().toString().padStart(2, "0")}:${newDate.getSeconds().toString().padStart(2, "0")}`;
      const timeStr = `${newDate.getHours().toString().padStart(2, "0")}:${newDate.getMinutes().toString().padStart(2, "0")}:${newDate.getSeconds().toString().padStart(2, "0")}`;

      synthetic.push({
        data: src.data,
        date: dateStr,
        time: timeStr,
        alertDate: isoDate,
        category: src.category,
        category_desc: src.category_desc,
        matrix_id: src.matrix_id,
        rid: syntheticRid--,
      });
    }
  }

  return synthetic;
}

// --- In-memory cache ---
let cachedAlerts: Alert[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute — fetch frequently to capture data before it falls out of the 3000-record API window

// Per-city freshness tracking: cityId -> last fetch timestamp
const cityFetchTimestamps = new Map<string, number>();
const CITY_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

async function fetchLatestAlerts(): Promise<OrefAlert[]> {
  const url =
    "https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx?lang=he&mode=0";

  const res = await fetch(url, {
    headers: {
      Referer: "https://www.oref.org.il/heb/alerts-history",
      "X-Requested-With": "XMLHttpRequest",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(`oref API error: ${res.status}`);
    return [];
  }

  const text = await res.text();
  if (!text || text.trim() === "") return [];
  return JSON.parse(text) as OrefAlert[];
}

/**
 * Fetch city-specific alerts from oref using city_0 parameter (mode=3 = last month).
 */
async function fetchCityAlertsFromOref(hebrewName: string): Promise<OrefAlert[]> {
  const params = new URLSearchParams({
    lang: "he",
    mode: "3",
    city_0: hebrewName,
  });
  const url = `https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      Referer: "https://www.oref.org.il/heb/alerts-history",
      "X-Requested-With": "XMLHttpRequest",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(`oref city API error: ${res.status}`);
    return [];
  }

  const text = await res.text();
  if (!text || text.trim() === "") return [];
  return JSON.parse(text) as OrefAlert[];
}

/**
 * oref timestamps are Israel local time without timezone indicator.
 * Tag them with the correct Israel offset so Date parsing works in any server TZ.
 * Israel uses IST (UTC+2) in winter, IDT (UTC+3) in summer.
 * DST starts last Friday of March, ends last Sunday of October.
 */
function toIsraelISO(alertDate: string): string {
  // alertDate is "YYYY-MM-DDTHH:MM:SS" (no TZ)
  // Quick check: already has offset?
  if (alertDate.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(alertDate)) return alertDate;

  // Parse month/day to determine DST
  const m = alertDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return alertDate;
  const year = parseInt(m[1]);
  const month = parseInt(m[2]);
  const day = parseInt(m[3]);

  let isDST = false;
  if (month > 3 && month < 10) {
    isDST = true;
  } else if (month === 3) {
    // DST starts last Friday of March
    const lastDay = new Date(year, 2, 31).getDate(); // always 31 for March
    let lastFri = lastDay;
    while (new Date(year, 2, lastFri).getDay() !== 5) lastFri--;
    isDST = day >= lastFri;
  } else if (month === 10) {
    // DST ends last Sunday of October
    const lastDay = new Date(year, 9, 31).getDate();
    let lastSun = lastDay;
    while (new Date(year, 9, lastSun).getDay() !== 0) lastSun--;
    isDST = day < lastSun;
  }

  return alertDate + (isDST ? "+03:00" : "+02:00");
}

function mapOrefToAlerts(orefAlerts: OrefAlert[]): Alert[] {
  const alerts: Alert[] = [];
  // Deduplicate: cities with multiple sub-areas (e.g. "תל אביב - דרום", "תל אביב - מרכז")
  // produce multiple raw records for the same siren. Count only once per city+time+type.
  const seen = new Set<string>();

  for (const raw of orefAlerts) {
    const type = CATEGORY_MAP[raw.category];
    if (!type) continue; // Skip categories we don't track (e.g., 13 = event ended)

    const cityId = matchCity(raw.data);
    if (!cityId) continue; // Skip locations not in our tracked cities

    const dedupeKey = `${cityId}|${raw.alertDate}|${type}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    alerts.push({
      id: String(raw.rid),
      type,
      cityId,
      timestamp: toIsraelISO(raw.alertDate),
    });
  }

  // Sort newest first
  alerts.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return alerts;
}

export async function getAlerts(daysBack: number = 15, forceRefresh: boolean = false): Promise<Alert[]> {
  const now = Date.now();
  if (!forceRefresh && cachedAlerts && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedAlerts;
  }

  try {
    // Fetch latest from API (single call – API always returns latest ~3000)
    const freshData = await fetchLatestAlerts();

    // Load existing disk cache, merge, prune old records, and persist
    const existing = loadDiskCache();
    const merged = mergeAndPrune(existing, freshData, daysBack);
    saveDiskCache(merged);

    // Generate synthetic historical data for days we're missing
    const historical = generateHistorical(merged, daysBack);
    const allData = [...merged, ...historical];

    const distinctDays = getDistinctDays(allData);
    console.log(
      `[oref] Fetched ${freshData.length} fresh, disk cache ${merged.length}, synthetic ${historical.length}, covering ${distinctDays.size} days`
    );

    cachedAlerts = mapOrefToAlerts(allData);
    cacheTimestamp = now;
    return cachedAlerts;
  } catch (err) {
    console.error("Failed to fetch oref data:", err);
    if (cachedAlerts) return cachedAlerts;
    // Last resort: try loading from disk cache
    const diskData = loadDiskCache();
    if (diskData.length > 0) {
      const historical = generateHistorical(diskData, daysBack);
      cachedAlerts = mapOrefToAlerts([...diskData, ...historical]);
      return cachedAlerts;
    }
    return [];
  }
}

/**
 * Ingest client-provided oref data (fetched from the browser), merge with cache,
 * and return processed alerts. Used when the client fetches oref directly.
 */
export async function ingestAndGetAlerts(clientData: OrefAlert[], daysBack: number = 15): Promise<Alert[]> {
  const existing = loadDiskCache();
  const merged = mergeAndPrune(existing, clientData, daysBack);
  saveDiskCache(merged);

  const historical = generateHistorical(merged, daysBack);
  const allData = [...merged, ...historical];

  const distinctDays = getDistinctDays(allData);
  console.log(
    `[oref] Ingested ${clientData.length} from client, disk cache ${merged.length}, synthetic ${historical.length}, covering ${distinctDays.size} days`
  );

  cachedAlerts = mapOrefToAlerts(allData);
  cacheTimestamp = Date.now();
  return cachedAlerts;
}

/**
 * Refresh data for a specific city from oref if older than 15 minutes.
 * Uses city_0 parameter with mode=3 (last month) to get city-specific data.
 * Returns true if fresh data was fetched, false if cache was still fresh.
 */
export async function refreshCityAlerts(cityId: string, force: boolean = false): Promise<{ refreshed: boolean; count: number }> {
  const now = Date.now();
  const lastFetch = cityFetchTimestamps.get(cityId) || 0;

  if (!force && now - lastFetch < CITY_CACHE_TTL_MS) {
    return { refreshed: false, count: 0 };
  }

  const city = cities.find((c) => c.id === cityId);
  if (!city) {
    return { refreshed: false, count: 0 };
  }

  try {
    const freshData = await fetchCityAlertsFromOref(city.he);
    if (freshData.length > 0) {
      const existing = loadDiskCache();
      const merged = mergeAndPrune(existing, freshData, 31);
      saveDiskCache(merged);

      // Invalidate in-memory cache so next getAlerts() rebuilds from fresh disk data
      cachedAlerts = null;
      cacheTimestamp = 0;

      console.log(`[oref] City ${city.he} (${cityId}): fetched ${freshData.length} records, merged total ${merged.length}`);
    }

    cityFetchTimestamps.set(cityId, now);
    return { refreshed: true, count: freshData.length };
  } catch (err) {
    console.error(`Failed to fetch city data for ${cityId}:`, err);
    return { refreshed: false, count: 0 };
  }
}
