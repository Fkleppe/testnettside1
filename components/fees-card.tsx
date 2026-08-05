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

/** «Hva betaler jeg egentlig?» — årlig fondskostnad i kroner, noe verken
 *  Nordnet eller Kron viser samlet. Løpende kostnad hentes per ISIN. */
export function FeesCard({ holdings }: { holdings: Holding[] }) {
  const [info, setInfo] = useState<Record<string, FundInfo>>({});
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
  const totalAnnual = known.reduce((sum, row) => sum + (row.annual ?? 0), 0);
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
      <p className="fees-note">
        Basert på fondenes oppgitte løpende kostnader og dagens verdi. Plattform-
        og transaksjonsgebyrer kommer i tillegg.
      </p>
    </section>
  );
}
