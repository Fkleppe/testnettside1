import type { Holding } from "./types";

export type ReturnPeriod = 1 | 3 | 5 | 10;

export type FundReturnHistory = {
  name: string;
  symbols: string[];
  fee: number;
  returns: Partial<Record<ReturnPeriod, number>>;
  asOf: string;
  source: "Rentersrente / Morningstar" | "DNB";
};

export const FUND_RETURN_HISTORY: FundReturnHistory[] = [
  {
    name: "KLP AksjeGlobal Indeks P",
    symbols: ["NO0010776040", "KLP-GLOBAL-P"],
    fee: 0.18,
    returns: { 1: 12.8, 3: 14.1, 5: 13.8 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "DNB Global Indeks A",
    symbols: ["NO0010582984", "DNB-GLOBAL-A"],
    fee: 0.1,
    returns: { 1: 12.8, 3: 14, 5: 13.7, 10: 14.2 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "Storebrand Indeks – Alle Markeder A",
    symbols: ["NO0010611148"],
    fee: 0.3,
    returns: { 1: 16.6, 3: 14.7, 5: 13.4, 10: 14.1 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "Nordnet Global Indeks",
    symbols: ["IE00BMTD2J60", "NORDNET-GLOBAL"],
    fee: 0,
    returns: { 1: 15.9, 3: 14.5, 5: 13.9 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "Storebrand USA A NOK",
    symbols: ["SE0017911134"],
    fee: 0.2,
    returns: { 1: 16.3, 3: 15.2 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "KLP AksjeUSA Indeks P",
    symbols: ["NO0010768708", "KLP-USA-P"],
    fee: 0.2,
    returns: { 1: 16.4, 3: 16.2, 5: 15.5 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "DNB Teknologi A",
    symbols: ["NO0010337678"],
    fee: 0.85,
    returns: { 1: 23.2, 3: 24.2, 5: 19.5, 10: 22 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "DNB Fund – Disruptive Opportunities Retail A (N) NOK",
    symbols: ["LU2075955943"],
    fee: 0.91,
    returns: { 1: 25.68, 3: 35.02, 5: 12.02 },
    asOf: "3. august 2026",
    source: "DNB",
  },
  {
    name: "Nordnet Teknologi Indeks",
    symbols: ["IE00BNNLSM87", "NORDNET-TECH"],
    fee: 0.1,
    returns: { 1: 39.6, 3: 27.2, 5: 23.7 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "KLP AksjeNorge Indeks P",
    symbols: ["NO0010455694", "KLP-NORGE-P"],
    fee: 0.18,
    returns: { 1: 24.1, 3: 17.4, 5: 12, 10: 12.6 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "DNB Norge Indeks A",
    symbols: ["NO0010582976", "DNB-NORGE-A"],
    fee: 0.1,
    returns: { 1: 23.6, 3: 17, 5: 11.7, 10: 12.4 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "ODIN Norge C",
    symbols: ["NO0008000379", "ODIN-NORGE-C"],
    fee: 2,
    returns: { 1: 16.8, 3: 17.4, 5: 12, 10: 12.8 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "KLP AksjeFremvoksende Markeder Indeks P",
    symbols: ["NO0010611809", "KLP-EM-P"],
    fee: 0.28,
    returns: { 1: 31.6, 3: 16, 5: 8.9, 10: 11.2 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "SKAGEN Global A",
    symbols: ["NO0008004009", "SKAGEN-GLOBAL-A"],
    fee: 1,
    returns: { 1: -13.7, 3: 2.3, 5: 5.6, 10: 9.8 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "ODIN Global C",
    symbols: ["NO0010028988", "ODIN-GLOBAL-C"],
    fee: 2,
    returns: { 1: -7, 3: 2.5, 5: 5.1, 10: 9.8 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "Holberg Norden A",
    symbols: ["NO0010072945"],
    fee: 1.5,
    returns: { 1: -5.3, 3: 7.1, 5: 6, 10: 10.5 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "Storebrand Global Plus A",
    symbols: ["NO0010788292"],
    fee: 0.4,
    returns: { 1: 11.9, 3: 12.4, 5: 11.7 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "KLP Kort Horisont N",
    symbols: ["NO0012445560"],
    fee: 0.13,
    returns: { 1: 7.2, 3: 7.1 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "KLP Lang Horisont N",
    symbols: ["NO0012445545"],
    fee: 0.15,
    returns: { 1: 12.5, 3: 11.2 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "KLP Obligasjon 3 år P",
    symbols: ["NO0010272362"],
    fee: 0.1,
    returns: { 1: 3.4, 3: 4.6, 5: 2.2, 10: 2.2 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "KLP Likviditet P",
    symbols: ["NO0010272339"],
    fee: 0.1,
    returns: { 1: 4.7, 3: 5.1, 5: 3.7, 10: 2.5 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
  {
    name: "Storebrand Norsk Kreditt IG 20 A",
    symbols: ["NO0010818032"],
    fee: 0.3,
    returns: { 1: 3.3, 3: 5.1, 5: 2.2 },
    asOf: "juni 2026",
    source: "Rentersrente / Morningstar",
  },
];

const normalizedName = (value: string) =>
  value
    .toLocaleLowerCase("nb-NO")
    .replace(/[–—-]/g, " ")
    .replace(/[^a-z0-9æøå]+/g, " ")
    .trim();

export function findFundReturnHistory(holding: Holding) {
  const symbol = holding.symbol.toUpperCase();
  const name = normalizedName(holding.name);
  return FUND_RETURN_HISTORY.find(
    (fund) =>
      fund.symbols.some((candidate) => candidate.toUpperCase() === symbol) ||
      normalizedName(fund.name) === name,
  );
}

export function calculateHistoricalPortfolio(
  holdings: Holding[],
  period: ReturnPeriod,
  fallbackRate: number,
) {
  const totalValue = holdings.reduce(
    (sum, holding) => sum + holding.units * holding.price,
    0,
  );
  let coveredValue = 0;
  let weightedReturn = 0;
  const matched: Array<{
    name: string;
    value: number;
    annualReturn: number;
    fee: number;
    asOf: string;
    source: FundReturnHistory["source"];
  }> = [];

  for (const holding of holdings) {
    const fund = findFundReturnHistory(holding);
    const annualReturn = fund?.returns[period];
    if (!fund || annualReturn === undefined) continue;
    const value = holding.units * holding.price;
    coveredValue += value;
    weightedReturn += value * annualReturn;
    matched.push({
      name: holding.name,
      value,
      annualReturn,
      fee: fund.fee,
      asOf: fund.asOf,
      source: fund.source,
    });
  }

  const uncoveredValue = Math.max(0, totalValue - coveredValue);
  const historicalRate = coveredValue ? weightedReturn / coveredValue : null;
  const effectiveRate = totalValue
    ? (weightedReturn + uncoveredValue * fallbackRate) / totalValue
    : fallbackRate;

  return {
    totalValue,
    coveredValue,
    uncoveredValue,
    coveragePercent: totalValue ? (coveredValue / totalValue) * 100 : 0,
    historicalRate,
    effectiveRate,
    matched,
    unmatchedCount: Math.max(0, holdings.length - matched.length),
  };
}

export function projectValue(
  startValue: number,
  monthlySaving: number,
  annualReturn: number,
  years: number,
) {
  const months = Math.max(0, Math.round(years * 12));
  const boundedAnnualReturn = Math.max(-99, annualReturn) / 100;
  const monthlyRate = Math.pow(1 + boundedAnnualReturn, 1 / 12) - 1;
  const growth = Math.pow(1 + monthlyRate, months);
  const contributions =
    Math.abs(monthlyRate) < 0.000001
      ? monthlySaving * months
      : (monthlySaving * (growth - 1)) / monthlyRate;
  return Math.max(0, startValue * growth + contributions);
}

export function buildProjectionSeries(
  startValue: number,
  monthlySaving: number,
  annualReturn: number,
  years: number,
) {
  return Array.from({ length: Math.max(1, years) + 1 }, (_, year) => ({
    year,
    value: projectValue(startValue, monthlySaving, annualReturn, year),
  }));
}

export function buildProjectionPath(
  values: number[],
  width: number,
  height: number,
  maximum: number,
) {
  if (!values.length) return "";
  const safeMaximum = Math.max(1, maximum);
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - (Math.max(0, value) / safeMaximum) * height;
      return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}
