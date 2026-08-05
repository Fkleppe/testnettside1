import { describe, expect, it } from "vitest";
import { goalProjection } from "./goal";

const NOW = new Date(2026, 7, 6);
const day = (date: string, value: number, origin?: "rec") => ({
  date,
  value,
  ...(origin ? { origin } : {}),
});

describe("goalProjection", () => {
  it("beregner gjenstående og ETA fra observert veksttakt", () => {
    // 60 dager, +60 000 → 1000/dag. Mangler 100 000 → ~100 dager frem.
    const snapshots = [day("2026-06-01", 900000), day("2026-07-31", 960000)];
    const result = goalProjection(snapshots, 960000, 1060000, NOW);
    expect(result.remaining).toBe(100000);
    expect(result.etaLabel).toContain("november 2026");
  });

  it("gir ingen ETA ved flat/negativ utvikling eller kort historikk", () => {
    const flat = goalProjection(
      [day("2026-06-01", 900000), day("2026-07-31", 900000)],
      900000,
      1000000,
      NOW,
    );
    expect(flat.etaLabel).toBeNull();
    expect(flat.remaining).toBe(100000);
    const short = goalProjection(
      [day("2026-07-30", 900000), day("2026-08-05", 950000)],
      950000,
      1000000,
      NOW,
    );
    expect(short.etaLabel).toBeNull();
  });

  it("ignorerer rekonstruerte punkter og håndterer nådd mål", () => {
    const withRec = goalProjection(
      [day("2020-01-01", 100, "rec"), day("2026-07-30", 900000)],
      900000,
      1000000,
      NOW,
    );
    expect(withRec.etaLabel).toBeNull();
    const done = goalProjection([], 1200000, 1000000, NOW);
    expect(done.remaining).toBe(0);
    expect(done.etaLabel).toBeNull();
  });
});
