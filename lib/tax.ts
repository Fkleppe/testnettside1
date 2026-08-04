import type { Holding } from "./types";
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

export type TaxEstimateLine = {
  label: string;
  gain: number;
  loss: number;
  rate: number;
  tax: number;
  deduction: number;
};

export type TaxEstimate = {
  lines: TaxEstimateLine[];
  totalGain: number;
  totalLoss: number;
  totalTax: number;
  totalDeduction: number;
  net: number;
};

function rateFor(kind: Holding["kind"]) {
  return kind === "crypto" ? TAX_RATES.crypto : TAX_RATES.equity;
}

function labelFor(kind: Holding["kind"]) {
  if (kind === "crypto") return "Krypto (22 %)";
  if (kind === "stock") return "Aksjer (37,84 %)";
  return "Aksjefond (37,84 %)";
}

/**
 * Estimerer skatt hvis alt selges i dag. Skjermingsfradrag og eventuell
 * ASK/fondskonto-utsettelse er ikke medregnet — estimatet er derfor et
 * øvre anslag for gevinstskatten.
 */
export function estimateRealizationTax(holdings: Holding[]): TaxEstimate {
  const byKind = new Map<Holding["kind"], TaxEstimateLine>();
  for (const item of holdings) {
    const gain = holdingValue(item) - item.cost;
    const line = byKind.get(item.kind) ?? {
      label: labelFor(item.kind),
      gain: 0,
      loss: 0,
      rate: rateFor(item.kind),
      tax: 0,
      deduction: 0,
    };
    const next = {
      ...line,
      gain: line.gain + Math.max(0, gain),
      loss: line.loss + Math.min(0, gain),
    };
    byKind.set(item.kind, next);
  }
  const lines = [...byKind.values()].map((line) => {
    const netGain = line.gain + line.loss;
    return {
      ...line,
      tax: netGain > 0 ? netGain * line.rate : 0,
      deduction: netGain < 0 ? -netGain * line.rate : 0,
    };
  });
  const totalGain = lines.reduce((sum, line) => sum + line.gain, 0);
  const totalLoss = lines.reduce((sum, line) => sum + line.loss, 0);
  const totalTax = lines.reduce((sum, line) => sum + line.tax, 0);
  const totalDeduction = lines.reduce((sum, line) => sum + line.deduction, 0);
  return {
    lines,
    totalGain,
    totalLoss,
    totalTax,
    totalDeduction,
    net: totalGain + totalLoss - totalTax + totalDeduction,
  };
}
