import { describe, expect, it } from "vitest";
import { estimateSaleProceeds, SKJERMING_RATE, TAX_RATES } from "./tax";
import type { Holding, PortfolioEvent } from "./types";

const NOW = new Date(2026, 7, 5);

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

function buyEvent(holdingId: string, date: string): PortfolioEvent {
  return {
    id: `e-${holdingId}-${date}`,
    type: "opening",
    holdingId,
    holdingName: "Test",
    accountGroup: "private",
    date,
    createdAt: date,
    units: 1,
    price: 100,
    amount: 100,
  };
}

describe("estimateSaleProceeds", () => {
  it("skatter aksjegevinst 37,84 % uten skjerming når kjøpsår er ukjent", () => {
    const estimate = estimateSaleProceeds(
      [makeHolding({ units: 10, price: 20, cost: 100 })],
      [],
      {},
      NOW,
    );
    expect(estimate.taxNow).toBeCloseTo(100 * TAX_RATES.equity);
    expect(estimate.shielding).toBe(0);
    expect(estimate.unknownYears).toBe(true);
    expect(estimate.net).toBeCloseTo(200 - estimate.taxNow);
  });

  it("gir skjermingsfradrag per fullført eierår, aldri mer enn gevinsten", () => {
    const estimate = estimateSaleProceeds(
      [makeHolding({ id: "a", units: 1, price: 200, cost: 100 })],
      [buyEvent("a", "2024-03-01")],
      {},
      NOW,
    );
    const shield = 100 * SKJERMING_RATE * 2;
    expect(estimate.shielding).toBeCloseTo(shield);
    expect(estimate.taxNow).toBeCloseTo((100 - shield) * TAX_RATES.equity);

    const capped = estimateSaleProceeds(
      [makeHolding({ id: "b", units: 1, price: 100.5, cost: 100 })],
      [buyEvent("b", "2010-01-01")],
      {},
      NOW,
    );
    expect(capped.shielding).toBeCloseTo(0.5);
    expect(capped.taxNow).toBe(0);
  });

  it("ASK utsetter skatten i stedet for å utløse den", () => {
    const estimate = estimateSaleProceeds(
      [makeHolding({ wrapper: "ask", units: 1, price: 200, cost: 100 })],
      [],
      {},
      NOW,
    );
    expect(estimate.taxNow).toBe(0);
    expect(estimate.deferredTax).toBeCloseTo(100 * TAX_RATES.equity);
    expect(estimate.askValue).toBe(200);
    expect(estimate.net).toBe(200);
  });

  it("krypto: 22 %, ingen skjerming, ASK-flagg ignoreres", () => {
    const estimate = estimateSaleProceeds(
      [
        makeHolding({
          kind: "crypto",
          wrapper: "ask",
          units: 1,
          price: 200,
          cost: 100,
        }),
      ],
      [buyEvent("h", "2020-01-01")],
      {},
      NOW,
    );
    expect(estimate.taxNow).toBeCloseTo(100 * TAX_RATES.crypto);
    expect(estimate.shielding).toBe(0);
    expect(estimate.deferredTax).toBe(0);
  });

  it("salgsgebyr per plattform reduserer både gevinst og netto", () => {
    const estimate = estimateSaleProceeds(
      [makeHolding({ units: 1, price: 200, cost: 100 })],
      [],
      { Nordnet: 1 },
      NOW,
    );
    expect(estimate.fees).toBeCloseTo(2);
    expect(estimate.taxNow).toBeCloseTo(98 * TAX_RATES.equity);
    expect(estimate.net).toBeCloseTo(200 - 2 - estimate.taxNow);
  });

  it("netter tap mot gevinst per sats og gir fradrag ved netto tap", () => {
    const netted = estimateSaleProceeds(
      [
        makeHolding({ id: "a", units: 1, price: 200, cost: 100 }),
        makeHolding({ id: "b", units: 1, price: 50, cost: 100 }),
      ],
      [],
      {},
      NOW,
    );
    expect(netted.taxNow).toBeCloseTo(50 * TAX_RATES.equity);

    const loss = estimateSaleProceeds(
      [makeHolding({ units: 1, price: 50, cost: 100 })],
      [],
      {},
      NOW,
    );
    expect(loss.taxNow).toBe(0);
    expect(loss.deductionNow).toBeCloseTo(50 * TAX_RATES.equity);
    expect(loss.net).toBe(50);
  });
});
