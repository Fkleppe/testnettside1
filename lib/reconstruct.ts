import type { DailySnapshot, SnapshotGroupTotals } from "./history";
import type { AccountGroup, Holding } from "./types";

export type PriceSeries = Map<string, { date: string; price: number }[]>;

/** Rekonstruerte punkter merkes og taper alltid for observerte punkter:
 *  capturedAt settes til epoch slik at nyeste-vinner-fletting aldri lar en
 *  rekonstruksjon overskrive en ekte observasjon. */
export const RECONSTRUCTED_CAPTURED_AT = "1970-01-01T00:00:00.000Z";

const MAX_FFILL_DAYS = 7;
const MIN_VALUE_COVERAGE = 0.9;

const round = (value: number) => Math.round(value * 100) / 100;

function toTime(date: string) {
  return Date.parse(`${date}T00:00:00Z`);
}

/**
 * Rekonstruerer daglig porteføljeverdi fra dagens beholdning × historiske
 * kurser. Ærlighetsregler: (1) kun datoer der kurser dekker minst 90 % av
 * porteføljens nåverdi tas med, (2) hull frem-fylles maks sju dager,
 * (3) datoer med ekte observasjoner utelates — de eies av capture-løpet.
 */
export function reconstructSnapshots(
  holdings: Holding[],
  series: PriceSeries,
  observedDates: Set<string>,
): DailySnapshot[] {
  if (holdings.length === 0) return [];
  const currentTotal = holdings.reduce(
    (sum, item) => sum + item.units * item.price,
    0,
  );
  if (currentTotal <= 0) return [];

  const sortedBySymbol = new Map(
    [...series.entries()].map(([symbol, points]) => [
      symbol,
      [...points].sort((a, b) => (a.date < b.date ? -1 : 1)),
    ]),
  );
  const allDates = new Set<string>();
  for (const points of sortedBySymbol.values()) {
    for (const point of points) allDates.add(point.date);
  }

  const result: DailySnapshot[] = [];
  for (const date of [...allDates].sort()) {
    if (observedDates.has(date)) continue;
    const time = toTime(date);
    let value = 0;
    let cost = 0;
    let coveredCurrentValue = 0;
    const groups: Partial<Record<AccountGroup, SnapshotGroupTotals>> = {};
    for (const item of holdings) {
      const points = sortedBySymbol.get(item.symbol.toUpperCase());
      if (!points || points.length === 0) continue;
      // Siste kurs på eller før datoen, maks MAX_FFILL_DAYS gammel.
      let picked: { date: string; price: number } | null = null;
      for (const point of points) {
        if (toTime(point.date) > time) break;
        picked = point;
      }
      if (!picked) continue;
      if (time - toTime(picked.date) > MAX_FFILL_DAYS * 86_400_000) continue;
      const itemValue = item.units * picked.price;
      value += itemValue;
      cost += item.cost;
      coveredCurrentValue += item.units * item.price;
      const account = item.accountGroup ?? "private";
      const existing = groups[account] ?? { value: 0, cost: 0 };
      groups[account] = {
        value: round(existing.value + itemValue),
        cost: round(existing.cost + item.cost),
      };
    }
    if (coveredCurrentValue / currentTotal < MIN_VALUE_COVERAGE) continue;
    result.push({
      date,
      capturedAt: RECONSTRUCTED_CAPTURED_AT,
      value: round(value),
      cost: round(cost),
      groups,
      origin: "rec",
    });
  }
  return result;
}

/**
 * Bytter ut all tidligere rekonstruksjon med en ny, uten å røre observerte
 * punkter. Returnerer samme referanse hvis ingenting endres.
 */
export function applyReconstruction(
  existing: DailySnapshot[],
  reconstructed: DailySnapshot[],
): DailySnapshot[] {
  const observed = existing.filter((item) => item.origin !== "rec");
  const observedDates = new Set(observed.map((item) => item.date));
  const fresh = reconstructed.filter((item) => !observedDates.has(item.date));
  const next = [...observed, ...fresh].sort((a, b) =>
    a.date < b.date ? -1 : 1,
  );
  if (
    next.length === existing.length &&
    next.every(
      (item, index) =>
        item.date === existing[index].date &&
        item.value === existing[index].value &&
        item.origin === existing[index].origin,
    )
  ) {
    return existing;
  }
  return next;
}
