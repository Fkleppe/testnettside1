"use client";

import { useEffect, useState } from "react";
import { holdingValue } from "@/lib/portfolio";
import type { Holding } from "@/lib/types";

const money = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

type FundInfo = { ongoingCharge: number | null };

const PLATFORM_FEES_KEY = "min-sparing-platform-fees";

function loadPlatformFees(): Record<string, number> {
  try {
    const raw = localStorage.getItem(PLATFORM_FEES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

/** «Hva betaler jeg egentlig?» — årlig fondskostnad i kroner, noe verken
 *  Nordnet eller Kron viser samlet. Løpende kostnad hentes per ISIN. */
export function FeesCard({ holdings }: { holdings: Holding[] }) {
  const [info, setInfo] = useState<Record<string, FundInfo>>({});
  const [platformFees, setPlatformFees] = useState<Record<string, number>>({});
  useEffect(() => {
    queueMicrotask(() => setPlatformFees(loadPlatformFees()));
  }, []);
  const setFee = (platform: string, value: string) => {
    const pct = Number(value.replace(",", "."));
    setPlatformFees((current) => {
      const next = { ...current };
      if (Number.isFinite(pct) && pct > 0) next[platform] = pct;
      else delete next[platform];
      localStorage.setItem(PLATFORM_FEES_KEY, JSON.stringify(next));
      return next;
    });
  };
  const funds = holdings.filter((item) => item.kind === "fund");
  const isins = [
    ...new Set(
      funds
        .map((item) => item.symbol.toUpperCase())
        .filter((symbol) => /^[A-Z]{2}[A-Z0-9]{10}$/.test(symbol)),
    ),
  ];
  const key = isins.sort().join("|");
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        key.split("|").map(async (isin) => {
          try {
            const response = await fetch(
              `/api/fundinfo?isin=${encodeURIComponent(isin)}`,
            );
            if (!response.ok) return [isin, { ongoingCharge: null }] as const;
            const json = await response.json();
            return [
              isin,
              { ongoingCharge: json.ongoingCharge ?? null },
            ] as const;
          } catch {
            return [isin, { ongoingCharge: null }] as const;
          }
        }),
      );
      if (!cancelled) setInfo(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (funds.length === 0) return null;
  const rows = funds
    .map((item) => {
      const charge = info[item.symbol.toUpperCase()]?.ongoingCharge ?? null;
      const value = holdingValue(item);
      return {
        id: item.id,
        name: item.name,
        charge,
        annual: charge !== null ? (value * charge) / 100 : null,
        value,
      };
    })
    .sort((a, b) => (b.annual ?? 0) - (a.annual ?? 0));
  const known = rows.filter((row) => row.annual !== null);
  if (known.length === 0) return null;
  // Plattformavgift: verdi per plattform × brukerens sats (bytter du
  // plattform på en beholdning, flytter kostnaden seg automatisk).
  const byPlatform = new Map<string, number>();
  for (const item of funds) {
    const platform = item.platform || "Ukjent";
    byPlatform.set(
      platform,
      (byPlatform.get(platform) ?? 0) + holdingValue(item),
    );
  }
  const platformRows = [...byPlatform.entries()].map(([platform, value]) => ({
    platform,
    value,
    pct: platformFees[platform] ?? null,
    annual:
      platformFees[platform] != null
        ? (value * platformFees[platform]) / 100
        : 0,
  }));
  const platformAnnual = platformRows.reduce((sum, row) => sum + row.annual, 0);
  const totalAnnual =
    known.reduce((sum, row) => sum + (row.annual ?? 0), 0) + platformAnnual;
  const totalValue = known.reduce((sum, row) => sum + row.value, 0);
  const weighted = totalValue ? (totalAnnual / totalValue) * 100 : 0;

  return (
    <section className="data-card fees-card">
      <div className="card-title-row">
        <div>
          <h2>Kostnader</h2>
          <span>Løpende fondskostnader per år</span>
        </div>
      </div>
      <div className="fees-total">
        <strong>≈ {money.format(totalAnnual)}</strong>
        <small>
          per år · {weighted.toLocaleString("nb-NO", { maximumFractionDigits: 2 })}{" "}
          % vektet
        </small>
      </div>
      <div className="fees-list">
        {rows.map((row) => (
          <div key={row.id} className="fees-row">
            <span title={row.name}>{row.name}</span>
            <em>
              {row.charge !== null
                ? `${row.charge.toLocaleString("nb-NO", { maximumFractionDigits: 2 })} %`
                : "—"}
            </em>
            <b>{row.annual !== null ? money.format(row.annual) : "—"}</b>
          </div>
        ))}
      </div>
      <div className="fees-platforms">
        <small>Plattformavgift per år (din sats i %)</small>
        {platformRows.map((row) => (
          <div key={row.platform} className="fees-row">
            <span>{row.platform}</span>
            <em>
              <input
                inputMode="decimal"
                placeholder="0,00"
                defaultValue={row.pct ?? ""}
                aria-label={`Plattformavgift for ${row.platform} i prosent`}
                onBlur={(event) => setFee(row.platform, event.target.value)}
              />
              %
            </em>
            <b>{row.pct != null ? money.format(row.annual) : "—"}</b>
          </div>
        ))}
      </div>
      <p className="fees-note">
        Fondskostnader fra fondenes oppgitte satser; plattformavgift bruker
        satsene du selv setter (sjekk plattformens prisliste). Transaksjons-
        gebyrer kommer i tillegg.
      </p>
    </section>
  );
}
