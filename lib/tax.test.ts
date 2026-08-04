import { describe, expect, it } from "vitest";
import { estimateRealizationTax, TAX_RATES } from "./tax";
import type { Holding } from "./types";

function makeHolding(overrides: Partial<Holding>): Holding {
  return {
    id: "h",
    name: "Test",
    symbol: "T",
    kind: "stock",
    platform: "Nordnet",
    mode: "manual",
    units: 1,
    cost: 100,
    price: 100,
    dailyPercent: null,
    currency: "NOK",
    source: "test",
    updatedAt: "2026-08-04T08:00:00.000Z",
    ...overrides,
  };
}

describe("estimateRealizationTax", () => {
  it("taxes equity gains at 37.84 percent", () => {
    const estimate = estimateRealizationTax([
      makeHolding({ units: 10, price: 20, cost: 100 }),
    ]);
    expect(estimate.totalGain).toBe(100);
    expect(estimate.totalTax).toBeCloseTo(100 * TAX_RATES.equity);
  });

  it("taxes crypto gains at 22 percent", () => {
    const estimate = estimateRealizationTax([
      makeHolding({ kind: "crypto", units: 1, price: 200, cost: 100 }),
    ]);
    expect(estimate.totalTax).toBeCloseTo(100 * TAX_RATES.crypto);
  });

  it("nets losses against gains within same asset class", () => {
    const estimate = estimateRealizationTax([
      makeHolding({ id: "a", units: 1, price: 200, cost: 100 }),
      makeHolding({ id: "b", units: 1, price: 50, cost: 100 }),
    ]);
    expect(estimate.totalTax).toBeCloseTo(50 * TAX_RATES.equity);
  });

  it("turns a net loss into a deduction, not negative tax", () => {
    const estimate = estimateRealizationTax([
      makeHolding({ units: 1, price: 50, cost: 100 }),
    ]);
    expect(estimate.totalTax).toBe(0);
    expect(estimate.totalDeduction).toBeCloseTo(50 * TAX_RATES.equity);
  });

  it("handles an empty portfolio", () => {
    const estimate = estimateRealizationTax([]);
    expect(estimate.totalTax).toBe(0);
    expect(estimate.lines).toHaveLength(0);
  });
});
