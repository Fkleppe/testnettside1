import type { Holding } from "./types";

export const demoHoldings: Holding[] = [
  { id: "demo-1", name: "KLP AksjeGlobal Indeks P", symbol: "NO0010776040", kind: "fund", platform: "Kron", mode: "manual", units: 812.44, cost: 148200, price: 221.38, dailyPercent: 0.42, currency: "NOK", source: "Sist registrert", updatedAt: "2026-08-02T13:42:00.000Z", delayed: true },
  { id: "demo-2", name: "Nordnet Norge Indeks", symbol: "NO0010582979", kind: "fund", platform: "Nordnet", mode: "manual", units: 446.21, cost: 71200, price: 194.72, dailyPercent: -0.18, currency: "NOK", source: "Sist registrert", updatedAt: "2026-08-03T09:05:00.000Z", delayed: true },
  { id: "demo-3", name: "Equinor", symbol: "EQNR", kind: "stock", platform: "Nordnet", mode: "manual", units: 180, cost: 47500, price: 285.8, dailyPercent: 1.14, currency: "NOK", source: "Demokurs", updatedAt: "2026-08-03T10:24:00.000Z" },
  { id: "demo-4", name: "Bitcoin", symbol: "BTC", kind: "crypto", platform: "Firi", mode: "manual", units: 0.084, cost: 52200, price: 1184000, dailyPercent: 2.08, currency: "NOK", source: "Demokurs", updatedAt: "2026-08-03T10:26:00.000Z" },
];
