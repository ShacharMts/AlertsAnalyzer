import { Alert, City } from "@/types/alerts";
import cities from "@/data/cities.json";

// ─── Haversine ──────────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearbyCities(cityId: string, radiusKm: number): City[] {
  const target = (cities as City[]).find((c) => c.id === cityId);
  if (!target) return [];
  return (cities as City[]).filter(
    (c) => c.id !== cityId && haversineKm(target.lat, target.lng, c.lat, c.lng) <= radiusKm
  );
}

// ─── Simple Neural Network (from scratch) ───────────────────────────
// 2-layer feedforward: input → hidden (tanh) → output (sigmoid)

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
}
function tanh(x: number): number {
  return Math.tanh(x);
}
function tanhDeriv(y: number): number {
  return 1 - y * y;
}

interface NeuralNet {
  inputSize: number;
  hiddenSize: number;
  wH: number[][]; // hiddenSize x inputSize
  bH: number[];   // hiddenSize
  wO: number[];   // hiddenSize (single output)
  bO: number;
}

function createNet(inputSize: number, hiddenSize: number): NeuralNet {
  // Xavier initialization
  const scale = Math.sqrt(2 / (inputSize + hiddenSize));
  const wH: number[][] = [];
  const bH: number[] = [];
  for (let i = 0; i < hiddenSize; i++) {
    const row: number[] = [];
    for (let j = 0; j < inputSize; j++) {
      row.push((Math.random() - 0.5) * 2 * scale);
    }
    wH.push(row);
    bH.push(0);
  }
  const scaleO = Math.sqrt(2 / hiddenSize);
  const wO: number[] = [];
  for (let i = 0; i < hiddenSize; i++) {
    wO.push((Math.random() - 0.5) * 2 * scaleO);
  }
  return { inputSize, hiddenSize, wH, bH, wO, bO: 0 };
}

function forward(net: NeuralNet, x: number[]): { hidden: number[]; output: number } {
  const hidden: number[] = [];
  for (let i = 0; i < net.hiddenSize; i++) {
    let sum = net.bH[i];
    for (let j = 0; j < net.inputSize; j++) {
      sum += net.wH[i][j] * x[j];
    }
    hidden.push(tanh(sum));
  }
  let outSum = net.bO;
  for (let i = 0; i < net.hiddenSize; i++) {
    outSum += net.wO[i] * hidden[i];
  }
  return { hidden, output: sigmoid(outSum) };
}

function train(
  net: NeuralNet,
  data: { x: number[]; y: number }[],
  epochs: number,
  lr: number
): void {
  for (let epoch = 0; epoch < epochs; epoch++) {
    for (const sample of data) {
      const { hidden, output } = forward(net, sample.x);
      // Binary cross-entropy gradient at output
      const dOut = output - sample.y;

      // Update output weights
      for (let i = 0; i < net.hiddenSize; i++) {
        const gradO = dOut * hidden[i];
        net.wO[i] -= lr * gradO;
      }
      net.bO -= lr * dOut;

      // Backprop to hidden
      for (let i = 0; i < net.hiddenSize; i++) {
        const dH = dOut * net.wO[i] * tanhDeriv(hidden[i]);
        for (let j = 0; j < net.inputSize; j++) {
          net.wH[i][j] -= lr * dH * sample.x[j];
        }
        net.bH[i] -= lr * dH;
      }
    }
  }
}

// ─── Feature Engineering ────────────────────────────────────────────

const FEATURE_COUNT = 12;

function extractFeatures(
  hourOfDay: number,
  dayOfWeek: number,
  cityHourCounts: number[],    // attacks per hour-of-day (24 buckets)
  nearbyHourCounts: number[],  // nearby attacks per hour-of-day
  recentCityHour: number[],    // last 7 days
  olderCityHour: number[],     // 8-30 days ago
  totalCityAttacks: number,
  totalNearbyAttacks: number,
  hoursSinceLastAttack: number,
  daysAnalyzed: number
): number[] {
  const features: number[] = [];

  // 1-2: Hour cyclical encoding
  features.push(Math.sin((2 * Math.PI * hourOfDay) / 24));
  features.push(Math.cos((2 * Math.PI * hourOfDay) / 24));

  // 3-4: Day-of-week cyclical encoding
  features.push(Math.sin((2 * Math.PI * dayOfWeek) / 7));
  features.push(Math.cos((2 * Math.PI * dayOfWeek) / 7));

  // 5: Historical attack rate at this hour (normalized)
  const maxHourCount = Math.max(1, ...cityHourCounts);
  features.push(cityHourCounts[hourOfDay] / maxHourCount);

  // 6: Nearby attack rate at this hour (normalized)
  const maxNearbyCount = Math.max(1, ...nearbyHourCounts);
  features.push(nearbyHourCounts[hourOfDay] / maxNearbyCount);

  // 7: Recent vs older ratio (trend)
  const recentTotal = recentCityHour.reduce((s, c) => s + c, 0);
  const olderTotal = olderCityHour.reduce((s, c) => s + c, 0);
  features.push(recentTotal + olderTotal > 0 ? recentTotal / (recentTotal + olderTotal) : 0.5);

  // 8: Recent attack rate at this specific hour
  const maxRecent = Math.max(1, ...recentCityHour);
  features.push(recentCityHour[hourOfDay] / maxRecent);

  // 9: Overall city attack intensity (normalized by days)
  features.push(Math.min(1, totalCityAttacks / (daysAnalyzed * 24)));

  // 10: Overall nearby intensity
  features.push(Math.min(1, totalNearbyAttacks / (daysAnalyzed * 24)));

  // 11: Recency (hours since last attack, inverted and normalized)
  features.push(Math.exp(-hoursSinceLastAttack / 48)); // decay over 48h

  // 12: Adjacent hour activity (average of ±1 hour)
  const prevHour = (hourOfDay + 23) % 24;
  const nextHour = (hourOfDay + 1) % 24;
  const adjAvg = (cityHourCounts[prevHour] + cityHourCounts[nextHour]) / 2;
  features.push(adjAvg / maxHourCount);

  return features;
}

// ─── Public Interface ───────────────────────────────────────────────

export interface AI2HourlyPrediction {
  hourOffset: number;
  hour: number;
  label: string;
  probability: number;  // 0-1 raw model output
  riskPct: number;      // 0-100 scaled
  riskLevel: "low" | "medium" | "high" | "critical";
  confidence: number;   // model confidence 0-100
}

export interface AI2Result {
  cityId: string;
  nearbyCityIds: string[];
  generatedAt: string;
  next24h: AI2HourlyPrediction[];
  overallRisk: number;
  overallLevel: "low" | "medium" | "high" | "critical";
  peakHour: number;
  peakRisk: number;
  modelAccuracy: number;       // training accuracy %
  trainingSamples: number;
  totalCityAttacks30d: number;
  totalNearbyAttacks30d: number;
}

function riskLevel(pct: number): "low" | "medium" | "high" | "critical" {
  if (pct >= 75) return "critical";
  if (pct >= 50) return "high";
  if (pct >= 25) return "medium";
  return "low";
}

export function computeAI2Prediction(alerts: Alert[], cityId: string): AI2Result {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const currentHour = now.getHours();

  const nearbyCities = findNearbyCities(cityId, 10);
  const nearbyCityIds = nearbyCities.map((c) => c.id);
  const nearbySet = new Set(nearbyCityIds);

  // Get missiles in 30-day window
  const cityMissiles = alerts.filter(
    (a) => a.cityId === cityId && a.type === "missile" && new Date(a.timestamp) >= thirtyDaysAgo
  );
  const nearbyMissiles = alerts.filter(
    (a) => nearbySet.has(a.cityId) && a.type === "missile" && new Date(a.timestamp) >= thirtyDaysAgo
  );

  // Also include warnings for a fuller picture
  const cityAlerts = alerts.filter(
    (a) => a.cityId === cityId && new Date(a.timestamp) >= thirtyDaysAgo
  );

  // Build per-hour counts
  const cityHourCounts = new Array(24).fill(0);
  const nearbyHourCounts = new Array(24).fill(0);
  const recentCityHour = new Array(24).fill(0); // last 7 days
  const olderCityHour = new Array(24).fill(0);  // 8-30 days ago
  // Per day-of-week × hour counts for more granular patterns
  const dowHourCounts = Array.from({ length: 7 }, () => new Array(24).fill(0));

  for (const a of cityMissiles) {
    const ts = new Date(a.timestamp);
    const h = ts.getHours();
    cityHourCounts[h]++;
    dowHourCounts[ts.getDay()][h]++;
    if (ts >= sevenDaysAgo) recentCityHour[h]++;
    else olderCityHour[h]++;
  }
  for (const a of nearbyMissiles) {
    nearbyHourCounts[new Date(a.timestamp).getHours()]++;
  }

  // Hours since last attack
  let hoursSinceLastAttack = 720; // default 30 days
  if (cityMissiles.length > 0) {
    const lastTs = Math.max(...cityMissiles.map((a) => new Date(a.timestamp).getTime()));
    hoursSinceLastAttack = (now.getTime() - lastTs) / (1000 * 60 * 60);
  }

  // Count how many distinct days had data
  const daysWithData = new Set<string>();
  for (const a of cityAlerts) {
    const ts = new Date(a.timestamp);
    daysWithData.add(`${ts.getFullYear()}-${ts.getMonth()}-${ts.getDate()}`);
  }
  const daysAnalyzed = Math.max(1, daysWithData.size);

  // Count distinct days per day-of-week
  const dowDayCounts = new Array(7).fill(0);
  for (let d = 0; d < 30; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    dowDayCounts[date.getDay()]++;
  }

  // ─── Empirical Attack Rates ────────────────────────────────────
  // Compute the empirical probability of an attack at each hour
  // based on historical frequency

  // Count how many distinct days we have for each hour slot
  const hourDayCounts = new Array(24).fill(0);
  for (let d = 0; d < 30; d++) {
    for (let h = 0; h < 24; h++) {
      hourDayCounts[h]++;
    }
  }

  // Empirical rate: attacks at this hour / number of days
  const empiricalRate = new Array(24).fill(0);
  for (let h = 0; h < 24; h++) {
    empiricalRate[h] = cityHourCounts[h] / Math.max(1, hourDayCounts[h]);
  }

  // Recent trend multiplier: compare last 7 days vs previous 23 days
  const recentTotal = recentCityHour.reduce((s, c) => s + c, 0);
  const olderTotal = olderCityHour.reduce((s, c) => s + c, 0);
  const trendMultiplier = olderTotal > 0
    ? (recentTotal / 7) / (olderTotal / 23)
    : (recentTotal > 0 ? 2.0 : 0.5);

  // Recency boost: more recent attacks → higher probability
  const recencyFactor = Math.exp(-hoursSinceLastAttack / 72); // decay over 72h

  // ─── Build Training Data ───────────────────────────────────────
  const positiveSlots = new Set<string>();
  for (const a of cityMissiles) {
    const ts = new Date(a.timestamp);
    const key = `${ts.getFullYear()}-${ts.getMonth()}-${ts.getDate()}-${ts.getHours()}`;
    positiveSlots.add(key);
  }

  const trainingData: { x: number[]; y: number }[] = [];

  for (let d = 0; d < 30; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    const dow = date.getDay();

    for (let h = 0; h < 24; h++) {
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${h}`;
      const label = positiveSlots.has(key) ? 1 : 0;

      // Compute hoursSinceLastAttack relative to this training slot
      const slotTime = new Date(date);
      slotTime.setHours(h, 0, 0, 0);
      let hSinceLast = 720;
      if (cityMissiles.length > 0) {
        // Find closest previous attack before this slot
        let closestDelta = 720;
        for (const a of cityMissiles) {
          const ats = new Date(a.timestamp).getTime();
          const delta = (slotTime.getTime() - ats) / (1000 * 60 * 60);
          if (delta >= 0 && delta < closestDelta) closestDelta = delta;
        }
        hSinceLast = closestDelta;
      }

      const features = extractFeatures(
        h, dow,
        cityHourCounts, nearbyHourCounts,
        recentCityHour, olderCityHour,
        cityMissiles.length, nearbyMissiles.length,
        hSinceLast, daysAnalyzed
      );

      trainingData.push({ x: features, y: label });
    }
  }

  // ─── Handle class imbalance via oversampling ────────────────────
  const positives = trainingData.filter((s) => s.y === 1);
  const negatives = trainingData.filter((s) => s.y === 0);

  let balancedData = [...trainingData];
  if (positives.length > 0 && negatives.length > positives.length * 3) {
    // Oversample positives to at most 1:2 ratio
    const needed = Math.floor(negatives.length / 2) - positives.length;
    for (let i = 0; i < needed; i++) {
      balancedData.push(positives[i % positives.length]);
    }
  }

  // ─── Train Neural Network ─────────────────────────────────────
  const net = createNet(FEATURE_COUNT, 16); // larger hidden layer

  // Shuffle
  for (let i = balancedData.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [balancedData[i], balancedData[j]] = [balancedData[j], balancedData[i]];
  }

  train(net, balancedData, 200, 0.1); // more epochs, higher learning rate

  // Compute training accuracy
  let correct = 0;
  for (const sample of trainingData) {
    const { output } = forward(net, sample.x);
    const predicted = output >= 0.5 ? 1 : 0;
    if (predicted === sample.y) correct++;
  }
  const modelAccuracy = Math.round((correct / trainingData.length) * 100);

  // ─── Predict Next 24 Hours ────────────────────────────────────
  const next24h: AI2HourlyPrediction[] = [];

  for (let offset = 0; offset < 24; offset++) {
    const futureDate = new Date(now.getTime() + offset * 60 * 60 * 1000);
    const targetHour = futureDate.getHours();
    const futureDow = futureDate.getDay();

    const features = extractFeatures(
      targetHour, futureDow,
      cityHourCounts, nearbyHourCounts,
      recentCityHour, olderCityHour,
      cityMissiles.length, nearbyMissiles.length,
      hoursSinceLastAttack, daysAnalyzed
    );

    const { output: nnOutput } = forward(net, features);

    // Blend neural network output with empirical rate for calibration
    // Empirical rate captures the base frequency, NN captures patterns
    const baseRate = empiricalRate[targetHour];
    const dowRate = dowDayCounts[futureDow] > 0
      ? dowHourCounts[futureDow][targetHour] / dowDayCounts[futureDow]
      : baseRate;

    // Combine: weighted blend of NN prediction with empirical rates
    // Scale empirical rate to probability (cap at 1.0)
    const empiricalProb = Math.min(1.0, baseRate * trendMultiplier * (0.5 + 0.5 * recencyFactor));
    const dowProb = Math.min(1.0, dowRate * trendMultiplier * (0.5 + 0.5 * recencyFactor));

    // Blend: 40% NN + 30% hourly empirical + 30% day-of-week empirical
    const blended = 0.4 * nnOutput + 0.3 * empiricalProb + 0.3 * dowProb;
    const probability = Math.min(1.0, Math.max(0, blended));

    const riskPct = Math.round(probability * 100);
    const confidence = Math.round(Math.abs(probability - 0.5) * 200);

    next24h.push({
      hourOffset: offset,
      hour: targetHour,
      label: `${targetHour.toString().padStart(2, "0")}:00`,
      probability: Math.round(probability * 1000) / 1000,
      riskPct,
      riskLevel: riskLevel(riskPct),
      confidence,
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
    modelAccuracy,
    trainingSamples: trainingData.length,
    totalCityAttacks30d: cityMissiles.length,
    totalNearbyAttacks30d: nearbyMissiles.length,
  };
}
