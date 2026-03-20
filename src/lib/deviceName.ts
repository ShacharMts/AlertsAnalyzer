/**
 * Extract a human-readable device name from the browser's user agent.
 * Falls back to "Unknown" if unavailable.
 */
export function getDeviceName(): string {
  if (typeof navigator === "undefined") return "Server";
  const ua = navigator.userAgent;

  // Try mobile devices first
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) {
    const match = ua.match(/;\s*([^;)]+)\s*Build\//);
    if (match) return match[1].trim();
    return "Android";
  }

  // Desktop OS
  if (/Macintosh|Mac OS X/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";

  return "Unknown";
}

let cachedName: string | undefined;

// GPS location state
let gpsLat: number | null = null;
let gpsLng: number | null = null;
let nearestCityId: string | null = null;
let gpsRequested = false;
let gpsCallbacks: Array<(cityId: string, lat: number, lng: number) => void> = [];
let gpsResolved = false;

/**
 * Request GPS permission on site load and find nearest city.
 * Call this once from a top-level component.
 * The optional callback fires when GPS resolves with the nearest city.
 */
export function requestGpsLocation(
  cities: { id: string; lat: number; lng: number }[],
  onResolved?: (cityId: string, lat: number, lng: number) => void
): void {
  if (onResolved) {
    // If GPS already resolved, call immediately
    if (gpsResolved && nearestCityId && gpsLat !== null && gpsLng !== null) {
      onResolved(nearestCityId, gpsLat, gpsLng);
    } else {
      gpsCallbacks.push(onResolved);
    }
  }

  if (gpsRequested) return;
  gpsRequested = true;
  if (typeof navigator === "undefined" || !navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      gpsLat = pos.coords.latitude;
      gpsLng = pos.coords.longitude;

      // Find nearest city
      let closest = cities[0];
      let minDist = Infinity;
      for (const city of cities) {
        const dLat = city.lat - gpsLat;
        const dLng = city.lng - gpsLng;
        const dist = dLat * dLat + dLng * dLng;
        if (dist < minDist) {
          minDist = dist;
          closest = city;
        }
      }
      nearestCityId = closest.id;
      gpsResolved = true;

      // Notify all registered callbacks
      for (const cb of gpsCallbacks) {
        cb(nearestCityId, gpsLat!, gpsLng!);
      }
      gpsCallbacks = [];
    },
    () => {
      /* permission denied or error — leave null */
    },
    { timeout: 10000, maximumAge: 300000 }
  );
}

/** Get the nearest city ID detected via GPS, or null if unavailable. */
export function getNearestCityId(): string | null {
  return nearestCityId;
}

/** Get GPS coordinates if available. */
export function getGpsCoords(): { lat: number; lng: number } | null {
  if (gpsLat !== null && gpsLng !== null) return { lat: gpsLat, lng: gpsLng };
  return null;
}

/**
 * Append device info, user agent, GPS coords, and nearest city to an alerts API URL.
 */
export function withDevice(url: string): string {
  if (!cachedName) cachedName = getDeviceName();
  const separator = url.includes("?") ? "&" : "?";
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  let result = `${url}${separator}device=${encodeURIComponent(cachedName)}&ua=${encodeURIComponent(ua)}`;
  if (gpsLat !== null && gpsLng !== null) {
    result += `&lat=${gpsLat}&lng=${gpsLng}`;
  }
  if (nearestCityId) {
    result += `&nearestCity=${encodeURIComponent(nearestCityId)}`;
  }
  return result;
}
