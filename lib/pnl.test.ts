import { describe, expect, it } from "vitest";
import { periodPnl } from "./pnl";
import type { DailySnapshot } from "./history";
import type { PortfolioEvent } from "./types";

const snap = (date: string, value: number, rec = false): DailySnapshot => ({
  date,
  capturedAt: rec ? "1970-01-01T00:00:00.000Z" : `${date}T18:00:00.000Z`,
  value,
  cost: 0,
  groups: {},
  ...(rec ? { origin: "rec" as const } : {}),
});

const buy = (date: string, amount: number): PortfolioEvent => ({
  id: `${date}-${amount}`,
  type: "buy",
  holdingId: "h",
  holdingName: "Fond",
  accountGroup: "private",
  date,
  createdAt: `${date}T10:00:00.000Z`,
  units: 1,
  price: amount,
  amount,
});

const now = new Date(2026, 7, 5, 12, 0);

describe("periodPnl", () => {
  const series = [
    snap("2025-08-05", 800000, true),
    snap("2026-07-05", 950000, true),
    snap("2026-07-29", 980000),
    snap("2026-08-05", 1000000),
  ];

  it("beregner verdiendring fra nyeste punkt før periodestart", () => {
    const week = periodPnl(series, [], 1000000, "7d", now);
    expect(week?.fromDate).toBe("2026-07-29");
    expect(week?.pnl).toBe(20000);
    expect(week?.percent).toBeCloseTo((20000 / 980000) * 100, 5);
    expect(week?.reconstructed).toBe(false);
  });

  it("justerer for innskudd i perioden som en børs-PnL", () => {
    const events = [buy("2026-08-01", 50000)];
    const week = periodPnl(series, events, 1000000, "7d", now);
    expect(week?.deposits).toBe(50000);
    expect(week?.pnl).toBe(1000000 - 980000 - 50000);
    expect(week?.percent).toBeCloseTo(
      ((1000000 - 980000 - 50000) / (980000 + 50000)) * 100,
      5,
    );
  });

  it("markerer rekonstruert startpunkt og handler år", () => {
    const year = periodPnl(series, [], 1000000, "1y", now);
    expect(year?.fromDate).toBe("2025-08-05");
    expect(year?.pnl).toBe(200000);
    expect(year?.reconstructed).toBe(true);
  });

  it("returnerer null uten historikk langt nok tilbake", () => {
    expect(periodPnl([snap("2026-08-04", 1)], [], 1, "30d", now)).toBeNull();
  });
});
