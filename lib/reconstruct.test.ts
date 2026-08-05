import { describe, expect, it } from "vitest";
import {
  applyReconstruction,
  reconstructSnapshots,
  RECONSTRUCTED_CAPTURED_AT,
  type PriceSeries,
} from "./reconstruct";
import type { DailySnapshot } from "./history";
import type { Holding } from "./types";

const holding = (
  id: string,
  symbol: string,
  units: number,
  price: number,
): Holding => ({
  id,
  name: id,
  symbol,
  kind: "fund",
  platform: "Test",
  mode: "automatic",
  units,
  cost: units * price * 0.8,
  price,
  dailyPercent: null,
  currency: "NOK",
  source: "test",
  updatedAt: "2026-08-05T08:00:00.000Z",
});

describe("reconstructSnapshots", () => {
  const holdings = [holding("a", "AAA", 10, 100), holding("b", "BBB", 5, 200)];
  const series: PriceSeries = new Map([
    [
      "AAA",
      [
        { date: "2026-08-01", price: 90 },
        { date: "2026-08-02", price: 95 },
        { date: "2026-08-03", price: 100 },
      ],
    ],
    [
      "BBB",
      [
        { date: "2026-08-01", price: 190 },
        { date: "2026-08-03", price: 200 },
      ],
    ],
  ]);

  it("beregner enheter × historisk kurs per dag, med frem-fylling", () => {
    const result = reconstructSnapshots(holdings, series, new Set());
    expect(result.map((item) => item.date)).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ]);
    expect(result[0].value).toBe(10 * 90 + 5 * 190);
    // 02.08: BBB frem-fylles fra 01.08
    expect(result[1].value).toBe(10 * 95 + 5 * 190);
    expect(result[2].value).toBe(10 * 100 + 5 * 200);
    expect(result.every((item) => item.origin === "rec")).toBe(true);
    expect(
      result.every((item) => item.capturedAt === RECONSTRUCTED_CAPTURED_AT),
    ).toBe(true);
  });

  it("utelater datoer som er observert, og datoer med for lav dekning", () => {
    const result = reconstructSnapshots(
      holdings,
      series,
      new Set(["2026-08-02"]),
    );
    expect(result.map((item) => item.date)).toEqual([
      "2026-08-01",
      "2026-08-03",
    ]);
    // BBB (halve verdien) mangler helt → dekning < 90 % → ingen punkter
    const onlyA: PriceSeries = new Map([["AAA", series.get("AAA")!]]);
    expect(reconstructSnapshots(holdings, onlyA, new Set())).toHaveLength(0);
  });
});

describe("applyReconstruction", () => {
  const observed: DailySnapshot = {
    date: "2026-08-03",
    capturedAt: "2026-08-03T18:00:00.000Z",
    value: 1500,
    cost: 1200,
    groups: {},
  };
  const rec = (date: string, value = 1000): DailySnapshot => ({
    date,
    capturedAt: RECONSTRUCTED_CAPTURED_AT,
    value,
    cost: 800,
    groups: {},
    origin: "rec",
  });

  it("erstatter gammel rekonstruksjon men bevarer observasjoner", () => {
    const existing = [rec("2026-08-01", 111), observed];
    const next = applyReconstruction(existing, [
      rec("2026-08-01", 999),
      rec("2026-08-02"),
      rec("2026-08-03", 777),
    ]);
    expect(next.map((item) => `${item.date}:${item.value}`)).toEqual([
      "2026-08-01:999",
      "2026-08-02:1000",
      "2026-08-03:1500",
    ]);
  });

  it("er referansestabil uten endringer", () => {
    const existing = [rec("2026-08-01"), observed];
    expect(
      applyReconstruction(existing, [rec("2026-08-01")]),
    ).toBe(existing);
  });
});
