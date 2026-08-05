import type { AccountGroup, Holding } from "./types";
import { holdingValue } from "./portfolio";

export type SnapshotGroupTotals = { value: number; cost: number };

/** Ett datapunkt per kalenderdag: porteføljens sist observerte verdi den
 *  dagen. `origin: "rec"` = rekonstruert fra kurshistorikk (dagens enheter ×
 *  historisk kurs); uten origin = ekte observasjon. */
export type DailySnapshot = {
  date: string;
  capturedAt: string;
  value: number;
  cost: number;
  groups: Partial<Record<AccountGroup, SnapshotGroupTotals>>;
  origin?: "rec";
};

export type HistoryRange = "1w" | "1m" | "3m" | "1y" | "max";

/** ~10 år med daglige punkter; eldste beskjæres først. */
export const SNAPSHOT_LIMIT = 3700;

const RANGE_DAYS: Record<Exclude<HistoryRange, "max">, number> = {
  "1w": 7,
  "1m": 31,
  "3m": 92,
  "1y": 366,
};

export function localDateKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const round = (value: number) => Math.round(value * 100) / 100;

function buildSnapshot(holdings: Holding[], now: Date): DailySnapshot {
  const groups: Partial<Record<AccountGroup, SnapshotGroupTotals>> = {};
  let value = 0;
  let cost = 0;
  for (const item of holdings) {
    const itemValue = holdingValue(item);
    value += itemValue;
    cost += item.cost;
    const account = item.accountGroup ?? "private";
    const existing = groups[account] ?? { value: 0, cost: 0 };
    groups[account] = {
      value: round(existing.value + itemValue),
      cost: round(existing.cost + item.cost),
    };
  }
  return {
    date: localDateKey(now),
    capturedAt: now.toISOString(),
    value: round(value),
    cost: round(cost),
    groups,
  };
}

function sameNumbers(a: DailySnapshot, b: DailySnapshot) {
  if (a.value !== b.value || a.cost !== b.cost) return false;
  const accounts = new Set([
    ...Object.keys(a.groups),
    ...Object.keys(b.groups),
  ]) as Set<AccountGroup>;
  for (const account of accounts) {
    const left = a.groups[account];
    const right = b.groups[account];
    if (!left || !right) return false;
    if (left.value !== right.value || left.cost !== right.cost) return false;
  }
  return true;
}

/**
 * Oppdaterer dagens datapunkt med porteføljens nåværende verdi. Returnerer
 * samme array-referanse når ingenting er endret, slik at kallere trygt kan
 * bruke resultatet i setState uten re-render-løkker.
 */
export function upsertDailySnapshot(
  snapshots: DailySnapshot[],
  holdings: Holding[],
  now: Date,
): DailySnapshot[] {
  if (holdings.length === 0) return snapshots;
  const next = buildSnapshot(holdings, now);
  const existingIndex = snapshots.findIndex((item) => item.date === next.date);
  // Halvlastet-vakt: et ekte markedsfall endrer aldri KOSTPRISEN. Kollapser
  // både verdi OG kost mot et allerede lagret punkt samme dag, er
  // beholdningslisten ufullstendig (delvis synk/lasting) — behold det gode
  // punktet. Bevisste salg rammes ikke: neste dag aksepteres ny virkelighet.
  if (existingIndex >= 0) {
    const existing = snapshots[existingIndex];
    if (
      existing.origin !== "rec" &&
      existing.cost > 0 &&
      next.cost < existing.cost * 0.6 &&
      next.value < existing.value * 0.6
    ) {
      return snapshots;
    }
  }
  if (existingIndex >= 0 && sameNumbers(snapshots[existingIndex], next)) {
    return snapshots;
  }
  const merged =
    existingIndex >= 0
      ? snapshots.map((item, index) => (index === existingIndex ? next : item))
      : [...snapshots, next].sort((a, b) => (a.date < b.date ? -1 : 1));
  return merged.length > SNAPSHOT_LIMIT
    ? merged.slice(merged.length - SNAPSHOT_LIMIT)
    : merged;
}

/**
 * Tapsfri union per dato mellom to enheter/kilder; nyeste capturedAt vinner
 * ved konflikt. Returnerer `a` uendret (samme referanse) når `b` ikke
 * tilfører noe.
 */
export function mergeSnapshots(
  a: DailySnapshot[],
  b: DailySnapshot[],
): DailySnapshot[] {
  if (b.length === 0) return a;
  const byDate = new Map(a.map((item) => [item.date, item]));
  let changed = false;
  for (const incoming of b) {
    const current = byDate.get(incoming.date);
    if (!current) {
      byDate.set(incoming.date, incoming);
      changed = true;
    } else if (incoming.capturedAt > current.capturedAt) {
      byDate.set(incoming.date, incoming);
      changed = true;
    }
  }
  if (!changed) return a;
  const merged = [...byDate.values()].sort((x, y) => (x.date < y.date ? -1 : 1));
  return merged.length > SNAPSHOT_LIMIT
    ? merged.slice(merged.length - SNAPSHOT_LIMIT)
    : merged;
}

export function filterRange<T extends { date: string }>(
  snapshots: T[],
  range: HistoryRange,
  now: Date,
): T[] {
  if (range === "max") return snapshots;
  const cutoff = new Date(now.getTime() - RANGE_DAYS[range] * 86_400_000);
  const cutoffKey = localDateKey(cutoff);
  return snapshots.filter((item) => item.date >= cutoffKey);
}

export type HistoryPoint = {
  date: string;
  value: number;
  cost: number;
  origin?: "rec";
};

/** Tidsserie for valgt konto; dager uten data for kontoen utelates. */
export function snapshotPoints(
  snapshots: DailySnapshot[],
  account: "all" | AccountGroup,
): HistoryPoint[] {
  if (account === "all") {
    return snapshots.map(({ date, value, cost, origin }) => ({
      date,
      value,
      cost,
      origin,
    }));
  }
  const points: HistoryPoint[] = [];
  for (const item of snapshots) {
    const group = item.groups[account];
    if (group) {
      points.push({
        date: item.date,
        value: group.value,
        cost: group.cost,
        origin: item.origin,
      });
    }
  }
  return points;
}
