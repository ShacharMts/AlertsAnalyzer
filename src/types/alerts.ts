export interface City {
  id: string;
  en: string;
  he: string;
  lat: number;
  lng: number;
}

export type AlertType = "warning" | "missile";

export interface Alert {
  id: string;
  type: AlertType;
  cityId: string;
  timestamp: string; // ISO string
}

export type TimeRange = "6h" | "12h" | "24h" | "2d" | "7d" | "14d";

export interface AlertsSummary {
  timeRange: TimeRange;
  warningCount: number;
  missileCount: number;
  totalCount: number;
}

export interface CityAlertCount {
  cityId: string;
  warningCount: number;
  missileCount: number;
  totalCount: number;
}

export interface HourlyAverage {
  hour: number; // 0-23
  avgWarnings: number;
  avgMissiles: number;
}

export interface Prediction {
  dateTime: string;
  estimatedWarnings: number;
  estimatedMissiles: number;
  pctWarnings: number;
  pctMissiles: number;
}

export interface AlertsResponse {
  alerts: Alert[];
  generatedAt: string;
}

export type Locale = "en" | "he";
