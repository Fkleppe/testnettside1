import { z } from "zod";
import type { DailySnapshot } from "./history";
import type { Holding, PortfolioEvent } from "./types";

const DATA_KEY = "min-sparing-data-v2";
const LEGACY_HOLDINGS_KEY = "min-sparing-holdings-v1";
const LEGACY_EVENTS_KEY = "min-sparing-events-v1";
const BACKUP_PREFIX = "min-sparing-backup-";
const CORRUPT_PREFIX = "min-sparing-corrupt-";
const BACKUP_LIMIT = 14;
const BACKUP_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

const holdingSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    symbol: z.string(),
    kind: z.enum(["fund", "stock", "crypto"]),
    platform: z.string(),
    mode: z.enum(["automatic", "manual"]),
    units: z.number().finite(),
    cost: z.number().finite(),
    price: z.number().finite(),
    previousPrice: z.number().finite().optional(),
    dailyPercent: z.number().finite().nullable(),
    changePeriod: z.enum(["day", "24h"]).optional(),
    currency: z.string(),
    source: z.string(),
    updatedAt: z.string(),
    priceDate: z.string().optional(),
    quoteStatus: z.string().optional(),
    priceAsOf: z.string().optional(),
    delayed: z.boolean().optional(),
    accountGroup: z.enum(["private", "business", "family", "pension"]).optional(),
  })
  .passthrough();

const eventSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["opening", "buy"]),
    holdingId: z.string(),
    holdingName: z.string(),
    accountGroup: z.enum(["private", "business", "family", "pension"]),
    date: z.string(),
    createdAt: z.string(),
    units: z.number().finite(),
    price: z.number().finite(),
    amount: z.number().finite(),
    note: z.string().optional(),
  })
  .passthrough();

const snapshotSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    capturedAt: z.string(),
    value: z.number().finite(),
    cost: z.number().finite(),
    groups: z
      .record(
        z.string(),
        z.object({
          value: z.number().finite(),
          cost: z.number().finite(),
        }),
      )
      .optional(),
  })
  .passthrough();

const envelopeSchema = z.object({
  v: z.literal(2),
  savedAt: z.string(),
  holdings: z.array(z.unknown()),
  events: z.array(z.unknown()),
  snapshots: z.array(z.unknown()).optional(),
});

export type PortfolioData = {
  holdings: Holding[];
  events: PortfolioEvent[];
  snapshots: DailySnapshot[];
};

export type LoadResult =
  | { status: "empty" }
  | {
      status: "ok" | "recovered-legacy";
      data: PortfolioData;
      savedAt: string | null;
      droppedItems: number;
    }
  | { status: "corrupt"; corruptKey: string };

export type BackupEntry = {
  key: string;
  savedAt: string;
  holdingsCount: number;
};

type StorageLike = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;

function storageKeys(store: StorageLike) {
  const keys: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key) keys.push(key);
  }
  return keys;
}

function salvageItems<T>(
  rawItems: unknown[],
  schema: typeof holdingSchema | typeof eventSchema,
) {
  const valid: T[] = [];
  let dropped = 0;
  for (const item of rawItems) {
    const parsed = schema.safeParse(item);
    if (parsed.success) valid.push(parsed.data as T);
    else dropped += 1;
  }
  return { valid, dropped };
}

/** Ugyldige snapshots droppes stille — de er avledet data og gater aldri
 *  korrupt-status slik beholdninger gjør. Manglende groups normaliseres. */
function salvageSnapshots(rawItems: unknown[] | undefined): DailySnapshot[] {
  if (!rawItems) return [];
  const valid: DailySnapshot[] = [];
  for (const item of rawItems) {
    const parsed = snapshotSchema.safeParse(item);
    if (parsed.success) {
      valid.push({ groups: {}, ...parsed.data } as DailySnapshot);
    }
  }
  return valid;
}

function preserveCorrupt(store: StorageLike, raw: string, now: Date) {
  const corruptKey = `${CORRUPT_PREFIX}${now.toISOString()}`;
  try {
    store.setItem(corruptKey, raw);
  } catch {
    return corruptKey;
  }
  return corruptKey;
}

/**
 * Loads portfolio data without ever discarding what it cannot read: broken
 * payloads are copied to a corrupt-key before the caller decides what to do.
 */
export function loadPortfolio(
  store: StorageLike,
  now: Date = new Date(),
): LoadResult {
  const rawV2 = store.getItem(DATA_KEY);
  if (rawV2) {
    try {
      const envelope = envelopeSchema.parse(JSON.parse(rawV2));
      const holdings = salvageItems<Holding>(envelope.holdings, holdingSchema);
      const events = salvageItems<PortfolioEvent>(envelope.events, eventSchema);
      if (holdings.valid.length === 0 && envelope.holdings.length > 0) {
        return { status: "corrupt", corruptKey: preserveCorrupt(store, rawV2, now) };
      }
      if (holdings.dropped > 0 || events.dropped > 0) {
        preserveCorrupt(store, rawV2, now);
      }
      return {
        status: "ok",
        data: {
          holdings: holdings.valid,
          events: events.valid,
          snapshots: salvageSnapshots(envelope.snapshots),
        },
        savedAt: envelope.savedAt,
        droppedItems: holdings.dropped + events.dropped,
      };
    } catch {
      return { status: "corrupt", corruptKey: preserveCorrupt(store, rawV2, now) };
    }
  }

  const rawLegacyHoldings = store.getItem(LEGACY_HOLDINGS_KEY);
  if (rawLegacyHoldings) {
    try {
      const parsedHoldings = JSON.parse(rawLegacyHoldings);
      if (!Array.isArray(parsedHoldings)) throw new Error("not an array");
      const holdings = salvageItems<Holding>(parsedHoldings, holdingSchema);
      if (holdings.valid.length === 0 && parsedHoldings.length > 0) {
        return {
          status: "corrupt",
          corruptKey: preserveCorrupt(store, rawLegacyHoldings, now),
        };
      }
      let events: PortfolioEvent[] = [];
      const rawLegacyEvents = store.getItem(LEGACY_EVENTS_KEY);
      if (rawLegacyEvents) {
        try {
          const parsedEvents = JSON.parse(rawLegacyEvents);
          if (Array.isArray(parsedEvents)) {
            events = salvageItems<PortfolioEvent>(parsedEvents, eventSchema).valid;
          }
        } catch {
          preserveCorrupt(store, rawLegacyEvents, now);
        }
      }
      return {
        status: "recovered-legacy",
        data: { holdings: holdings.valid, events, snapshots: [] },
        savedAt: null,
        droppedItems: holdings.dropped,
      };
    } catch {
      return {
        status: "corrupt",
        corruptKey: preserveCorrupt(store, rawLegacyHoldings, now),
      };
    }
  }

  return { status: "empty" };
}

/**
 * Persists data. If the stored payload was written by another tab after this
 * tab loaded (savedAt newer than lastSeenSavedAt), the other tab's payload is
 * backed up before being overwritten so nothing is silently lost.
 */
export function savePortfolio(
  store: StorageLike,
  data: PortfolioData,
  options: { lastSeenSavedAt: string | null; now?: Date },
): string {
  const now = options.now ?? new Date();
  const existingRaw = store.getItem(DATA_KEY);
  if (existingRaw) {
    try {
      const existing = envelopeSchema.parse(JSON.parse(existingRaw));
      const isForeignWrite =
        options.lastSeenSavedAt !== null &&
        existing.savedAt > options.lastSeenSavedAt;
      if (isForeignWrite) {
        store.setItem(`${BACKUP_PREFIX}conflict-${existing.savedAt}`, existingRaw);
      }
    } catch {
      preserveCorrupt(store, existingRaw, now);
    }
  }
  const savedAt = now.toISOString();
  const envelope = { v: 2 as const, savedAt, ...data };
  store.setItem(DATA_KEY, JSON.stringify(envelope));
  writeRollingBackup(store, envelope, now);
  return savedAt;
}

function writeRollingBackup(
  store: StorageLike,
  envelope: { savedAt: string; holdings: unknown[]; events: unknown[] },
  now: Date,
) {
  if (envelope.holdings.length === 0) return;
  const backups = listBackups(store);
  const newest = backups[0];
  if (
    newest &&
    now.getTime() - Date.parse(newest.savedAt) < BACKUP_MIN_INTERVAL_MS
  ) {
    return;
  }
  try {
    store.setItem(
      `${BACKUP_PREFIX}${envelope.savedAt}`,
      JSON.stringify(envelope),
    );
  } catch {
    return;
  }
  const all = listBackups(store);
  for (const stale of all.slice(BACKUP_LIMIT)) {
    store.removeItem(stale.key);
  }
}

/** Eksplisitt backup av gjeldende lagrede data, utenom 6-timersintervallet.
 *  Brukes rett før import/synk erstatter porteføljen. */
export function backupCurrent(store: StorageLike, label: string) {
  const raw = store.getItem(DATA_KEY);
  if (!raw) return;
  try {
    const envelope = envelopeSchema.parse(JSON.parse(raw));
    if (envelope.holdings.length === 0) return;
    store.setItem(`${BACKUP_PREFIX}${label}-${envelope.savedAt}`, raw);
  } catch {
    preserveCorrupt(store, raw, new Date());
  }
}

export function listBackups(store: StorageLike): BackupEntry[] {
  const entries: BackupEntry[] = [];
  for (const key of storageKeys(store)) {
    if (!key.startsWith(BACKUP_PREFIX)) continue;
    const raw = store.getItem(key);
    if (!raw) continue;
    try {
      const envelope = envelopeSchema.parse(JSON.parse(raw));
      entries.push({
        key,
        savedAt: envelope.savedAt,
        holdingsCount: envelope.holdings.length,
      });
    } catch {
      // Unreadable backups are listed last rather than deleted.
      entries.push({ key, savedAt: "", holdingsCount: 0 });
    }
  }
  return entries.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export function restoreBackup(
  store: StorageLike,
  key: string,
): PortfolioData | null {
  const raw = store.getItem(key);
  if (!raw) return null;
  try {
    const envelope = envelopeSchema.parse(JSON.parse(raw));
    const holdings = salvageItems<Holding>(envelope.holdings, holdingSchema);
    const events = salvageItems<PortfolioEvent>(envelope.events, eventSchema);
    if (holdings.valid.length === 0 && envelope.holdings.length > 0) return null;
    return {
      holdings: holdings.valid,
      events: events.valid,
      snapshots: salvageSnapshots(envelope.snapshots),
    };
  } catch {
    return null;
  }
}

export function exportPortfolioJson(data: PortfolioData, now: Date = new Date()) {
  return JSON.stringify(
    { v: 2, savedAt: now.toISOString(), exportedFrom: "minsparing", ...data },
    null,
    2,
  );
}

const importSchema = z.object({
  holdings: z.array(z.unknown()),
  events: z.array(z.unknown()).optional(),
  snapshots: z.array(z.unknown()).optional(),
});

export type ImportResult =
  | { ok: true; data: PortfolioData; droppedItems: number }
  | { ok: false; error: string };

export function parseImportedJson(text: string): ImportResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "Filen er ikke gyldig JSON." };
  }
  const root = importSchema.safeParse(
    Array.isArray(json) ? { holdings: json, events: [] } : json,
  );
  if (!root.success) {
    return {
      ok: false,
      error: "Fant ingen «holdings»-liste i filen.",
    };
  }
  const holdings = salvageItems<Holding>(root.data.holdings, holdingSchema);
  const events = salvageItems<PortfolioEvent>(root.data.events ?? [], eventSchema);
  if (holdings.valid.length === 0) {
    return { ok: false, error: "Ingen gyldige beholdninger i filen." };
  }
  return {
    ok: true,
    data: {
      holdings: holdings.valid,
      events: events.valid,
      snapshots: salvageSnapshots(root.data.snapshots),
    },
    droppedItems: holdings.dropped + events.dropped,
  };
}

/** Validerer utenfra-kommende porteføljedata (synk/API) med item-salvage. */
export function validatePortfolioData(input: unknown):
  | { ok: true; data: PortfolioData; droppedItems: number }
  | { ok: false; error: string } {
  const root = importSchema.safeParse(input);
  if (!root.success) {
    return { ok: false, error: "Payload mangler holdings-liste." };
  }
  const holdings = salvageItems<Holding>(root.data.holdings, holdingSchema);
  const events = salvageItems<PortfolioEvent>(root.data.events ?? [], eventSchema);
  if (holdings.valid.length === 0 && root.data.holdings.length > 0) {
    return { ok: false, error: "Ingen gyldige beholdninger i payload." };
  }
  return {
    ok: true,
    data: {
      holdings: holdings.valid,
      events: events.valid,
      snapshots: salvageSnapshots(root.data.snapshots),
    },
    droppedItems: holdings.dropped + events.dropped,
  };
}

export function getCorruptPayloads(store: StorageLike) {
  return storageKeys(store)
    .filter((key) => key.startsWith(CORRUPT_PREFIX))
    .sort()
    .reverse()
    .map((key) => ({ key, raw: store.getItem(key) ?? "" }));
}

export const STORAGE_KEYS = {
  DATA_KEY,
  LEGACY_HOLDINGS_KEY,
  LEGACY_EVENTS_KEY,
  BACKUP_PREFIX,
  CORRUPT_PREFIX,
};
