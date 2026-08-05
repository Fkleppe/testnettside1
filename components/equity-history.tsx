"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Info } from "lucide-react";
import {
  filterRange,
  type HistoryPoint,
  type HistoryRange,
} from "@/lib/history";

const money = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});
const compact = new Intl.NumberFormat("nb-NO", {
  notation: "compact",
  maximumFractionDigits: 2,
});
const tooltipDate = new Intl.DateTimeFormat("nb-NO", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dayMonth = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const monthYear = new Intl.DateTimeFormat("nb-NO", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

function signedMoney(value: number) {
  return `${value > 0 ? "+" : ""}${money.format(value)}`;
}
function signedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("nb-NO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} %`;
}

const RANGES: { key: HistoryRange; label: string }[] = [
  { key: "1w", label: "1 uke" },
  { key: "1m", label: "1 mnd" },
  { key: "3m", label: "3 mnd" },
  { key: "1y", label: "1 år" },
  { key: "max", label: "Maks" },
];

const PAD_TOP = 8;
const PAD_BOTTOM = 10;

type Hover = { index: number; xPct: number; yPct: number };

/**
 * Tidsserie over porteføljeverdi bygget av ekte daglige snapshots. Tegner
 * ingenting før minst to dager finnes — ingen syntetisk historikk.
 */
export function EquityHistory({ points }: { points: HistoryPoint[] }) {
  const gradientId = useId();
  const [range, setRange] = useState<HistoryRange>("max");
  const [hover, setHover] = useState<Hover | null>(null);
  const [showBench, setShowBench] = useState(false);
  const [bench, setBench] = useState<{ date: string; price: number }[] | null>(
    null,
  );
  useEffect(() => {
    if (!showBench || bench !== null) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          "/api/history?symbol=NO0010776040&kind=fund",
        );
        if (!response.ok) {
          if (!cancelled) setBench([]);
          return;
        }
        const json = await response.json();
        if (!cancelled) {
          setBench(Array.isArray(json.points) ? json.points : []);
        }
      } catch {
        if (!cancelled) setBench([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showBench, bench]);

  const visible = useMemo(
    () => filterRange(points, range, new Date()),
    [points, range],
  );

  const geometry = useMemo(() => {
    if (visible.length < 2) return null;
    const times = visible.map((point) => Date.parse(point.date));
    const t0 = times[0];
    const span = times[times.length - 1] - t0;

    // Benchmark-verdier beregnes FØR skalaen, slik at alle linjer deler
    // samme y-domene (indeksen frem-fylles per dato og forankres på
    // porteføljens verdi ved første punkt med indeksdata).
    let benchScaled: (number | null)[] | null = null;
    if (showBench && bench && bench.length > 1) {
      const benchValues: (number | null)[] = [];
      let benchIndex = 0;
      let lastPrice: number | null = null;
      for (const point of visible) {
        while (
          benchIndex < bench.length &&
          bench[benchIndex].date <= point.date
        ) {
          lastPrice = bench[benchIndex].price;
          benchIndex += 1;
        }
        benchValues.push(lastPrice);
      }
      const anchorIndex = benchValues.findIndex((value) => value !== null);
      if (anchorIndex >= 0) {
        const scale =
          visible[anchorIndex].value / (benchValues[anchorIndex] as number);
        benchScaled = benchValues.map((value) =>
          value === null ? null : value * scale,
        );
      }
    }

    const domainValues = [
      ...visible.flatMap((point) => [point.value, point.cost]),
      ...(benchScaled ?? []).filter((value): value is number => value !== null),
    ];
    let min = Math.min(...domainValues);
    let max = Math.max(...domainValues);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const usable = 100 - PAD_TOP - PAD_BOTTOM;
    const toY = (value: number) =>
      PAD_TOP + (1 - (value - min) / (max - min)) * usable;
    const toX = (index: number) => ((times[index] - t0) / span) * 100;
    const toPath = (points: { x: number; y: number }[]) =>
      points
        .map(
          (c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(3)},${c.y.toFixed(3)}`,
        )
        .join("");

    const coords = visible.map((point, index) => ({
      x: toX(index),
      y: toY(point.value),
    }));
    const line = toPath(coords);
    const costLine = toPath(
      visible.map((point, index) => ({ x: toX(index), y: toY(point.cost) })),
    );
    const area = `${line}L100,100L0,100Z`;
    const change = visible[visible.length - 1].value - visible[0].value;
    let benchLine: string | null = null;
    if (benchScaled) {
      const benchCoords = benchScaled
        .map((value, index) =>
          value === null ? null : { x: toX(index), y: toY(value) },
        )
        .filter((c): c is { x: number; y: number } => c !== null);
      if (benchCoords.length > 1) benchLine = toPath(benchCoords);
    }

    // Gridlinjer på kvartilene av verdiområdet, med kompakte beløpsetiketter.
    const yTicks = [0.25, 0.5, 0.75].map((f) => ({
      pct: PAD_TOP + (1 - f) * usable,
      value: min + f * (max - min),
    }));
    // 4 datoetiketter jevnt over tidsspennet; format følger intervallet.
    const formatter = range === "1y" || range === "max" ? monthYear : dayMonth;
    const xTicks = [0, 1 / 3, 2 / 3, 1].map((f) => {
      const t = t0 + f * span;
      return { pct: f * 100, label: formatter.format(t) };
    });
    return {
      coords,
      line,
      costLine,
      area,
      min,
      max,
      change,
      benchLine,
      yTicks,
      xTicks,
    };
  }, [visible, showBench, bench, range]);

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!geometry) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const xPct = ((event.clientX - rect.left) / rect.width) * 100;
    let nearest = 0;
    for (let index = 1; index < geometry.coords.length; index += 1) {
      if (
        Math.abs(geometry.coords[index].x - xPct) <
        Math.abs(geometry.coords[nearest].x - xPct)
      ) {
        nearest = index;
      }
    }
    setHover({
      index: nearest,
      xPct: geometry.coords[nearest].x,
      yPct: geometry.coords[nearest].y,
    });
  };

  if (points.length < 2) {
    const seed = points[points.length - 1];
    return (
      <div className="equity-history">
        <div className="history-chart is-seed">
          <div className="history-grid" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <i className="history-baseline" aria-hidden="true" />
          {seed ? (
            <>
              <i
                className="history-live-dot"
                style={{
                  left: "84%",
                  top: "50%",
                  background: "var(--positive)",
                }}
                aria-hidden="true"
              />
              <span className="history-seed-value">
                {money.format(seed.value)}
              </span>
            </>
          ) : null}
          <div className="history-seed-note">
            <b>
              {seed
                ? "Første datapunkt er lagret i dag"
                : "Historikk bygges fra neste dagsoppdatering"}
            </b>
            <small>
              {seed
                ? "Grafen tegnes fra dag 2 — bare ekte daglige snapshots."
                : "Vi viser ikke en tidsserie før porteføljen har ekte daglige snapshots."}
            </small>
          </div>
        </div>
      </div>
    );
  }

  const positive = geometry ? geometry.change >= 0 : true;
  const color = positive ? "var(--positive)" : "var(--negative)";
  const hovered = hover && geometry ? visible[hover.index] : null;
  const hasRec = visible.some((point) => point.origin === "rec");

  return (
    <div className="equity-history">
      <div className="history-ranges">
        <div role="tablist" aria-label="Tidsintervall">
          {RANGES.map((item) => (
            <button
              key={item.key}
              role="tab"
              type="button"
              aria-selected={range === item.key}
              className={range === item.key ? "selected" : undefined}
              onClick={() => setRange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="history-flex-spacer" />
        {geometry ? (
          <b className={positive ? "positive" : "negative"}>
            {signedPercent((geometry.change / (visible[0].value || 1)) * 100)} ·{" "}
            {signedMoney(geometry.change)}
          </b>
        ) : null}
      </div>
      <div
        className="history-chart"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {geometry ? (
          <>
            <div className="history-grid" aria-hidden="true">
              {geometry.yTicks.map((tick) => (
                <span
                  key={tick.pct}
                  className="history-gridline"
                  style={{ top: `${tick.pct}%` }}
                >
                  <em>{compact.format(tick.value)}</em>
                </span>
              ))}
            </div>
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-label="Verdiutvikling"
              role="img"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.38" />
                  <stop offset="55%" stopColor={color} stopOpacity="0.12" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={geometry.area} fill={`url(#${gradientId})`} />
              <path
                className="history-cost-line"
                d={geometry.costLine}
                fill="none"
                strokeWidth="1"
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
              {geometry.benchLine ? (
                <path
                  className="history-bench-line"
                  d={geometry.benchLine}
                  fill="none"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              <path
                className="history-value-line"
                d={geometry.line}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <i
              className="history-live-dot"
              style={{
                left: `${geometry.coords[geometry.coords.length - 1].x}%`,
                top: `${geometry.coords[geometry.coords.length - 1].y}%`,
                background: color,
              }}
              aria-hidden="true"
            />
            {hover && hovered ? (
              <>
                <i
                  className="history-crosshair"
                  style={{ left: `${hover.xPct}%` }}
                  aria-hidden="true"
                />
                <i
                  className="history-dot"
                  style={{
                    left: `${hover.xPct}%`,
                    top: `${hover.yPct}%`,
                    background: color,
                  }}
                  aria-hidden="true"
                />
                <div
                  className={`history-tooltip${
                    hover.xPct > 70 ? " flip" : ""
                  }`}
                  style={{ left: `${hover.xPct}%` }}
                >
                  <small>{tooltipDate.format(Date.parse(hovered.date))}</small>
                  <b>{money.format(hovered.value)}</b>
                  <span
                    className={
                      hovered.value - visible[0].value >= 0
                        ? "positive"
                        : "negative"
                    }
                  >
                    {signedMoney(hovered.value - visible[0].value)} i perioden
                  </span>
                </div>
              </>
            ) : null}
          </>
        ) : (
          <div className="history-range-note">
            <small>
              For kort historikk i dette intervallet ennå — velg et lengre, eller
              kom tilbake i morgen.
            </small>
          </div>
        )}
      </div>
      {geometry ? (
        <div className="history-xaxis" aria-hidden="true">
          {geometry.xTicks.map((tick, index) => (
            <span
              key={tick.pct}
              style={{ left: `${tick.pct}%` }}
              className={
                index === 0
                  ? "start"
                  : index === geometry.xTicks.length - 1
                    ? "end"
                    : undefined
              }
            >
              {tick.label}
            </span>
          ))}
        </div>
      ) : null}
      {geometry ? (
        <div className="history-legend under" aria-hidden="false">
          <span>
            <i style={{ background: color }} /> Verdi
          </span>
          <span>
            <i className="cost" /> Investert
          </span>
          <button
            type="button"
            className={`history-bench-toggle ${showBench ? "on" : ""}`}
            aria-pressed={showBench}
            onClick={() => setShowBench((value) => !value)}
          >
            <i className="bench" /> Verdensindeks
          </button>
          {hasRec ? (
            <span
              className="history-provenance"
              title="Deler av grafen er beregnet fra dagens beholdning × ekte kurshistorikk. Observerte daglige punkter tar over etter hvert."
            >
              <Info size={11} /> Delvis rekonstruert
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
