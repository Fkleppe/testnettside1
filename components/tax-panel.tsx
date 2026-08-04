"use client";

import { Landmark } from "lucide-react";
import { holdingValue } from "@/lib/portfolio";
import { estimateRealizationTax } from "@/lib/tax";
import type { Holding } from "@/lib/types";

const money = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

export function TaxPanel({ holdings }: { holdings: Holding[] }) {
  const estimate = estimateRealizationTax(holdings);
  if (!holdings.length || estimate.totalGain + estimate.totalLoss === 0) {
    return null;
  }
  return (
    <section className="data-card tax-card" id="skatt">
      <div className="card-title-row">
        <div>
          <h2>Skatteestimat</h2>
          <span>Hvis alt selges i dag · 2026-satser</span>
        </div>
        <Landmark size={16} />
      </div>
      <div className="tax-lines">
        {estimate.lines.map((line) => (
          <div className="tax-row" key={line.label}>
            <span>{line.label}</span>
            <b>
              {line.tax > 0
                ? money.format(line.tax)
                : line.deduction > 0
                  ? `−${money.format(line.deduction)}`
                  : money.format(0)}
            </b>
          </div>
        ))}
        <div className="tax-row tax-total">
          <span>Estimert skatt</span>
          <b>{money.format(Math.max(0, estimate.totalTax - estimate.totalDeduction))}</b>
        </div>
        <div className="tax-row">
          <span>Verdi etter skatt</span>
          <b>
            {money.format(
              holdings.reduce((sum, item) => sum + holdingValue(item), 0) -
                Math.max(0, estimate.totalTax - estimate.totalDeduction),
            )}
          </b>
        </div>
      </div>
      <small className="tax-note">
        Forenklet estimat: skjermingsfradrag, ASK/fondskonto-utsettelse og
        rentefond-satser er ikke medregnet. Ikke skatterådgivning.
      </small>
    </section>
  );
}
