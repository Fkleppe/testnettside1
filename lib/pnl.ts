import { localDateKey, type DailySnapshot } from "./history";
import type { PortfolioEvent } from "./types";

export type PnlPeriod = "7d" | "30d" | "1y" | "total";

export type PeriodPnl = {
  pnl: number;
  percent: number | null;
  fromDate: string;
  deposits: number;
  reconstructed: boolean;
};

const DAYS: Record<Exclude<PnlPeriod, "total">, number> = {
  "7d": 7,
  "30d": 30,
  "1y": 365,
};

/**
 * PnL over en periode, slik kryptobørsene regner det: verdiendring justert
 * for innskudd (kjøp) i perioden. Startpunkt = nyeste kjente porteføljeverdi
 * på eller før periodestart; finnes ingen, er perioden utilgjengelig.
 * Prosent måles mot innsatt kapital i perioden (startverdi + innskudd).
 */
export function periodPnl(
  snapshots: DailySnapshot[],
  events: PortfolioEvent[],
  currentValue: number,
  period: Exclude<PnlPeriod, "total">,
  now: Date = new Date(),
): PeriodPnl | null {
  const cutoff = localDateKey(
    new Date(now.getTime() - DAYS[period] * 86_400_000),
  );
  let start: DailySnapshot | null = null;
  for (const snapshot of snapshots) {
    if (snapshot.date > cutoff) break;
    start = snapshot;
  }
  if (!start) return null;
  const deposits = events
    .filter((event) => event.type === "buy" && event.date > start!.date)
    .reduce((sum, event) => sum + event.amount, 0);
  const pnl = currentValue - start.value - deposits;
  const basis = start.value + deposits;
  return {
    pnl,
    percent: basis > 0 ? (pnl / basis) * 100 : null,
    fromDate: start.date,
    deposits,
    reconstructed: start.origin === "rec",
  };
}
