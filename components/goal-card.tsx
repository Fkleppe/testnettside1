"use client";

import { useState } from "react";
import { Pencil, Target } from "lucide-react";
import type { SavingsGoal } from "@/lib/types";
import type { DailySnapshot } from "@/lib/history";
import { goalProjection } from "@/lib/goal";

const money = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

/** Sparemål: mål + fremdrift, synkroniseres i porteføljekonvolutten.
 *  amount 0 = gravstein (mål fjernet) og rendres som «ingen mål». */
export function GoalCard({
  goal,
  currentValue,
  snapshots,
  editable,
  onChange,
}: {
  goal: SavingsGoal | null;
  currentValue: number;
  snapshots: DailySnapshot[];
  editable: boolean;
  onChange: (goal: SavingsGoal) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const active = goal && goal.amount > 0 ? goal : null;

  const save = () => {
    const parsed = Number(amount.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onChange({
      amount: parsed,
      label: label.trim() || undefined,
      setAt: new Date().toISOString(),
    });
    setEditing(false);
  };

  if (!active && !editing) {
    if (!editable) return null;
    return (
      <button className="goal-empty" onClick={() => setEditing(true)}>
        <Target size={15} />
        <span>Sett et sparemål</span>
      </button>
    );
  }

  if (editing) {
    return (
      <section className="movers-card goal-card">
        <div className="card-title-row">
          <h2>Sparemål</h2>
        </div>
        <div className="goal-form">
          <input
            inputMode="numeric"
            placeholder="F.eks. 3 000 000"
            aria-label="Målbeløp i kroner"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <input
            placeholder="Navn (valgfritt) — f.eks. «Frihet 2030»"
            aria-label="Navn på målet"
            maxLength={40}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <div>
            <button className="goal-save" onClick={save}>
              Lagre mål
            </button>
            <button className="goal-cancel" onClick={() => setEditing(false)}>
              Avbryt
            </button>
            {active ? (
              <button
                className="goal-remove"
                onClick={() => {
                  onChange({ amount: 0, setAt: new Date().toISOString() });
                  setEditing(false);
                }}
              >
                Fjern mål
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  const progress = Math.min(100, (currentValue / active!.amount) * 100);
  const projection = goalProjection(snapshots, currentValue, active!.amount);
  return (
    <section className="movers-card goal-card">
      <div className="card-title-row">
        <h2>{active!.label ?? "Sparemål"}</h2>
        {editable ? (
          <button
            className="goal-edit"
            aria-label="Endre sparemål"
            onClick={() => {
              setAmount(String(active!.amount));
              setLabel(active!.label ?? "");
              setEditing(true);
            }}
          >
            <Pencil size={12} />
          </button>
        ) : null}
      </div>
      <div className="goal-progress">
        <strong>
          {progress.toLocaleString("nb-NO", { maximumFractionDigits: 1 })} %
        </strong>
        <span className="goal-meter">
          <i style={{ width: `${progress}%` }} />
        </span>
        <small>
          {money.format(currentValue)} av {money.format(active!.amount)}
          {progress >= 100 ? " · Målet er nådd!" : ""}
        </small>
        {projection.remaining > 0 ? (
          <span className="goal-eta">
            <b>Mangler {money.format(projection.remaining)}</b>
            {projection.etaLabel ? <em>{projection.etaLabel}</em> : null}
          </span>
        ) : null}
      </div>
    </section>
  );
}
