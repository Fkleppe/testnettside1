import { describe, expect, it } from "vitest";
import {
  filterRange,
  localDateKey,
  mergeSnapshots,
  snapshotPoints,
  upsertDailySnapshot,
  SNAPSHOT_LIMIT,
  type DailySnapshot,
} from "./history";
import type { Holding } from "./types";

function makeHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: "h1",
    name: "Testfond",
    symbol: "TEST",
    kind: "fund",
    platform: "Nordnet",
    mode: "manual",
    units: 10,
    cost: 1000,
    price: 120,
    dailyPercent: null,
    currency: "NOK",
    source: "manual",
    updatedAt: "2026-08-04T10:00:00.000Z",
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<DailySnapshot> = {}): DailySnapshot {
  return {
    date: "2026-08-01",
    capturedAt: "2026-08-01T18:00:00.000Z",
    value: 1200,
    cost: 1000,
    groups: { private: { value: 1200, cost: 1000 } },
    ...overrides,
  };
}

describe("localDateKey", () => {
  it("bruker lokale datokomponenter", () => {
    expect(localDateKey(new Date(2026, 7, 4, 9, 30))).toBe("2026-08-04");
    expect(localDateKey(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });
});

describe("upsertDailySnapshot", () => {
  const now = new Date(2026, 7, 4, 12, 0);

  it("lager første snapshot med verdier og kontogrupper", () => {
    const holdings = [
      makeHolding(),
      makeHolding({ id: "h2", accountGroup: "business", units: 5, cost: 400 }),
    ];
    const result = upsertDailySnapshot([], holdings, now);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-08-04");
    expect(result[0].value).toBe(1800);
    expect(result[0].cost).toBe(1400);
    expect(result[0].groups.private).toEqual({ value: 1200, cost: 1000 });
    expect(result[0].groups.business).toEqual({ value: 600, cost: 400 });
  });

  it("returnerer samme referanse når ingenting har endret seg", () => {
    const holdings = [makeHolding()];
    const first = upsertDailySnapshot([], holdings, now);
    const second = upsertDailySnapshot(first, holdings, now);
    expect(second).toBe(first);
  });

  it("oppdaterer dagens snapshot i stedet for å duplisere", () => {
    const holdings = [makeHolding()];
    const first = upsertDailySnapshot([], holdings, now);
    const updated = upsertDailySnapshot(
      first,
      [makeHolding({ price: 130 })],
      new Date(2026, 7, 4, 15, 0),
    );
    expect(updated).toHaveLength(1);
    expect(updated[0].value).toBe(1300);
    expect(first[0].value).toBe(1200);
  });

  it("legger til nytt punkt på ny dag og beholder sortering", () => {
    const first = upsertDailySnapshot([], [makeHolding()], now);
    const next = upsertDailySnapshot(
      first,
      [makeHolding({ price: 125 })],
      new Date(2026, 7, 5, 12, 0),
    );
    expect(next.map((item) => item.date)).toEqual(["2026-08-04", "2026-08-05"]);
  });

  it("tar aldri snapshot av tom portefølje", () => {
    const existing = [makeSnapshot()];
    expect(upsertDailySnapshot(existing, [], now)).toBe(existing);
  });

  it("beskjærer eldste historikk over grensen", () => {
    const seqDate = (index: number) => {
      const year = 2000 + Math.floor(index / 336);
      const month = (Math.floor(index / 28) % 12) + 1;
      const day = (index % 28) + 1;
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    };
    const many: DailySnapshot[] = Array.from(
      { length: SNAPSHOT_LIMIT },
      (_, index) => makeSnapshot({ date: seqDate(index) }),
    );
    const result = upsertDailySnapshot(many, [makeHolding()], now);
    expect(result.length).toBeLessThanOrEqual(SNAPSHOT_LIMIT);
    expect(result[result.length - 1].date).toBe("2026-08-04");
    expect(result[0].date).not.toBe(many[0].date);
  });
});

describe("mergeSnapshots", () => {
  it("unionerer på dato og sorterer", () => {
    const a = [makeSnapshot({ date: "2026-08-01" })];
    const b = [makeSnapshot({ date: "2026-07-30" })];
    const merged = mergeSnapshots(a, b);
    expect(merged.map((item) => item.date)).toEqual([
      "2026-07-30",
      "2026-08-01",
    ]);
  });

  it("lar nyeste capturedAt vinne ved datokonflikt", () => {
    const older = makeSnapshot({ value: 100, capturedAt: "2026-08-01T10:00:00Z" });
    const newer = makeSnapshot({ value: 200, capturedAt: "2026-08-01T16:00:00Z" });
    expect(mergeSnapshots([older], [newer])[0].value).toBe(200);
    expect(mergeSnapshots([newer], [older])[0].value).toBe(200);
  });

  it("returnerer samme referanse når andre siden ikke tilfører noe", () => {
    const a = [makeSnapshot()];
    expect(mergeSnapshots(a, [])).toBe(a);
    expect(mergeSnapshots(a, [makeSnapshot()])).toBe(a);
  });
});

describe("filterRange", () => {
  const now = new Date(2026, 7, 4, 12, 0);
  const series = [
    makeSnapshot({ date: "2025-06-01" }),
    makeSnapshot({ date: "2026-06-01" }),
    makeSnapshot({ date: "2026-07-30" }),
    makeSnapshot({ date: "2026-08-04" }),
  ];

  it("filtrerer per intervall", () => {
    expect(filterRange(series, "1w", now)).toHaveLength(2);
    expect(filterRange(series, "3m", now)).toHaveLength(3);
    expect(filterRange(series, "max", now)).toHaveLength(4);
  });
});

describe("snapshotPoints", () => {
  const series = [
    makeSnapshot({
      date: "2026-08-01",
      groups: { private: { value: 700, cost: 500 } },
    }),
    makeSnapshot({ date: "2026-08-02", groups: {} }),
  ];

  it("bruker totalverdi for alle kontoer", () => {
    const points = snapshotPoints(series, "all");
    expect(points).toHaveLength(2);
    expect(points[0].value).toBe(1200);
  });

  it("bruker gruppetall og hopper over datoer uten gruppen", () => {
    const points = snapshotPoints(series, "private");
    expect(points).toHaveLength(1);
    expect(points[0].value).toBe(700);
  });
});
