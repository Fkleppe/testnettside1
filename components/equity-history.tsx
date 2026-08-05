"use client";

import { useId, useMemo, useState } from "react";
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
const tooltipDate = new Intl.DateTimeFormat("nb-NO", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
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

  const visible = useMemo(
    () => filterRange(points, range, new Date()),
    [points, range],
  );

  const geometry = useMemo(() => {
    if (visible.length < 2) return null;
    const times = visible.map((point) => Date.parse(point.date));
    const t0 = times[0];
    const span = times[times.length - 1] - t0;
    const values = visible.flatMap((point) => [point.value, point.cost]);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const usable = 100 - PAD_TOP - PAD_BOTTOM;
    const toY = (value: number) =>
      PAD_TOP + (1 - (value - min) / (max - min)) * usable;
    const coords = visible.map((point, index) => ({
      x: ((times[index] - t0) / span) * 100,
      y: toY(point.value),
    }));
    const toPath = (points: { x: number; y: number }[]) =>
      points
        .map(
          (c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(3)},${c.y.toFixed(3)}`,
        )
        .join("");
    const line = toPath(coords);
    const costLine = toPath(
      visible.map((point, index) => ({
        x: ((times[index] - t0) / span) * 100,
        y: toY(point.cost),
      })),
    );
    const area = `${line}L100,100L0,100Z`;
    const change = visible[visible.length - 1].value - visible[0].value;
    return { coords, line, costLine, area, min, max, change };
  }, [visible]);

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
        <div className="history-grid" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        {geometry ? (
          <>
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-label="Verdiutvikling"
              role="img"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.28" />
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
            <div className="history-legend" aria-hidden="true">
              <span>
                <i style={{ background: color }} /> Verdi
              </span>
              <span>
                <i className="cost" /> Investert
              </span>
            </div>
            <span className="axis-label min">{money.format(geometry.min)}</span>
            <span className="axis-label max">{money.format(geometry.max)}</span>
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
    </div>
  );
}
