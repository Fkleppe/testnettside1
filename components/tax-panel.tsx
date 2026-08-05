"use client";

import { useEffect, useMemo, useState } from "react";
import { Landmark, SlidersHorizontal } from "lucide-react";
import {
  estimateSaleProceeds,
  SKJERMING_RATE,
  type SaleFees,
} from "@/lib/tax";
import type { Holding, PortfolioEvent } from "@/lib/types";

const SALE_FEES_KEY = "min-sparing-sale-fees";

const money = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

function loadSaleFees(): SaleFees {
  try {
    const raw = localStorage.getItem(SALE_FEES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: SaleFees = {};
    for (const [platform, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        out[platform] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** «Ved salg i dag»-estimat: brutto − salgsgebyr − skatt (med skjermings-
 *  fradrag og ASK-utsettelse) = netto utbetalt. Gebyrsatser er redigerbare
 *  per plattform — de endres over tid og hardkodes aldri. */
export function TaxPanel({
  holdings,
  events,
}: {
  holdings: Holding[];
  events: PortfolioEvent[];
}) {
  const [saleFees, setSaleFees] = useState<SaleFees>({});
  const [editingFees, setEditingFees] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setSaleFees(loadSaleFees()));
  }, []);

  const platforms = useMemo(
    () => [...new Set(holdings.map((item) => item.platform))].sort(),
    [holdings],
  );
  const estimate = useMemo(
    () => estimateSaleProceeds(holdings, events, saleFees),
    [holdings, events, saleFees],
  );

  if (!holdings.length || estimate.gross === 0) return null;

  const updateFee = (platform: string, raw: string) => {
    const value = Number(raw.replace(",", "."));
    setSaleFees((current) => {
      const next = { ...current };
      if (Number.isFinite(value) && value > 0) next[platform] = value;
      else delete next[platform];
      try {
        localStorage.setItem(SALE_FEES_KEY, JSON.stringify(next));
      } catch {
        // Kvotefeil skal aldri velte panelet.
      }
      return next;
    });
  };

  const hasAsk = estimate.askValue > 0;
  return (
    <section className="data-card tax-card" id="skatt">
      <div className="card-title-row">
        <div>
          <h2>Ved salg i dag</h2>
          <span>Skatt, gebyrer og skjerming · 2026-satser</span>
        </div>
        <Landmark size={16} />
      </div>
      <div className="tax-lines">
        <div className="tax-row">
          <span>Brutto salgsverdi</span>
          <b>{money.format(estimate.gross)}</b>
        </div>
        <div className="tax-row">
          <span className="tax-fee-label">
            Salgsgebyrer
            <button
              type="button"
              className={`tax-fee-edit ${editingFees ? "on" : ""}`}
              aria-expanded={editingFees}
              aria-label="Rediger salgsgebyr per plattform"
              onClick={() => setEditingFees((value) => !value)}
            >
              <SlidersHorizontal size={11} />
            </button>
          </span>
          <b>{estimate.fees > 0 ? `−${money.format(estimate.fees)}` : money.format(0)}</b>
        </div>
        {editingFees ? (
          <div className="tax-fee-editor">
            {platforms.map((platform) => (
              <label key={platform}>
                <span>{platform}</span>
                <input
                  inputMode="decimal"
                  placeholder="0"
                  aria-label={`Salgsgebyr i prosent hos ${platform}`}
                  defaultValue={saleFees[platform] ? String(saleFees[platform]) : ""}
                  onChange={(event) => updateFee(platform, event.target.value)}
                />
                <em>%</em>
              </label>
            ))}
            <small>
              Gebyr per salg (kurtasje/plattformgebyr). Fond er som regel 0 —
              sjekk prislisten hos din plattform.
            </small>
          </div>
        ) : null}
        {estimate.shielding > 0 ? (
          <div className="tax-row tax-info">
            <span>Skjermingsfradrag brukt</span>
            <b>{money.format(estimate.shielding)}</b>
          </div>
        ) : null}
        <div className="tax-row">
          <span>Skatt som utløses</span>
          <b>
            {estimate.taxNow > 0
              ? `−${money.format(estimate.taxNow)}`
              : money.format(0)}
          </b>
        </div>
        {estimate.deductionNow > 0 ? (
          <div className="tax-row tax-info">
            <span>Tapsfradrag til gode</span>
            <b className="positive">+{money.format(estimate.deductionNow)}</b>
          </div>
        ) : null}
        {hasAsk ? (
          <div className="tax-row tax-info">
            <span>Utsatt skatt i ASK</span>
            <b>{money.format(estimate.deferredTax)}</b>
          </div>
        ) : null}
        <div className="tax-row tax-total">
          <span>Netto utbetalt</span>
          <b>{money.format(estimate.net)}</b>
        </div>
      </div>
      <small className="tax-note">
        Estimat, ikke skatterådgivning. Skjerming: {" "}
        {(SKJERMING_RATE * 100).toLocaleString("nb-NO")} % (2025-rente, siste
        kunngjorte) × kostpris × hele eierår
        {estimate.unknownYears
          ? " — beholdninger uten kjøpsdato får 0 år"
          : ""}
        . {hasAsk
          ? "ASK: innskudd kan tas ut skattefritt; skatten på gevinst utløses først ved uttak utover innskudd. "
          : ""}
        Merk ASK-beholdninger via Rediger.
      </small>
    </section>
  );
}
