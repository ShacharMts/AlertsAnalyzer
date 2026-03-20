import { Alert, AlertType } from "@/types/alerts";
import cities from "@/data/cities.json";

// Deterministic pseudo-random based on seed
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Cities in south/border areas get more alerts
const highAlertCities = new Set([
  "sderot", "ashkelon", "netivot", "ofakim", "beersheva",
  "ashdod", "kiryat-shmona", "nahariya", "safed", "akko",
]);

const mediumAlertCities = new Set([
  "haifa", "tel-aviv", "jerusalem", "rishon-lezion", "petah-tikva",
  "holon", "ramat-gan", "rehovot", "netanya", "herzliya",
  "bnei-brak", "modiin", "dimona", "arad",
]);

function getCityWeight(cityId: string): number {
  if (highAlertCities.has(cityId)) return 3;
  if (mediumAlertCities.has(cityId)) return 1.5;
  return 0.5;
}

export function generateMockAlerts(daysBack: number = 14): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();
  const rand = seededRandom(42);
  const cityIds = cities.map((c) => c.id);

  for (let day = 0; day < daysBack; day++) {
    // More alerts on some days to create variation
    const dayMultiplier = 0.5 + rand() * 1.5;

    for (const cityId of cityIds) {
      const weight = getCityWeight(cityId);
      const baseAlertsPerDay = 2 * weight * dayMultiplier;
      const alertCount = Math.floor(baseAlertsPerDay * rand() * 2);

      for (let i = 0; i < alertCount; i++) {
        const hour = Math.floor(rand() * 24);
        const minute = Math.floor(rand() * 60);
        const second = Math.floor(rand() * 60);

        const alertDate = new Date(now);
        alertDate.setDate(alertDate.getDate() - day);
        alertDate.setHours(hour, minute, second, 0);

        // 60% missiles, 40% warnings
        const type: AlertType = rand() < 0.6 ? "missile" : "warning";

        alerts.push({
          id: `alert-${day}-${cityId}-${i}`,
          type,
          cityId,
          timestamp: alertDate.toISOString(),
        });
      }
    }
  }

  // Sort by timestamp descending (newest first)
  alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return alerts;
}
