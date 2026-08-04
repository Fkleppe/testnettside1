import type { PortfolioData } from "./storage";

export type RemoteSnapshot = {
  exists: boolean;
  savedAt: string | null;
  holdings: PortfolioData["holdings"];
  events: PortfolioData["events"];
};

export type MergeDecision =
  | { action: "keep-local"; pushLocal: boolean }
  | { action: "take-remote"; data: PortfolioData; backupLocal: boolean };

/**
 * Tapsfri flettepolicy: nyeste savedAt vinner i sin helhet, men en ikke-tom
 * taper skal alltid sikkerhetskopieres lokalt, og en tom side kan aldri
 * overskrive en ikke-tom.
 */
export function decideMerge(
  local: { savedAt: string | null; data: PortfolioData },
  remote: RemoteSnapshot | null,
): MergeDecision {
  const localEmpty = local.data.holdings.length === 0;
  const remoteEmpty = !remote?.exists || remote.holdings.length === 0;

  if (remoteEmpty) {
    return { action: "keep-local", pushLocal: !localEmpty };
  }
  const remoteData: PortfolioData = {
    holdings: remote!.holdings,
    events: remote!.events,
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
  return { action: "keep-local", pushLocal: true };
}

export async function fetchRemote(): Promise<RemoteSnapshot | null> {
  try {
    const response = await fetch("/api/portfolio", { cache: "no-store" });
    if (!response.ok) return null;
    const json = await response.json();
    if (!json.exists) {
      return { exists: false, savedAt: null, holdings: [], events: [] };
    }
    return {
      exists: true,
      savedAt: json.savedAt ?? null,
      holdings: Array.isArray(json.holdings) ? json.holdings : [],
      events: Array.isArray(json.events) ? json.events : [],
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
