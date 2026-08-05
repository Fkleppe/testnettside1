import { describe, expect, it } from "vitest";
import {
  exportPortfolioJson,
  listBackups,
  loadPortfolio,
  parseImportedJson,
  restoreBackup,
  savePortfolio,
  STORAGE_KEYS,
} from "./storage";
import type { Holding } from "./types";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
    map,
  };
}

const holding: Holding = {
  id: "h1",
  name: "KLP AksjeGlobal Indeks P",
  symbol: "NO0010776040",
  kind: "fund",
  platform: "Kron",
  mode: "manual",
  units: 10,
  cost: 1000,
  price: 120,
  dailyPercent: null,
  currency: "NOK",
  source: "Manuelt registrert",
  updatedAt: "2026-08-04T08:00:00.000Z",
};

describe("loadPortfolio", () => {
  it("returns empty when nothing is stored", () => {
    expect(loadPortfolio(fakeStorage()).status).toBe("empty");
  });

  it("round-trips saved data", () => {
    const store = fakeStorage();
    savePortfolio(store, { holdings: [holding], events: [], snapshots: [] }, {
      lastSeenSavedAt: null,
    });
    const result = loadPortfolio(store);
    if (result.status !== "ok") throw new Error(result.status);
    expect(result.data.holdings).toHaveLength(1);
    expect(result.data.holdings[0].name).toBe(holding.name);
  });

  it("round-trips historikk-snapshots og normaliserer manglende groups", () => {
    const store = fakeStorage();
    const snapshot = {
      date: "2026-08-04",
      capturedAt: "2026-08-04T18:00:00.000Z",
      value: 1200,
      cost: 1000,
    };
    savePortfolio(
      store,
      { holdings: [holding], events: [], snapshots: [snapshot as never] },
      { lastSeenSavedAt: null },
    );
    const result = loadPortfolio(store);
    if (result.status !== "ok") throw new Error(result.status);
    expect(result.data.snapshots).toHaveLength(1);
    expect(result.data.snapshots[0].value).toBe(1200);
    expect(result.data.snapshots[0].groups).toEqual({});
  });

  it("skrivetidsvern: en skriver uten snapshots kan ikke slette disk-historikk", () => {
    const store = fakeStorage();
    const snapshot = {
      date: "2026-08-05",
      capturedAt: "2026-08-05T08:00:00.000Z",
      value: 2305911,
      cost: 1957904,
      groups: {},
    };
    savePortfolio(
      store,
      { holdings: [holding], events: [], snapshots: [snapshot as never] },
      { lastSeenSavedAt: null },
    );
    // Simulerer gammel klient: skriver samme portefølje UTEN snapshots.
    savePortfolio(
      store,
      { holdings: [holding], events: [], snapshots: [] },
      { lastSeenSavedAt: null },
    );
    const result = loadPortfolio(store);
    if (result.status !== "ok") throw new Error(result.status);
    expect(result.data.snapshots).toHaveLength(1);
    expect(result.data.snapshots[0].value).toBe(2305911);
  });

  it("bevisst nullstilling fjerner historikken", () => {
    const store = fakeStorage();
    const snapshot = {
      date: "2026-08-05",
      capturedAt: "2026-08-05T08:00:00.000Z",
      value: 100,
      cost: 90,
      groups: {},
    };
    savePortfolio(
      store,
      { holdings: [holding], events: [], snapshots: [snapshot as never] },
      { lastSeenSavedAt: null },
    );
    savePortfolio(
      store,
      { holdings: [], events: [], snapshots: [] },
      { lastSeenSavedAt: null },
    );
    const result = loadPortfolio(store);
    if (result.status !== "ok") throw new Error(result.status);
    expect(result.data.snapshots).toHaveLength(0);
  });

  it("gjenoppretter historikk fra sikkerhetskopi når konvolutten mangler den", () => {
    const store = fakeStorage();
    const snapshot = {
      date: "2026-08-04",
      capturedAt: "2026-08-04T18:00:00.000Z",
      value: 500,
      cost: 400,
      groups: {},
    };
    store.setItem(
      `${STORAGE_KEYS.BACKUP_PREFIX}2026-08-04T18:00:00.000Z`,
      JSON.stringify({
        v: 2,
        savedAt: "2026-08-04T18:00:00.000Z",
        holdings: [holding],
        events: [],
        snapshots: [snapshot],
      }),
    );
    // Hovedkonvolutt skrevet av gammel klient — uten snapshots-felt.
    store.setItem(
      STORAGE_KEYS.DATA_KEY,
      JSON.stringify({
        v: 2,
        savedAt: "2026-08-05T09:00:00.000Z",
        holdings: [holding],
        events: [],
      }),
    );
    const result = loadPortfolio(store);
    if (result.status !== "ok") throw new Error(result.status);
    expect(result.data.snapshots).toHaveLength(1);
    expect(result.data.snapshots[0].date).toBe("2026-08-04");
  });

  it("dropper ugyldige snapshots uten å gate beholdningene", () => {
    const store = fakeStorage();
    store.setItem(
      STORAGE_KEYS.DATA_KEY,
      JSON.stringify({
        v: 2,
        savedAt: "2026-08-04T18:00:00.000Z",
        holdings: [holding],
        events: [],
        snapshots: [{ date: "ikke-en-dato", value: "tull" }],
      }),
    );
    const result = loadPortfolio(store);
    if (result.status !== "ok") throw new Error(result.status);
    expect(result.data.holdings).toHaveLength(1);
    expect(result.data.snapshots).toHaveLength(0);
  });

  it("recovers legacy v1 keys", () => {
    const store = fakeStorage();
    store.setItem(STORAGE_KEYS.LEGACY_HOLDINGS_KEY, JSON.stringify([holding]));
    const result = loadPortfolio(store);
    expect(result.status).toBe("recovered-legacy");
  });

  it("preserves unreadable payloads instead of discarding them", () => {
    const store = fakeStorage();
    store.setItem(STORAGE_KEYS.DATA_KEY, "{broken json");
    const result = loadPortfolio(store);
    if (result.status !== "corrupt") throw new Error(result.status);
    expect(store.getItem(result.corruptKey)).toBe("{broken json");
  });

  it("salvages valid items and preserves the rest", () => {
    const store = fakeStorage();
    store.setItem(
      STORAGE_KEYS.DATA_KEY,
      JSON.stringify({
        v: 2,
        savedAt: "2026-08-04T08:00:00.000Z",
        holdings: [holding, { id: "broken" }],
        events: [],
      }),
    );
    const result = loadPortfolio(store);
    if (result.status !== "ok") throw new Error(result.status);
    expect(result.data.holdings).toHaveLength(1);
    expect(result.droppedItems).toBe(1);
    const corruptKeys = [...store.map.keys()].filter((key) =>
      key.startsWith(STORAGE_KEYS.CORRUPT_PREFIX),
    );
    expect(corruptKeys).toHaveLength(1);
  });
});

describe("savePortfolio", () => {
  it("backs up a foreign write before overwriting it", () => {
    const store = fakeStorage();
    const mine = savePortfolio(store, { holdings: [holding], events: [], snapshots: [] }, {
      lastSeenSavedAt: null,
      now: new Date("2026-08-04T08:00:00Z"),
    });
    const foreign = { ...holding, id: "other-tab", name: "Annen fane" };
    savePortfolio(store, { holdings: [foreign], events: [], snapshots: [] }, {
      lastSeenSavedAt: null,
      now: new Date("2026-08-04T09:00:00Z"),
    });
    savePortfolio(store, { holdings: [holding], events: [], snapshots: [] }, {
      lastSeenSavedAt: mine,
      now: new Date("2026-08-04T10:00:00Z"),
    });
    const conflictKeys = [...store.map.keys()].filter((key) =>
      key.includes("conflict"),
    );
    expect(conflictKeys).toHaveLength(1);
    expect(store.getItem(conflictKeys[0])).toContain("Annen fane");
  });

  it("writes rolling backups at most every six hours", () => {
    const store = fakeStorage();
    savePortfolio(store, { holdings: [holding], events: [], snapshots: [] }, {
      lastSeenSavedAt: null,
      now: new Date("2026-08-04T08:00:00Z"),
    });
    savePortfolio(store, { holdings: [holding], events: [], snapshots: [] }, {
      lastSeenSavedAt: null,
      now: new Date("2026-08-04T09:00:00Z"),
    });
    savePortfolio(store, { holdings: [holding], events: [], snapshots: [] }, {
      lastSeenSavedAt: null,
      now: new Date("2026-08-04T15:00:00Z"),
    });
    expect(listBackups(store)).toHaveLength(2);
  });

  it("never writes backups of an empty portfolio", () => {
    const store = fakeStorage();
    savePortfolio(store, { holdings: [], events: [], snapshots: [] }, {
      lastSeenSavedAt: null,
    });
    expect(listBackups(store)).toHaveLength(0);
  });
});

describe("backup restore and import", () => {
  it("restores a backup", () => {
    const store = fakeStorage();
    savePortfolio(store, { holdings: [holding], events: [], snapshots: [] }, {
      lastSeenSavedAt: null,
    });
    const [backup] = listBackups(store);
    const restored = restoreBackup(store, backup.key);
    expect(restored?.holdings[0].id).toBe("h1");
  });

  it("accepts exported files and rejects junk", () => {
    const exported = exportPortfolioJson({ holdings: [holding], events: [], snapshots: [] });
    const ok = parseImportedJson(exported);
    expect(ok.ok).toBe(true);
    expect(parseImportedJson("ikke json").ok).toBe(false);
    expect(parseImportedJson('{"foo":1}').ok).toBe(false);
    expect(parseImportedJson('{"holdings":[{"id":"x"}]}').ok).toBe(false);
  });
});
