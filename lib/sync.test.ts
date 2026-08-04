import { describe, expect, it } from "vitest";
import { decideMerge, type RemoteSnapshot } from "./sync";
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

const remote = (
  holdings: Holding[],
  savedAt: string | null,
): RemoteSnapshot => ({ exists: true, savedAt, holdings, events: [] });

describe("decideMerge", () => {
  it("pushes local when remote is empty", () => {
    const decision = decideMerge(
      { savedAt: "2026-08-04T09:00:00Z", data: { holdings: [holding("a")], events: [] } },
      { exists: false, savedAt: null, holdings: [], events: [] },
    );
    expect(decision).toEqual({ action: "keep-local", pushLocal: true });
  });

  it("takes remote when local is empty, without backup", () => {
    const decision = decideMerge(
      { savedAt: null, data: { holdings: [], events: [] } },
      remote([holding("r")], "2026-08-04T09:00:00Z"),
    );
    expect(decision.action).toBe("take-remote");
    if (decision.action === "take-remote") {
      expect(decision.backupLocal).toBe(false);
    }
  });

  it("newest side wins and the losing non-empty side is backed up", () => {
    const newerRemote = decideMerge(
      { savedAt: "2026-08-04T08:00:00Z", data: { holdings: [holding("l")], events: [] } },
      remote([holding("r")], "2026-08-04T09:00:00Z"),
    );
    expect(newerRemote.action).toBe("take-remote");
    if (newerRemote.action === "take-remote") {
      expect(newerRemote.backupLocal).toBe(true);
    }

    const newerLocal = decideMerge(
      { savedAt: "2026-08-04T10:00:00Z", data: { holdings: [holding("l")], events: [] } },
      remote([holding("r")], "2026-08-04T09:00:00Z"),
    );
    expect(newerLocal).toEqual({ action: "keep-local", pushLocal: true });
  });

  it("an empty local never overwrites a non-empty remote and vice versa", () => {
    const emptyLocal = decideMerge(
      { savedAt: "2026-08-04T10:00:00Z", data: { holdings: [], events: [] } },
      remote([holding("r")], "2026-08-04T09:00:00Z"),
    );
    expect(emptyLocal.action).toBe("take-remote");

    const emptyRemote = decideMerge(
      { savedAt: "2026-08-04T08:00:00Z", data: { holdings: [holding("l")], events: [] } },
      remote([], "2026-08-04T09:00:00Z"),
    );
    expect(emptyRemote).toEqual({ action: "keep-local", pushLocal: true });
  });
});
