"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import {
  dailyValue,
  hasCalendarDayChange,
  holdingDailyPercent,
} from "@/lib/portfolio";
import { localDateKey } from "@/lib/history";
import { formatDateKey } from "@/lib/portfolio";
import type { Holding } from "@/lib/types";

const money = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
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

function hasMove(item: Holding) {
  if (hasCalendarDayChange(item)) return true;
  return (
    item.changePeriod === "24h" &&
    item.dailyPercent !== null &&
    item.dailyPercent !== undefined
  );
}

/** dailyValue er bevisst 0 for rullerende 24 t (kalenderdag-integritet i
 *  totalene); i denne listen viser vi 24 t-utslaget eksplisitt merket. */
function moveValue(item: Holding) {
  if (hasCalendarDayChange(item)) return dailyValue(item);
  if (item.changePeriod !== "24h") return 0;
  if (Number.isFinite(item.previousPrice) && (item.previousPrice ?? 0) > 0) {
    return item.units * (item.price - (item.previousPrice ?? item.price));
  }
  const percent = item.dailyPercent ?? 0;
  if (percent <= -100) return 0;
  return (item.units * item.price * percent) / (100 + percent);
}

/** Dagens største bevegelser i kroner — bare beholdninger med reell
 *  kursendring i dag (eller rullerende 24 t for krypto). */
export function MoversCard({ holdings }: { holdings: Holding[] }) {
  const movers = holdings
    .filter(hasMove)
    .map((item) => ({
      item,
      change: moveValue(item),
      percent: holdingDailyPercent(item) ?? item.dailyPercent,
    }))
    .filter((mover) => Math.abs(mover.change) > 0.005)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 4);
  if (movers.length === 0) return null;
  return (
    <section className="movers-card">
      <div className="card-title-row">
        <h2>
          {movers.some(
            ({ item }) =>
              item.changePeriod !== "24h" &&
              item.priceDate &&
              item.priceDate < localDateKey(new Date()),
          )
            ? "Siste bevegelser"
            : "Dagens bevegelser"}
        </h2>
        <span className="card-context">Størst utslag</span>
      </div>
      <div className="movers-list">
        {movers.map(({ item, change, percent }) => (
          <div key={item.id} className="mover-row">
            <i className={change >= 0 ? "positive" : "negative"}>
              {change >= 0 ? (
                <TrendingUp size={13} />
              ) : (
                <TrendingDown size={13} />
              )}
            </i>
            <span>
              <b>{item.name}</b>
              <small>
                {item.platform}
                {item.changePeriod === "24h"
                  ? " · 24 t"
                  : item.priceDate &&
                      item.priceDate < localDateKey(new Date())
                    ? ` · NAV ${formatDateKey(item.priceDate)}`
                    : ""}
              </small>
            </span>
            <em>
              <b className={change >= 0 ? "positive" : "negative"}>
                {signedMoney(change)}
              </b>
              <small className={change >= 0 ? "positive" : "negative"}>
                {percent !== null && percent !== undefined
                  ? signedPercent(percent)
                  : "—"}
              </small>
            </em>
          </div>
        ))}
      </div>
    </section>
  );
}
