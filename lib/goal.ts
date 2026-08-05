import type { DailySnapshot } from "./history";

export type GoalProjection = {
  remaining: number;
  etaLabel: string | null;
};

const monthFormatter = new Intl.DateTimeFormat("nb-NO", {
  month: "long",
  year: "numeric",
});

/**
 * Prognose for sparemål basert på OBSERVERT verdiutvikling (rekonstruerte
 * punkter holdes utenfor). Krever minst tre ukers ekte historikk; flat eller
 * negativ utvikling gir ingen ETA — vi gjetter ikke.
 */
export function goalProjection(
  snapshots: Pick<DailySnapshot, "date" | "value" | "origin">[],
  currentValue: number,
  goalAmount: number,
  now: Date = new Date(),
): GoalProjection {
  const remaining = Math.max(0, goalAmount - currentValue);
  if (remaining === 0) return { remaining: 0, etaLabel: null };
  const observed = snapshots.filter((item) => item.origin !== "rec");
  if (observed.length < 2) return { remaining, etaLabel: null };
  const first = observed[0];
  const last = observed[observed.length - 1];
  const days = (Date.parse(last.date) - Date.parse(first.date)) / 86_400_000;
  if (days < 21) return { remaining, etaLabel: null };
  const perDay = (last.value - first.value) / days;
  if (perDay <= 0) return { remaining, etaLabel: null };
  const daysLeft = remaining / perDay;
  if (daysLeft > 365 * 50) {
    return { remaining, etaLabel: "I dette tempoet: over 50 år unna" };
  }
  const eta = new Date(now.getTime() + daysLeft * 86_400_000);
  return {
    remaining,
    etaLabel: `I dette tempoet: ca. ${monthFormatter.format(eta)}`,
  };
}
