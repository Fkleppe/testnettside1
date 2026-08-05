import type { Holding, PortfolioEvent } from "./types";
import { holdingValue } from "./portfolio";

/**
 * Norske skattesatser for kapitalgevinst. Aksjer og aksjefond oppjusteres med
 * faktor 1,72 før 22 %-satsen: 22 % × 1,72 = 37,84 %. Krypto beskattes som
 * alminnelig kapitalinntekt uten oppjustering.
 */
export const TAX_RATES = {
  equity: 0.3784,
  crypto: 0.22,
} as const;

/** Skjermingsrente for inntektsåret 2025 — siste kunngjorte sats fra
 *  Skatteetaten (2026-satsen fastsettes januar 2027). */
export const SKJERMING_RATE = 0.035;

export type SaleFees = Record<string, number>;

export type SaleEstimate = {
  gross: number;
  fees: number;
  /** Skjermingsfradrag brukt mot gevinst utenfor ASK. */
  shielding: number;
  /** Skatt som utløses ved salg i dag (utenfor ASK). */
  taxNow: number;
  /** Skatteverdi av netto tap — kommer til fradrag, utbetales ikke ved salget. */
  deductionNow: number;
  /** Latent skatt på gevinst i ASK — utløses først ved uttak utover innskudd. */
  deferredTax: number;
  askValue: number;
  /** Netto utbetalt i dag: brutto − gebyrer − skatt som utløses. */
  net: number;
  /** true når minst én beholdning mangler kjøpshendelse — skjermingsår settes
   *  da konservativt til 0 for den beholdningen. */
  unknownYears: boolean;
};

function firstPurchaseYears(events: PortfolioEvent[]): Map<string, number> {
  const byHolding = new Map<string, number>();
  for (const event of events) {
    const year = new Date(event.date).getFullYear();
    if (!Number.isFinite(year)) continue;
    const current = byHolding.get(event.holdingId);
    if (current === undefined || year < current) {
      byHolding.set(event.holdingId, year);
    }
  }
  return byHolding;
}

/**
 * Estimerer hva et fullt salg i dag gir: brutto verdi, salgsgebyrer per
 * plattform, skjermingsfradrag (kostpris × skjermingsrente × hele eierår —
 * skjerming tildeles per 31.12, så salgsåret gir ingen skjerming), skatt som
 * utløses nå, og utsatt skatt for beholdninger i aksjesparekonto (ASK).
 * Gebyrer trekkes fra utgangsverdien før gevinstberegning (omkostninger ved
 * salg er fradragsberettiget). Tap samordnes mot gevinst per sats.
 */
export function estimateSaleProceeds(
  holdings: Holding[],
  events: PortfolioEvent[],
  saleFees: SaleFees = {},
  now: Date = new Date(),
): SaleEstimate {
  const currentYear = now.getFullYear();
  const purchaseYears = firstPurchaseYears(events);
  const buckets = new Map<number, number>();
  let gross = 0;
  let fees = 0;
  let shielding = 0;
  let deferredTax = 0;
  let askValue = 0;
  let unknownYears = false;

  for (const item of holdings) {
    const value = holdingValue(item);
    const fee = value * ((saleFees[item.platform] ?? 0) / 100);
    gross += value;
    fees += fee;

    const gain = value - fee - item.cost;
    const rate = item.kind === "crypto" ? TAX_RATES.crypto : TAX_RATES.equity;
    const inAsk = item.wrapper === "ask" && item.kind !== "crypto";

    let shield = 0;
    if (item.kind !== "crypto" && gain > 0) {
      const firstYear = purchaseYears.get(item.id);
      if (firstYear === undefined) {
        unknownYears = true;
      } else {
        const years = Math.max(0, currentYear - firstYear);
        shield = Math.min(gain, item.cost * SKJERMING_RATE * years);
      }
    }

    if (inAsk) {
      askValue += value;
      const taxable = gain - shield;
      if (taxable > 0) deferredTax += taxable * rate;
      continue;
    }
    shielding += shield;
    buckets.set(rate, (buckets.get(rate) ?? 0) + gain - shield);
  }

  let taxNow = 0;
  let deductionNow = 0;
  for (const [rate, netTaxable] of buckets) {
    if (netTaxable > 0) taxNow += netTaxable * rate;
    else deductionNow += -netTaxable * rate;
  }

  return {
    gross,
    fees,
    shielding,
    taxNow,
    deductionNow,
    deferredTax,
    askValue,
    net: gross - fees - taxNow,
    unknownYears,
  };
}
