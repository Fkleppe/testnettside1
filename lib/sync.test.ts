import { describe, expect, it } from "vitest";
import { decideMerge, type RemoteSnapshot } from "./sync";
import type { DailySnapshot } from "./history";
import type { Holding } from "./types";

const holding = (id: string): Holding => ({
  id,
  name: `Fond ${id}`,
  symbol: "NO0000000000",
  kind: "fund",
  platform: "Kron",
  mode: "manual",
  units: 1,
  cost: 100,
  price: 110,
  dailyPercent: null,
  currency: "NOK",
  source: "test",
  updatedAt: "2026-08-04T08:00:00.000Z",
});

const snapshot = (
  date: string,
  value = 100,
  capturedAt = `${date}T18:00:00.000Z`,
): DailySnapshot => ({
  date,
  capturedAt,
  value,
  cost: 90,
  groups: {},
});

const remote = (
  holdings: Holding[],
  savedAt: string | null,
  snapshots: DailySnapshot[] = [],
): RemoteSnapshot => ({ exists: true, savedAt, holdings, events: [], snapshots });

describe("decideMerge", () => {
  it("pushes local when remote is empty", () => {
    const decision = decideMerge(
      {
        savedAt: "2026-08-04T09:00:00Z",
        data: { holdings: [holding("a")], events: [], snapshots: [] },
      },
      { exists: false, savedAt: null, holdings: [], events: [], snapshots: [] },
    );
    expect(decision).toEqual({
      action: "keep-local",
      pushLocal: true,
      snapshots: [],
    });
  });

  it("takes remote when local is empty, without backup", () => {
    const decision = decideMerge(
      { savedAt: null, data: { holdings: [], events: [], snapshots: [] } },
      remote([holding("r")], "2026-08-04T09:00:00Z"),
    );
    expect(decision.action).toBe("take-remote");
    if (decision.action === "take-remote") {
      expect(decision.backupLocal).toBe(false);
    }
  });

  it("newest side wins and the losing non-empty side is backed up", () => {
    const newerRemote = decideMerge(
      {
        savedAt: "2026-08-04T08:00:00Z",
        data: { holdings: [holding("l")], events: [], snapshots: [] },
      },
      remote([holding("r")], "2026-08-04T09:00:00Z"),
    );
    expect(newerRemote.action).toBe("take-remote");
    if (newerRemote.action === "take-remote") {
      expect(newerRemote.backupLocal).toBe(true);
    }

    const newerLocal = decideMerge(
      {
        savedAt: "2026-08-04T10:00:00Z",
        data: { holdings: [holding("l")], events: [], snapshots: [] },
      },
      remote([holding("r")], "2026-08-04T09:00:00Z"),
    );
    expect(newerLocal).toEqual({
      action: "keep-local",
      pushLocal: true,
      snapshots: [],
    });
  });

  it("an empty local never overwrites a non-empty remote and vice versa", () => {
    const emptyLocal = decideMerge(
      {
        savedAt: "2026-08-04T10:00:00Z",
        data: { holdings: [], events: [], snapshots: [] },
      },
      remote([holding("r")], "2026-08-04T09:00:00Z"),
    );
    expect(emptyLocal.action).toBe("take-remote");

    const emptyRemote = decideMerge(
      {
        savedAt: "2026-08-04T08:00:00Z",
        data: { holdings: [holding("l")], events: [], snapshots: [] },
      },
      remote([], "2026-08-04T09:00:00Z"),
    );
    expect(emptyRemote).toEqual({
      action: "keep-local",
      pushLocal: true,
      snapshots: [],
    });
  });

  it("unionerer historikk per dato uansett hvem som vinner", () => {
    const localSnapshots = [snapshot("2026-08-01"), snapshot("2026-08-03")];
    const remoteSnapshots = [snapshot("2026-08-02")];

    const keepLocal = decideMerge(
      {
        savedAt: "2026-08-04T10:00:00Z",
        data: { holdings: [holding("l")], events: [], snapshots: localSnapshots },
      },
      remote([holding("r")], "2026-08-04T09:00:00Z", remoteSnapshots),
    );
    if (keepLocal.action !== "keep-local") throw new Error(keepLocal.action);
    expect(keepLocal.snapshots.map((item) => item.date)).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ]);

    const takeRemote = decideMerge(
      {
        savedAt: "2026-08-04T08:00:00Z",
        data: { holdings: [holding("l")], events: [], snapshots: localSnapshots },
      },
      remote([holding("r")], "2026-08-04T09:00:00Z", remoteSnapshots),
    );
    if (takeRemote.action !== "take-remote") throw new Error(takeRemote.action);
    expect(takeRemote.data.snapshots).toHaveLength(3);
  });

  it("lar nyeste capturedAt vinne datokonflikter i historikken", () => {
    const decision = decideMerge(
      {
        savedAt: "2026-08-04T10:00:00Z",
        data: {
          holdings: [holding("l")],
          events: [],
          snapshots: [snapshot("2026-08-01", 100, "2026-08-01T10:00:00Z")],
        },
      },
      remote([holding("r")], "2026-08-04T09:00:00Z", [
        snapshot("2026-08-01", 200, "2026-08-01T16:00:00Z"),
      ]),
    );
    if (decision.action !== "keep-local") throw new Error(decision.action);
    expect(decision.snapshots[0].value).toBe(200);
  });
});
