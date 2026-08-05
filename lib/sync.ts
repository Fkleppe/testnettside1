import { mergeSnapshots, type DailySnapshot } from "./history";
import { pickGoal } from "./storage";
import type { PortfolioData } from "./storage";
import type { Holding, SavingsGoal } from "./types";

/**
 * Kursferskhet er MONOTON: når fjernkopien vinner flettingen, beholdes
 * likevel lokale kursfelter per beholdning hvis lokal kursdato er nyere.
 * Hindrer at en fane/enhet med gammel bundle ruller kursene bakover og
 * skaper synlig flapping mellom stale og fersk.
 */
export function mergeFreshPrices(
  remote: Holding[],
  local: Holding[],
): Holding[] {
  const localById = new Map(local.map((item) => [item.id, item]));
  let changed = false;
  const merged = remote.map((item) => {
    const mine = localById.get(item.id);
    if (!mine?.priceDate) return item;
    if (item.priceDate && item.priceDate >= mine.priceDate) return item;
    changed = true;
    return {
      ...item,
      price: mine.price,
      previousPrice: mine.previousPrice,
      dailyPercent: mine.dailyPercent,
      changePeriod: mine.changePeriod,
      priceAsOf: mine.priceAsOf,
      priceDate: mine.priceDate,
      source: mine.source,
      updatedAt: mine.updatedAt,
      quoteStatus: mine.quoteStatus,
    };
  });
  return changed ? merged : remote;
}

export type RemoteSnapshot = {
  exists: boolean;
  savedAt: string | null;
  holdings: PortfolioData["holdings"];
  events: PortfolioData["events"];
  snapshots: DailySnapshot[];
  goal: SavingsGoal | null;
};

export type MergeDecision =
  | {
      action: "keep-local";
      pushLocal: boolean;
      snapshots: DailySnapshot[];
      goal: SavingsGoal | null;
    }
  | { action: "take-remote"; data: PortfolioData; backupLocal: boolean };

/**
 * Tapsfri flettepolicy: nyeste savedAt vinner i sin helhet, men en ikke-tom
 * taper skal alltid sikkerhetskopieres lokalt, og en tom side kan aldri
 * overskrive en ikke-tom. Historikk-snapshots unionsflettes alltid per dato
 * uansett hvilken side som vinner, så ingen enhet mister dager den alene har
 * observert.
 */
export function decideMerge(
  local: { savedAt: string | null; data: PortfolioData },
  remote: RemoteSnapshot | null,
): MergeDecision {
  const localEmpty = local.data.holdings.length === 0;
  const remoteEmpty = !remote?.exists || remote.holdings.length === 0;
  const snapshots = mergeSnapshots(
    local.data.snapshots,
    remote?.exists ? remote.snapshots : [],
  );
  const goal = pickGoal(local.data.goal, remote?.exists ? remote.goal : null);

  if (remoteEmpty) {
    return { action: "keep-local", pushLocal: !localEmpty, snapshots, goal };
  }
  const remoteData: PortfolioData = {
    holdings: remote!.holdings,
    events: remote!.events,
    snapshots,
    goal,
  };
  if (localEmpty) {
    return { action: "take-remote", data: remoteData, backupLocal: false };
  }
  const remoteNewer =
    local.savedAt === null ||
    (remote!.savedAt !== null && remote!.savedAt > local.savedAt);
  if (remoteNewer) {
    return { action: "take-remote", data: remoteData, backupLocal: true };
  }
  return { action: "keep-local", pushLocal: true, snapshots, goal };
}

export async function fetchRemote(): Promise<RemoteSnapshot | null> {
  try {
    const response = await fetch("/api/portfolio", { cache: "no-store" });
    if (!response.ok) return null;
    const json = await response.json();
    if (!json.exists) {
      return {
        exists: false,
        savedAt: null,
        holdings: [],
        events: [],
        snapshots: [],
        goal: null,
      };
    }
    return {
      exists: true,
      savedAt: json.savedAt ?? null,
      holdings: Array.isArray(json.holdings) ? json.holdings : [],
      events: Array.isArray(json.events) ? json.events : [],
      snapshots: Array.isArray(json.snapshots) ? json.snapshots : [],
      goal: json.goal ?? null,
    };
  } catch {
    return null;
  }
}

export async function pushRemote(
  savedAt: string,
  data: PortfolioData,
): Promise<boolean> {
  try {
    const response = await fetch("/api/portfolio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ savedAt, ...data }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
