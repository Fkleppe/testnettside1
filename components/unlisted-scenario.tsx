"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { holdingValue } from "@/lib/portfolio";
import type { Holding } from "@/lib/types";

const STORAGE_KEY = "min-sparing-unlisted-assumptions";

type Assumption = { totalShares?: number; marketCap?: number };

/** Kjente antall utestående aksjer (fra offentlige registre) — brukes som
 *  forhåndsutfylling; brukeren kan alltid overstyre. */
const KNOWN_TOTAL_SHARES: Record<string, number> = {
  FIRI: 152_679_600,
};

const money = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});
const compact = new Intl.NumberFormat("nb-NO", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function parseAmount(value: string) {
  return Number(value.replace(/\s/g, "").replace(",", ".")) || 0;
}

function groupDigits(raw: string) {
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function loadAssumptions(): Record<string, Assumption> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Assumption>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** Scenario for unoterte aksjer: skriv inn selskapets estimerte
 *  markedsverdi og se hva DIN post er verdt gitt eierandelen din. */
export function UnlistedScenario({ holdings }: { holdings: Holding[] }) {
  const unlisted = holdings.filter((item) => item.listing === "unlisted");
  const [assumptions, setAssumptions] = useState<Record<string, Assumption>>(
    {},
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useEffect(() => {
    queueMicrotask(() => setAssumptions(loadAssumptions()));
  }, []);

  /** Levende tusenskille uten at markøren hopper: tell sifre foran
   *  markøren, formater, og sett markøren bak samme antall sifre. */
  const handleAmount = (
    event: React.ChangeEvent<HTMLInputElement>,
    draftKey: string,
    commit: (amount: number) => void,
  ) => {
    const element = event.target;
    const caretDigits = element.value
      .slice(0, element.selectionStart ?? element.value.length)
      .replace(/\D/g, "").length;
    const raw = element.value.replace(/\D/g, "").slice(0, 15);
    const formatted = groupDigits(raw);
    setDrafts((current) => ({ ...current, [draftKey]: formatted }));
    commit(Number(raw) || 0);
    requestAnimationFrame(() => {
      let position = 0;
      let seen = 0;
      while (position < formatted.length && seen < caretDigits) {
        if (/\d/.test(formatted[position])) seen += 1;
        position += 1;
      }
      element.setSelectionRange(position, position);
    });
  };

  const update = (id: string, patch: Assumption) => {
    setAssumptions((current) => {
      const next = { ...current, [id]: { ...current[id], ...patch } };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Kvotefeil skal aldri velte panelet.
      }
      return next;
    });
  };

  if (unlisted.length === 0) {
    return (
      <div className="unlisted-scenario-empty">
        <Building2 size={18} />
        <b>Ingen unoterte aksjer ennå</b>
        <small>
          Legg til en unotert aksje i Beholdning (Legg til → Unotert), så kan
          du regne på selskapsverdier her.
        </small>
      </div>
    );
  }

  return (
    <div className="unlisted-scenario">
      {unlisted.map((item) => {
        const stored = assumptions[item.id] ?? {};
        const totalShares =
          stored.totalShares ?? KNOWN_TOTAL_SHARES[item.symbol] ?? 0;
        const marketCap = stored.marketCap ?? 0;
        const share = totalShares > 0 ? item.units / totalShares : 0;
        const impliedPerShare = totalShares > 0 ? marketCap / totalShares : 0;
        const yourValue = marketCap * share;
        const booked = holdingValue(item);
        const diff = yourValue - booked;
        const ready = totalShares > 0 && marketCap > 0;
        return (
          <div className="unlisted-company" key={item.id}>
            <div className="unlisted-company-head">
              <b>{item.name}</b>
              <small>
                Du eier {item.units.toLocaleString("nb-NO")} aksjer
                {share > 0
                  ? ` · ${(share * 100).toLocaleString("nb-NO", {
                      maximumFractionDigits: 3,
                    })} % av selskapet`
                  : ""}
              </small>
            </div>
            <div className="unlisted-inputs">
              <label>
                Aksjer totalt i selskapet
                <input
                  inputMode="numeric"
                  placeholder="F.eks. 152 679 600"
                  value={
                    drafts[`${item.id}:t`] ??
                    (totalShares > 0 ? groupDigits(String(totalShares)) : "")
                  }
                  onChange={(event) =>
                    handleAmount(event, `${item.id}:t`, (amount) =>
                      update(item.id, { totalShares: amount }),
                    )
                  }
                />
              </label>
              <label>
                Estimert markedsverdi (kr)
                <input
                  inputMode="numeric"
                  placeholder="F.eks. 916 000 000"
                  value={
                    drafts[`${item.id}:m`] ??
                    (marketCap > 0 ? groupDigits(String(marketCap)) : "")
                  }
                  onChange={(event) =>
                    handleAmount(event, `${item.id}:m`, (amount) =>
                      update(item.id, { marketCap: amount }),
                    )
                  }
                />
              </label>
            </div>
            {ready ? (
              <div className="unlisted-result">
                <div className="unlisted-your-value">
                  <span>Din verdi ved {compact.format(marketCap)}</span>
                  <b>{money.format(yourValue)}</b>
                  <small>
                    {money.format(impliedPerShare)} per aksje ·{" "}
                    <em className={diff >= 0 ? "positive" : "negative"}>
                      {diff >= 0 ? "+" : "−"}
                      {money.format(Math.abs(diff))}
                    </em>{" "}
                    vs. dagens estimat ({money.format(booked)})
                  </small>
                </div>
              </div>
            ) : (
              <p className="unlisted-waiting">
                Fyll inn begge feltene for å regne ut verdien din.
              </p>
            )}
          </div>
        );
      })}
      <p className="unlisted-note">
        Scenario, ikke verdivurdering — unoterte kurser settes først ved
        faktiske transaksjoner. Oppdater beholdningens kurs i Rediger når
        du vil bokføre et nytt estimat.
      </p>
    </div>
  );
}
