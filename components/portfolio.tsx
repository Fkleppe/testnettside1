"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Baby,
  BriefcaseBusiness,
  ChevronDown,
  CircleHelp,
  Clock3,
  Coins,
  Eye,
  Landmark,
  ListFilter,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { searchInstruments, type Instrument } from "@/lib/catalog";
import { demoHoldings } from "@/lib/demo";
import {
  calculateTotals,
  dailyValue,
  getQuoteState,
  hasCalendarDayChange,
  holdingDailyPercent,
  holdingValue,
  migrateHolding,
} from "@/lib/portfolio";
import type { AccountGroup, AssetKind, Holding, PriceMode } from "@/lib/types";

const STORAGE_KEY = "min-sparing-holdings-v1";
const money = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 4 });
const kindLabel: Record<AssetKind, string> = {
  fund: "Fond",
  stock: "Aksje",
  crypto: "Krypto",
};
const kindIcon = { fund: Landmark, stock: WalletCards, crypto: Coins };
const accountOrder: AccountGroup[] = [
  "private",
  "business",
  "family",
  "pension",
];
const accountConfig: Record<
  AccountGroup,
  { label: string; short: string; color: string; icon: typeof UserRound }
> = {
  private: {
    label: "Privat",
    short: "PR",
    color: "var(--account-private)",
    icon: UserRound,
  },
  business: {
    label: "Bedrift",
    short: "AS",
    color: "var(--account-business)",
    icon: BriefcaseBusiness,
  },
  family: {
    label: "Barn & familie",
    short: "BF",
    color: "var(--account-family)",
    icon: Baby,
  },
  pension: {
    label: "Pensjon",
    short: "PS",
    color: "var(--account-pension)",
    icon: ShieldCheck,
  },
};
type AccountFilter = "all" | AccountGroup;
type SortMode = "value" | "today" | "name";

export function Portfolio() {
  const [holdings, setHoldings] = useState<Holding[]>(demoHoldings);
  const [ready, setReady] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [activeAccount, setActiveAccount] = useState<AccountFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("value");

  useEffect(() => {
    queueMicrotask(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Holding[];
          const migrated = parsed.map(migrateHolding);
          setHoldings(migrated);
          void refreshOfficialFunds(migrated).then(setHoldings);
        } catch {}
      }
      setReady(true);
    });
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
  }, [holdings, ready]);

  const visibleHoldings = useMemo(
    () =>
      holdings.filter(
        (item) => activeAccount === "all" || getAccount(item) === activeAccount,
      ),
    [holdings, activeAccount],
  );
  const sortedHoldings = useMemo(
    () =>
      [...visibleHoldings].sort((a, b) =>
        sortMode === "name"
          ? a.name.localeCompare(b.name, "nb")
          : sortMode === "today"
            ? dailyValue(b) - dailyValue(a)
            : holdingValue(b) - holdingValue(a),
      ),
    [visibleHoldings, sortMode],
  );
  const totals = useMemo(
    () => calculateTotals(visibleHoldings),
    [visibleHoldings],
  );
  const allTotals = useMemo(() => calculateTotals(holdings), [holdings]);
  const accountTotals = useMemo(
    () =>
      Object.fromEntries(
        accountOrder.map((group) => [
          group,
          calculateTotals(
            holdings.filter((item) => getAccount(item) === group),
          ),
        ]),
      ) as Record<AccountGroup, ReturnType<typeof calculateTotals>>,
    [holdings],
  );
  const remove = (id: string) =>
    setHoldings((current) => current.filter((item) => item.id !== id));
  const update = (next: Holding) =>
    setHoldings((current) =>
      current.map((item) => (item.id === next.id ? next : item)),
    );
  const moveAccount = (id: string, accountGroup: AccountGroup) =>
    setHoldings((current) =>
      current.map((item) =>
        item.id === id ? { ...item, accountGroup } : item,
      ),
    );

  return (
    <main className="app-shell">
      <div className="market-strip">
        <div className="market-strip-inner">
          <span>
            <i /> MIN SPARING
          </span>
          <span>
            I dag{" "}
            <b className={allTotals.today >= 0 ? "positive" : "negative"}>
              {allTotals.updated
                ? signedPercent(allTotals.todayPercent)
                : "Ikke beregnet"}
            </b>
          </span>
          <span>
            Total verdi <b>{money.format(allTotals.value)}</b>
          </span>
          <span>
            Dagens data{" "}
            <b>
              {allTotals.updated}/{allTotals.positions}
            </b>
          </span>
          <small>Alle beløp i NOK</small>
        </div>
      </div>
      <header className="main-header">
        <div className="header-inner">
          <a className="brand" href="#top" aria-label="Min Sparing – oversikt">
            <span className="brand-symbol">
              <i />
              <i />
            </span>
            <b>Min Sparing</b>
          </a>
          <nav>
            <a className="active" href="#top">
              Mine sider
            </a>
            <a href="#beholdning">Beholdning</a>
            <a href="#datakilder">Datakilder</a>
            <a href="#fordeling">Fordeling</a>
          </nav>
          <div className="header-actions">
            <button
              className={`mode-toggle ${advanced ? "active" : ""}`}
              aria-pressed={advanced}
              onClick={() => {
                setAdvanced((value) => !value);
                setAdding(false);
                setEditing(null);
              }}
            >
              {advanced ? <Settings2 size={14} /> : <Eye size={14} />}
              {advanced ? "Avansert" : "Visning"}
            </button>
            {advanced ? (
              <button className="transfer" onClick={() => setAdding(true)}>
                Legg til
              </button>
            ) : null}
            {advanced ? (
              <button className="search-button" onClick={() => setAdding(true)}>
                <Search size={15} /> Søk
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="nordnet-shell" id="top">
        <h1>Min økonomi</h1>
        <nav className="economy-tabs">
          <button className="active">Oversikt</button>
          <a href="#beholdning">Beholdning</a>
          <a href="#datakilder">Datakvalitet</a>
          <a href="#fordeling">Fordeling</a>
        </nav>
        {advanced ? (
          <div className="advanced-notice">
            <Settings2 size={15} />
            <span>
              <b>Avansert modus er på.</b> Du kan endre beholdninger og
              inngangsverdier. Sletting må bekreftes.
            </span>
            <button
              onClick={() => {
                setAdvanced(false);
                setAdding(false);
                setEditing(null);
              }}
            >
              <Eye size={14} /> Gå til visning
            </button>
          </div>
        ) : null}

        <section className="portfolio-grid">
          <div className="left-column">
            <AccountRail
              active={activeAccount}
              onChange={setActiveAccount}
              allTotals={allTotals}
              totals={accountTotals}
              advanced={advanced}
              onAdd={() => setAdding(true)}
            />
            <BreakdownPanel
              totals={accountTotals}
              allTotals={allTotals}
              active={activeAccount}
              onChange={setActiveAccount}
            />
          </div>
          <div className="center-column">
            <EquityPanel
              holdings={visibleHoldings}
              totals={totals}
              activeAccount={activeAccount}
            />
            <section className="holdings-card" id="beholdning">
              <div className="card-title-row">
                <div>
                  <h2>Beholdning</h2>
                  <span>
                    {activeAccount === "all"
                      ? "Alle kontoer"
                      : accountConfig[activeAccount].label}{" "}
                    · {visibleHoldings.length} investeringer
                  </span>
                </div>
                <div className="holdings-controls">
                  {advanced ? (
                    <button
                      className="add-small"
                      onClick={() => setAdding(true)}
                    >
                      <Plus size={14} /> Legg til
                    </button>
                  ) : (
                    <span className="read-only-badge">
                      <LockKeyhole size={12} /> Kun visning
                    </span>
                  )}
                  <label>
                    <ListFilter size={14} />
                    <select
                      aria-label="Sorter investeringer"
                      value={sortMode}
                      onChange={(event) =>
                        setSortMode(event.target.value as SortMode)
                      }
                    >
                      <option value="value">Størst verdi</option>
                      <option value="today">Dagens utvikling</option>
                      <option value="name">Navn A–Å</option>
                    </select>
                    <ChevronDown size={13} />
                  </label>
                </div>
              </div>
              <div className="holding-head">
                <span>Investering</span>
                <span>Konto</span>
                <span>Verdi</span>
                <span>I dag</span>
                <span />
              </div>
              <div className="holding-list">
                {sortedHoldings.map((item) => (
                  <HoldingRow
                    key={item.id}
                    item={item}
                    advanced={advanced}
                    onEdit={() => setEditing(item)}
                    onAccountChange={(group) => moveAccount(item.id, group)}
                  />
                ))}
                {!sortedHoldings.length ? (
                  <div className="empty">
                    <p>Ingen investeringer på denne kontoen.</p>
                    {advanced ? (
                      <button onClick={() => setAdding(true)}>
                        Legg til investering
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>
          </div>
          <aside className="right-stack">
            <TodayPanel totals={totals} />
            <DataPanel holdings={visibleHoldings} />
            <ForecastPanel currentValue={totals.value} />
          </aside>
        </section>
      </div>
      <footer>
        <div>
          <b>Min Sparing</b>
          <span>Samlet oversikt · ikke investeringsråd</span>
        </div>
        <div>
          <a href="#top">Oversikt</a>
          <a href="#beholdning">Beholdning</a>
          <a href="#datakilder">Datakvalitet</a>
        </div>
        <small>Data lagres lokalt på enheten din</small>
      </footer>
      {advanced && adding ? (
        <AddPanel
          onClose={() => setAdding(false)}
          onAdd={(item) => {
            setHoldings((current) => [item, ...current]);
            setActiveAccount(item.accountGroup ?? "private");
            setAdding(false);
          }}
        />
      ) : null}
      {advanced && editing ? (
        <EditPanel
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(item) => {
            update(item);
            setEditing(null);
          }}
          onDelete={(id) => {
            remove(id);
            setEditing(null);
          }}
        />
      ) : null}
    </main>
  );
}

function AccountRail({
  active,
  onChange,
  allTotals,
  totals,
  advanced,
  onAdd,
}: {
  active: AccountFilter;
  onChange: (value: AccountFilter) => void;
  allTotals: ReturnType<typeof calculateTotals>;
  totals: Record<AccountGroup, ReturnType<typeof calculateTotals>>;
  advanced: boolean;
  onAdd: () => void;
}) {
  return (
    <aside className="accounts-card">
      <div className="card-title-row">
        <h2>Kontoer</h2>
        <span className="card-context">Sortert etter eier</span>
      </div>
      <button
        className={`account-row all ${active === "all" ? "selected" : ""}`}
        onClick={() => onChange("all")}
      >
        <span className="account-avatar">MS</span>
        <span>
          <b>Alle kontoer</b>
          <small>{allTotals.positions} investeringer</small>
        </span>
        <em>
          <b>{money.format(allTotals.value)}</b>
          <small className={allTotals.today >= 0 ? "positive" : "negative"}>
            {allTotals.updated
              ? signedPercent(allTotals.todayPercent)
              : "Ikke beregnet"}
          </small>
        </em>
      </button>
      {accountOrder.map((group) => {
        const config = accountConfig[group];
        const values = totals[group];
        return (
          <button
            key={group}
            className={`account-row ${active === group ? "selected" : ""}`}
            style={{ "--account-color": config.color } as CSSProperties}
            onClick={() => onChange(group)}
          >
            <span className="account-avatar">{config.short}</span>
            <span>
              <b>{config.label}</b>
              <small>{values.positions} investeringer</small>
            </span>
            <em>
              <small className={values.today >= 0 ? "positive" : "negative"}>
                {values.updated ? signedPercent(values.todayPercent) : "—"}
              </small>
              <b>{money.format(values.value)}</b>
            </em>
          </button>
        );
      })}
      {advanced ? (
        <div className="account-actions">
          <button onClick={onAdd}>Ny investering</button>
          <button onClick={onAdd}>Legg til</button>
        </div>
      ) : (
        <div className="account-lock">
          <LockKeyhole size={13} /> Endringer er låst
        </div>
      )}
    </aside>
  );
}

function EquityPanel({
  holdings,
  totals,
  activeAccount,
}: {
  holdings: Holding[];
  totals: ReturnType<typeof calculateTotals>;
  activeAccount: AccountFilter;
}) {
  const states = holdings.map((item) => getQuoteState(item));
  const withinWindow = states.filter(
    (state) =>
      state.code === "awaiting_market_close" ||
      state.code === "within_publication_window" ||
      state.code === "official_previous",
  ).length;
  const late = states.filter((state) => state.code === "source_late").length;
  return (
    <section className="equity-card">
      <div className="equity-top">
        <div>
          <span>
            {activeAccount === "all"
              ? "Egenkapital"
              : accountConfig[activeAccount].label}
          </span>
          <h2>{money.format(totals.value).replace("kr", "NOK")}</h2>
          <p>
            Dagens utvikling{" "}
            <b className={totals.today >= 0 ? "positive" : "negative"}>
              {totals.updated
                ? `${signedPercent(totals.todayPercent)} · ${signedMoney(totals.today)}`
                : "Ikke beregnet"}
            </b>
          </p>
        </div>
        <div className="data-coverage">
          <span>Dagens datagrunnlag</span>
          <b>
            {totals.updated} av {totals.positions}
          </b>
        </div>
      </div>
      <div className="history-empty">
        <div className="history-grid" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div>
          <Clock3 size={20} />
          <span>
            <b>Historikk bygges fra neste dagsoppdatering</b>
            <small>
              Vi viser ikke en tidsserie før porteføljen har ekte daglige
              snapshots.
            </small>
          </span>
        </div>
      </div>
      <div className="range-row">
        <div className="selected">
          <span>I dag</span>
          <b className={totals.today >= 0 ? "positive" : "negative"}>
            {totals.updated ? signedPercent(totals.todayPercent) : "—"}
          </b>
        </div>
        <div>
          <span>Totalt</span>
          <b className={totals.totalPercent >= 0 ? "positive" : "negative"}>
            {signedPercent(totals.totalPercent)}
          </b>
        </div>
        <div>
          <span>Investert</span>
          <b>{money.format(totals.cost)}</b>
        </div>
        <div>
          <span>Avkastning</span>
          <b className={totals.total >= 0 ? "positive" : "negative"}>
            {signedMoney(totals.total)}
          </b>
        </div>
      </div>
      <div className="equity-links">
        <div>
          <span>Dagens utvikling tilgjengelig</span>
          <b>
            {totals.updated} av {totals.positions}
          </b>
        </div>
        <div>
          <span>
            {late ? "Datakilde etter fristen" : "Innen normal publisering"}
          </span>
          <b>{late || withinWindow}</b>
        </div>
      </div>
    </section>
  );
}

function TodayPanel({
  totals,
}: {
  totals: ReturnType<typeof calculateTotals>;
}) {
  return (
    <section className="today-card">
      <div className="card-title-row">
        <h2>Dagens utvikling</h2>
        <Clock3 size={16} />
      </div>
      <div className="today-value">
        <strong className={totals.today >= 0 ? "positive" : "negative"}>
          {totals.updated ? signedMoney(totals.today) : "—"}
        </strong>
        <b className={totals.today >= 0 ? "positive" : "negative"}>
          {totals.updated
            ? signedPercent(totals.todayPercent)
            : "Ikke beregnet"}
        </b>
      </div>
      <div className="coverage">
        <span>
          <i style={{ width: `${totals.coveragePercent}%` }} />
        </span>
        <small>
          {totals.updated} av {totals.positions} investeringer ·{" "}
          {Math.round(totals.coveragePercent)} % av verdien
        </small>
      </div>
    </section>
  );
}

function DataPanel({ holdings }: { holdings: Holding[] }) {
  const states = holdings.map((item) => getQuoteState(item));
  const current = holdings.filter(hasCalendarDayChange).length;
  const normal = states.filter(
    (state) =>
      state.code === "awaiting_market_close" ||
      state.code === "within_publication_window" ||
      state.code === "official_previous",
  ).length;
  const late = states.filter((state) => state.code === "source_late").length;
  const manual = states.filter(
    (state) => state.code === "manual_override",
  ).length;
  return (
    <section className="data-card" id="datakilder">
      <div className="card-title-row">
        <div>
          <h2>Datakvalitet</h2>
          <span>Hva tallene faktisk bygger på</span>
        </div>
      </div>
      <div className="quality-list">
        <div>
          <span className="quality-dot live" />
          <p>
            <b>Dagens utvikling tilgjengelig</b>
            <small>{current} investeringer</small>
          </p>
        </div>
        <div>
          <span className="quality-dot nav" />
          <p>
            <b>Innen normal publisering</b>
            <small>{normal} investeringer</small>
          </p>
        </div>
        <div>
          <span className="quality-dot late" />
          <p>
            <b>Datakilde etter fristen</b>
            <small>{late} investeringer</small>
          </p>
        </div>
        <div>
          <span className="quality-dot manual" />
          <p>
            <b>Manuelt registrert</b>
            <small>{manual} investeringer</small>
          </p>
        </div>
      </div>
      <div className={`quality-message ${late ? "has-warning" : ""}`}>
        <CircleHelp size={22} />
        <p>
          <b>
            {late
              ? "En datakilde er etter normalfristen."
              : "Manglende fondskurs er ikke alltid forsinket."}
          </b>
          <span>
            {late
              ? "Åpne beholdningen for å se hvilken NAV-dato som mangler."
              : "Vi viser forventet publisering og varsler først når fristen faktisk er passert."}
          </span>
        </p>
      </div>
    </section>
  );
}

function ForecastPanel({ currentValue }: { currentValue: number }) {
  const [years, setYears] = useState(5);
  const [annualReturn, setAnnualReturn] = useState("7");
  const [monthlySaving, setMonthlySaving] = useState("0");
  const rate = Math.max(-99, Math.min(50, toNumber(annualReturn)));
  const monthly = Math.max(0, toNumber(monthlySaving));
  const cautious = projectValue(currentValue, monthly, rate - 4, years);
  const expected = projectValue(currentValue, monthly, rate, years);
  const optimistic = projectValue(currentValue, monthly, rate + 4, years);

  return (
    <section className="forecast-card" id="prognose">
      <div className="card-title-row">
        <div>
          <h2>Fremtidsestimat</h2>
          <span>Scenario, ikke en prognose</span>
        </div>
        <TrendingUp size={16} />
      </div>
      <div className="forecast-years" aria-label="Tidshorisont">
        {[1, 3, 5, 10].map((value) => (
          <button
            key={value}
            className={years === value ? "selected" : ""}
            onClick={() => setYears(value)}
          >
            {value} år
          </button>
        ))}
      </div>
      <div className="forecast-main">
        <span>Estimert verdi om {years} år</span>
        <strong>{money.format(expected)}</strong>
        <small>{money.format(currentValue)} i dag</small>
      </div>
      <div className="forecast-range">
        <div>
          <span>Forsiktig</span>
          <b>{money.format(cautious)}</b>
          <small>{formatRate(rate - 4)} årlig</small>
        </div>
        <div className="selected">
          <span>Valgt</span>
          <b>{money.format(expected)}</b>
          <small>{formatRate(rate)} årlig</small>
        </div>
        <div>
          <span>Sterk</span>
          <b>{money.format(optimistic)}</b>
          <small>{formatRate(rate + 4)} årlig</small>
        </div>
      </div>
      <div className="forecast-inputs">
        <label>
          Forventet avkastning
          <span>
            <input
              inputMode="decimal"
              value={annualReturn}
              onChange={(event) => setAnnualReturn(event.target.value)}
              aria-label="Forventet årlig avkastning"
            />
            <i>%</i>
          </span>
        </label>
        <label>
          Månedlig sparing
          <span>
            <input
              inputMode="numeric"
              value={monthlySaving}
              onChange={(event) => setMonthlySaving(event.target.value)}
              aria-label="Månedlig sparing"
            />
            <i>kr</i>
          </span>
        </label>
      </div>
      <p className="forecast-note">
        <CircleHelp size={14} /> Estimatet er nominelt og tar ikke hensyn til
        skatt, kostnader eller inflasjon.
      </p>
    </section>
  );
}

function BreakdownPanel({
  totals,
  allTotals,
  active,
  onChange,
}: {
  totals: Record<AccountGroup, ReturnType<typeof calculateTotals>>;
  allTotals: ReturnType<typeof calculateTotals>;
  active: AccountFilter;
  onChange: (value: AccountFilter) => void;
}) {
  const segments = accountOrder.map((group) => ({
    group,
    percent: allTotals.value
      ? (totals[group].value / allTotals.value) * 100
      : 0,
  }));
  const gradient = segments
    .map(({ group, percent }, index) => {
      const from = segments
        .slice(0, index)
        .reduce((sum, segment) => sum + segment.percent, 0);
      return `${accountConfig[group].color} ${from}% ${from + percent}%`;
    })
    .join(", ");
  return (
    <section className="breakdown-card" id="fordeling">
      <div className="card-title-row">
        <h2>Fordeling</h2>
        <span className="card-context">Av total verdi</span>
      </div>
      <div className="donut-wrap">
        <div
          className="donut"
          style={{
            background: `conic-gradient(${gradient || "var(--line) 0 100%"})`,
          }}
        >
          <span>
            <b>{allTotals.positions}</b>
            <small>investeringer</small>
          </span>
        </div>
      </div>
      <div className="breakdown-list">
        {accountOrder.map((group) => (
          <button
            key={group}
            className={active === group ? "active" : ""}
            onClick={() => onChange(group)}
          >
            <i style={{ background: accountConfig[group].color }} />
            <span>{accountConfig[group].label}</span>
            <b>
              {allTotals.value
                ? `${Math.round((totals[group].value / allTotals.value) * 100)}%`
                : "0%"}
            </b>
            <small>{money.format(totals[group].value)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function HoldingRow({
  item,
  advanced,
  onEdit,
  onAccountChange,
}: {
  item: Holding;
  advanced: boolean;
  onEdit: () => void;
  onAccountChange: (group: AccountGroup) => void;
}) {
  const Icon = kindIcon[item.kind];
  const value = holdingValue(item);
  const account = getAccount(item);
  const today = dailyValue(item);
  const hasDaily = hasCalendarDayChange(item);
  const dailyPercent = holdingDailyPercent(item);
  const quote = getQuoteState(item);
  const rolling24h =
    item.changePeriod === "24h" &&
    item.dailyPercent !== null &&
    item.dailyPercent !== undefined;
  return (
    <article className={`holding-row ${advanced ? "is-editable" : ""}`}>
      <div className="asset-main">
        <div className={`asset-icon ${item.kind}`}>
          <Icon size={17} />
        </div>
        <div>
          <h3>{item.name}</h3>
          <p>
            {item.platform} · {item.symbol} ·{" "}
            <span className={`quote-status ${quote.tone}`} title={quote.detail}>
              {quote.label}
            </span>
          </p>
        </div>
      </div>
      <div
        className="account-cell"
        style={
          { "--account-color": accountConfig[account].color } as CSSProperties
        }
      >
        <i />
        {advanced ? (
          <>
            <select
              aria-label={`Konto for ${item.name}`}
              value={account}
              onChange={(event) =>
                onAccountChange(event.target.value as AccountGroup)
              }
            >
              {accountOrder.map((group) => (
                <option value={group} key={group}>
                  {accountConfig[group].label}
                </option>
              ))}
            </select>
            <ChevronDown size={11} />
          </>
        ) : (
          <span>{accountConfig[account].label}</span>
        )}
      </div>
      <div className="asset-value">
        <b>{money.format(value)}</b>
        <small>{number.format(item.units)} andeler</small>
      </div>
      <div
        className={`asset-change ${hasDaily ? (today >= 0 ? "positive" : "negative") : quote.tone === "warning" ? "warning" : "waiting"}`}
      >
        {hasDaily ? (
          today >= 0 ? (
            <ArrowUpRight size={15} />
          ) : (
            <ArrowDownRight size={15} />
          )
        ) : (
          <CircleHelp size={14} />
        )}
        <div>
          <b>
            {hasDaily && dailyPercent !== null
              ? signedPercent(dailyPercent)
              : rolling24h
                ? "Ikke kalenderdag"
                : quote.label}
          </b>
          <small>
            {hasDaily
              ? signedMoney(today)
              : rolling24h
                ? `24 t: ${signedPercent(item.dailyPercent ?? 0)}`
                : quote.detail}
          </small>
        </div>
      </div>
      {advanced ? (
        <button
          className="edit-holding"
          onClick={onEdit}
          aria-label={`Rediger ${item.name}`}
        >
          <Pencil size={14} />
        </button>
      ) : (
        <span className="locked-cell" aria-label="Visningsmodus">
          <LockKeyhole size={12} />
        </span>
      )}
    </article>
  );
}

function AddPanel({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (item: Holding) => void;
}) {
  const [kind, setKind] = useState<AssetKind>("fund");
  const [mode, setMode] = useState<PriceMode>("automatic");
  const [accountGroup, setAccountGroup] = useState<AccountGroup>("private");
  const [entryMethod, setEntryMethod] = useState<"value" | "units">("value");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Instrument | null>(null);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [quoteSymbol, setQuoteSymbol] = useState("");
  const [platform, setPlatform] = useState("Nordnet");
  const [portfolioValue, setPortfolioValue] = useState("");
  const [units, setUnits] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [daily, setDaily] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quoteSource, setQuoteSource] = useState("Manuelt registrert");
  const [quoteAsOf, setQuoteAsOf] = useState("");
  const [previousPrice, setPreviousPrice] = useState<number | undefined>();
  const [priceDate, setPriceDate] = useState<string | undefined>();
  const [changePeriod, setChangePeriod] = useState<"day" | "24h" | undefined>();
  const matches = useMemo(
    () => searchInstruments(kind, search),
    [kind, search],
  );
  const calculatedUnits =
    toNumber(price) > 0 && toNumber(portfolioValue) > 0
      ? toNumber(portfolioValue) / toNumber(price)
      : 0;
  const calculatedValue =
    toNumber(price) > 0 && toNumber(units) > 0
      ? toNumber(units) * toNumber(price)
      : 0;

  async function fetchQuote(targetSymbol = quoteSymbol || symbol) {
    if (!targetSymbol)
      return setError("Velg et instrument eller skriv inn et symbol.");
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/quote?kind=${kind}&symbol=${encodeURIComponent(targetSymbol)}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPrice(String(data.price));
      setDaily(
        data.changePercent === null || data.changePercent === undefined
          ? ""
          : String(data.changePercent),
      );
      setPreviousPrice(
        data.previousPrice ? Number(data.previousPrice) : undefined,
      );
      setPriceDate(data.priceDate);
      setChangePeriod(data.changePeriod);
      setQuoteSource(data.source);
      setQuoteAsOf(data.asOf ?? "");
      if (data.name && !name) setName(data.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke hente kurs.");
    } finally {
      setLoading(false);
    }
  }
  function selectInstrument(item: Instrument) {
    setSelected(item);
    setSearch("");
    setName(item.name);
    setSymbol(item.symbol);
    setQuoteSymbol(item.quoteSymbol ?? item.symbol);
    setError("");
  }
  function changeKind(value: AssetKind) {
    setKind(value);
    setSelected(null);
    setSearch("");
    setName("");
    setSymbol("");
    setQuoteSymbol("");
    setPrice("");
    setDaily("");
    setPreviousPrice(undefined);
    setPriceDate(undefined);
    setChangePeriod(undefined);
    setError("");
    if (value === "crypto" && platform === "Nordnet") setPlatform("Firi");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const finalUnits =
      entryMethod === "value" ? calculatedUnits : toNumber(units);
    const currentValue = finalUnits * toNumber(price);
    if (!name || !symbol || !price || !finalUnits)
      return setError(
        "Velg investering og fyll inn verdi eller antall samt gjeldende kurs.",
      );
    onAdd({
      id: crypto.randomUUID(),
      name,
      symbol: symbol.toUpperCase(),
      kind,
      platform,
      mode,
      units: finalUnits,
      cost: toNumber(cost) || currentValue,
      price: toNumber(price),
      previousPrice,
      dailyPercent: daily.trim() ? toNumber(daily) : null,
      changePeriod,
      currency: "NOK",
      source: mode === "manual" ? "Manuelt registrert" : quoteSource,
      updatedAt: new Date().toISOString(),
      priceDate,
      quoteStatus: mode === "manual" ? "manual_override" : undefined,
      priceAsOf: quoteAsOf || undefined,
      accountGroup,
    });
  }

  return (
    <div
      className="panel-layer"
      role="dialog"
      aria-modal="true"
      aria-label="Legg til investering"
    >
      <button className="panel-scrim" onClick={onClose} aria-label="Lukk" />
      <aside className="panel">
        <div className="panel-head">
          <div>
            <span>Ny investering</span>
            <h2>Legg til i oversikten</h2>
          </div>
          <button className="close" onClick={onClose} aria-label="Lukk panelet">
            <X />
          </button>
        </div>
        <form onSubmit={submit}>
          <fieldset className="segmented">
            <legend>Type</legend>
            {(["fund", "stock", "crypto"] as AssetKind[]).map((value) => (
              <button
                type="button"
                key={value}
                className={kind === value ? "selected" : ""}
                onClick={() => changeKind(value)}
              >
                {kindLabel[value]}
              </button>
            ))}
          </fieldset>
          <div className="instrument-picker">
            <label>
              {selected
                ? "Valgt investering"
                : `Søk etter ${kindLabel[kind].toLocaleLowerCase("nb-NO")}`}
            </label>
            {selected ? (
              <div className="selected-instrument">
                <div className={`asset-icon ${kind}`}>
                  {kind === "fund" ? (
                    <Landmark size={17} />
                  ) : kind === "stock" ? (
                    <WalletCards size={17} />
                  ) : (
                    <Coins size={17} />
                  )}
                </div>
                <span>
                  <b>{selected.name}</b>
                  <small>
                    {selected.market} · {selected.symbol}
                  </small>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setName("");
                    setSymbol("");
                    setQuoteSymbol("");
                    setPrice("");
                    setPreviousPrice(undefined);
                    setPriceDate(undefined);
                  }}
                >
                  Bytt
                </button>
              </div>
            ) : (
              <>
                <div className="search-field">
                  <Search size={16} />
                  <input
                    aria-label="Søk etter investering"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    autoFocus
                    placeholder={
                      kind === "fund"
                        ? "Søk DNB, KLP, fondnavn eller ISIN…"
                        : kind === "stock"
                          ? "Søk Equinor, Apple, ticker…"
                          : "Søk Bitcoin, Ethereum…"
                    }
                  />
                </div>
                <div className="instrument-results">
                  {matches.map((item) => (
                    <button
                      type="button"
                      key={`${item.kind}-${item.symbol}`}
                      onClick={() => selectInstrument(item)}
                    >
                      <span>
                        <b>{item.name}</b>
                        <small>{item.market}</small>
                      </span>
                      <em>{item.symbol}</em>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <fieldset className="mode-choice">
            <legend>Kurshenting</legend>
            <label className={mode === "automatic" ? "chosen" : ""}>
              <input
                type="radio"
                checked={mode === "automatic"}
                onChange={() => setMode("automatic")}
              />
              <span>
                <b>Automatisk</b>
                <small>Hent fra datakilde</small>
              </span>
            </label>
            <label className={mode === "manual" ? "chosen" : ""}>
              <input
                type="radio"
                checked={mode === "manual"}
                onChange={() => setMode("manual")}
              />
              <span>
                <b>Manuell</b>
                <small>Du styrer kursen</small>
              </span>
            </label>
          </fieldset>
          {!selected ? (
            <div className="two-fields">
              <label>
                Eget navn
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                Symbol / ISIN
                <input
                  value={symbol}
                  onChange={(e) => {
                    setSymbol(e.target.value);
                    setQuoteSymbol(e.target.value);
                  }}
                />
              </label>
            </div>
          ) : null}
          <div className="two-fields">
            <label>
              Plattform
              <div className="select-wrap">
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  <option>Nordnet</option>
                  <option>Kron</option>
                  <option>Firi</option>
                  <option>DNB</option>
                  <option>Storebrand</option>
                  <option>KLP</option>
                  <option>Annet</option>
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
            <label>
              Konto
              <div className="select-wrap">
                <select
                  value={accountGroup}
                  onChange={(e) =>
                    setAccountGroup(e.target.value as AccountGroup)
                  }
                >
                  {accountOrder.map((group) => (
                    <option value={group} key={group}>
                      {accountConfig[group].label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
          </div>
          <fieldset className="entry-choice">
            <legend>Hva vil du skrive inn?</legend>
            <button
              type="button"
              className={entryMethod === "value" ? "selected" : ""}
              onClick={() => setEntryMethod("value")}
            >
              Sum
            </button>
            <button
              type="button"
              className={entryMethod === "units" ? "selected" : ""}
              onClick={() => setEntryMethod("units")}
            >
              Antall andeler
            </button>
          </fieldset>
          {entryMethod === "value" ? (
            <label>
              Sum i dag
              <input
                inputMode="decimal"
                value={portfolioValue}
                onChange={(e) => setPortfolioValue(e.target.value)}
                placeholder="For eksempel 50 000 kr"
              />
            </label>
          ) : (
            <label>
              Antall andeler
              <input
                inputMode="decimal"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder="For eksempel 12,5"
              />
            </label>
          )}
          {mode === "automatic" && selected ? (
            <button
              type="button"
              className="fetch"
              onClick={() => fetchQuote()}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
              {loading
                ? "Henter kurs…"
                : price
                  ? "Oppdater kurs"
                  : "Hent kurs og beregn"}
            </button>
          ) : null}
          {error ? (
            <p className="form-error">
              <CircleHelp size={15} />
              {error}
            </p>
          ) : null}
          <div className="two-fields">
            <label>
              Nåværende kurs
              <input
                inputMode="decimal"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  if (mode === "manual") {
                    setQuoteSource("Manuelt registrert");
                    setPreviousPrice(undefined);
                  }
                }}
                placeholder="Hentes eller skrives inn"
              />
            </label>
            <label>
              Dagens endring <small>valgfritt</small>
              <input
                inputMode="decimal"
                value={daily}
                onChange={(e) => setDaily(e.target.value)}
                placeholder="Bare hvis kjent"
              />
            </label>
          </div>
          {entryMethod === "value" && calculatedUnits > 0 ? (
            <div className="calculation">
              <span>Beregnet beholdning</span>
              <b>{number.format(calculatedUnits)} andeler</b>
              <small>
                {money.format(toNumber(portfolioValue))} ÷{" "}
                {money.format(toNumber(price))}
              </small>
            </div>
          ) : null}
          {entryMethod === "units" && calculatedValue > 0 ? (
            <div className="calculation">
              <span>Beregnet verdi i dag</span>
              <b>{money.format(calculatedValue)}</b>
              <small>
                {number.format(toNumber(units))} andeler ×{" "}
                {money.format(toNumber(price))}
              </small>
            </div>
          ) : null}
          <label>
            Opprinnelig investert <small>valgfritt</small>
            <input
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder={portfolioValue || "Hvis tomt brukes dagens verdi"}
            />
          </label>
          {kind === "fund" ? (
            <p className="fund-warning">
              <CircleHelp size={15} />
              <span>
                <b>Fond beregnes normalt etter markedsslutt.</b> Vi viser
                forventet publisering, og merker først datakilden som forsinket
                når normalfristen er passert.
              </span>
            </p>
          ) : null}
          <button className="submit" type="submit">
            <Plus size={16} /> Legg til investering
          </button>
        </form>
      </aside>
    </div>
  );
}

function EditPanel({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: Holding;
  onClose: () => void;
  onSave: (item: Holding) => void;
  onDelete: (id: string) => void;
}) {
  const [entryMethod, setEntryMethod] = useState<"value" | "units">("value");
  const [portfolioValue, setPortfolioValue] = useState(
    String(Math.round(holdingValue(item) * 100) / 100),
  );
  const [units, setUnits] = useState(String(item.units));
  const [price, setPrice] = useState(String(item.price));
  const [cost, setCost] = useState(String(item.cost));
  const [daily, setDaily] = useState(
    item.dailyPercent === null || item.dailyPercent === undefined
      ? ""
      : String(item.dailyPercent),
  );
  const [platform, setPlatform] = useState(item.platform);
  const [accountGroup, setAccountGroup] = useState(getAccount(item));
  const [mode, setMode] = useState<PriceMode>(item.mode);
  const [quoteSource, setQuoteSource] = useState(item.source);
  const [quoteAsOf, setQuoteAsOf] = useState(item.priceAsOf ?? "");
  const [previousPrice, setPreviousPrice] = useState(item.previousPrice);
  const [priceDate, setPriceDate] = useState(item.priceDate);
  const [changePeriod, setChangePeriod] = useState(item.changePeriod);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const calculatedUnits =
    toNumber(price) > 0 ? toNumber(portfolioValue) / toNumber(price) : 0;
  const calculatedValue = toNumber(price) * toNumber(units);

  async function fetchQuote() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/quote?kind=${item.kind}&symbol=${encodeURIComponent(item.symbol)}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPrice(String(data.price));
      setDaily(
        data.changePercent === null || data.changePercent === undefined
          ? ""
          : String(data.changePercent),
      );
      setPreviousPrice(
        data.previousPrice ? Number(data.previousPrice) : undefined,
      );
      setPriceDate(data.priceDate);
      setChangePeriod(data.changePeriod);
      setQuoteSource(data.source ?? item.source);
      setQuoteAsOf(data.asOf ?? "");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Kunne ikke hente kurs.",
      );
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextPrice = toNumber(price);
    const nextUnits =
      entryMethod === "value" ? calculatedUnits : toNumber(units);
    if (!nextPrice || !nextUnits)
      return setError(
        "Fyll inn gjeldende verdi eller antall andeler og en gyldig kurs.",
      );
    onSave({
      ...item,
      platform,
      accountGroup,
      mode,
      units: nextUnits,
      price: nextPrice,
      previousPrice,
      cost: toNumber(cost) || nextUnits * nextPrice,
      dailyPercent: daily.trim() ? toNumber(daily) : null,
      changePeriod,
      source: mode === "manual" ? "Manuelt registrert" : quoteSource,
      priceDate,
      quoteStatus: mode === "manual" ? "manual_override" : undefined,
      priceAsOf: quoteAsOf || undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <div
      className="panel-layer"
      role="dialog"
      aria-modal="true"
      aria-label={`Rediger ${item.name}`}
    >
      <button className="panel-scrim" onClick={onClose} aria-label="Lukk" />
      <aside className="panel edit-panel">
        <div className="panel-head">
          <div>
            <span>Avansert modus</span>
            <h2>Rediger beholdning</h2>
          </div>
          <button className="close" onClick={onClose} aria-label="Lukk panelet">
            <X />
          </button>
        </div>
        <div className="edit-instrument">
          <div className={`asset-icon ${item.kind}`}>
            {item.kind === "fund" ? (
              <Landmark size={17} />
            ) : item.kind === "stock" ? (
              <WalletCards size={17} />
            ) : (
              <Coins size={17} />
            )}
          </div>
          <span>
            <b>{item.name}</b>
            <small>
              {item.symbol} · {kindLabel[item.kind]}
            </small>
          </span>
        </div>
        <form onSubmit={submit}>
          <fieldset className="mode-choice">
            <legend>Kurshenting</legend>
            <label className={mode === "automatic" ? "chosen" : ""}>
              <input
                type="radio"
                checked={mode === "automatic"}
                onChange={() => setMode("automatic")}
              />
              <span>
                <b>Automatisk</b>
                <small>Oppdater fra datakilden</small>
              </span>
            </label>
            <label className={mode === "manual" ? "chosen" : ""}>
              <input
                type="radio"
                checked={mode === "manual"}
                onChange={() => setMode("manual")}
              />
              <span>
                <b>Manuell</b>
                <small>Behold egne verdier</small>
              </span>
            </label>
          </fieldset>
          <div className="two-fields">
            <label>
              Plattform
              <div className="select-wrap">
                <select
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value)}
                >
                  <option>Nordnet</option>
                  <option>Kron</option>
                  <option>Firi</option>
                  <option>DNB</option>
                  <option>Storebrand</option>
                  <option>KLP</option>
                  <option>Annet</option>
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
            <label>
              Konto
              <div className="select-wrap">
                <select
                  value={accountGroup}
                  onChange={(event) =>
                    setAccountGroup(event.target.value as AccountGroup)
                  }
                >
                  {accountOrder.map((group) => (
                    <option value={group} key={group}>
                      {accountConfig[group].label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
          </div>
          <fieldset className="entry-choice">
            <legend>Endre gjeldende beholdning som</legend>
            <button
              type="button"
              className={entryMethod === "value" ? "selected" : ""}
              onClick={() => setEntryMethod("value")}
            >
              Sum
            </button>
            <button
              type="button"
              className={entryMethod === "units" ? "selected" : ""}
              onClick={() => setEntryMethod("units")}
            >
              Antall andeler
            </button>
          </fieldset>
          {entryMethod === "value" ? (
            <label>
              Gjeldende verdi
              <input
                inputMode="decimal"
                value={portfolioValue}
                onChange={(event) => setPortfolioValue(event.target.value)}
              />
            </label>
          ) : (
            <label>
              Antall andeler
              <input
                inputMode="decimal"
                value={units}
                onChange={(event) => setUnits(event.target.value)}
              />
            </label>
          )}
          {mode === "automatic" ? (
            <button
              type="button"
              className="fetch"
              onClick={fetchQuote}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
              {loading ? "Henter kurs…" : "Hent ny kurs"}
            </button>
          ) : null}
          {error ? (
            <p className="form-error">
              <CircleHelp size={15} />
              {error}
            </p>
          ) : null}
          <div className="two-fields">
            <label>
              Gjeldende kurs
              <input
                inputMode="decimal"
                value={price}
                onChange={(event) => {
                  setPrice(event.target.value);
                  if (mode === "manual") {
                    setQuoteSource("Manuelt registrert");
                    setPreviousPrice(undefined);
                    setChangePeriod(undefined);
                    setPriceDate(undefined);
                    setQuoteAsOf("");
                  }
                }}
              />
            </label>
            <label>
              Dagens endring <small>valgfritt</small>
              <input
                inputMode="decimal"
                value={daily}
                onChange={(event) => setDaily(event.target.value)}
                placeholder="Bare hvis kjent"
              />
            </label>
          </div>
          {entryMethod === "value" && calculatedUnits > 0 ? (
            <div className="calculation">
              <span>Ny beholdning</span>
              <b>{number.format(calculatedUnits)} andeler</b>
              <small>
                {money.format(toNumber(portfolioValue))} ÷{" "}
                {money.format(toNumber(price))}
              </small>
            </div>
          ) : null}
          {entryMethod === "units" && calculatedValue > 0 ? (
            <div className="calculation">
              <span>Ny verdi i dag</span>
              <b>{money.format(calculatedValue)}</b>
              <small>
                {number.format(toNumber(units))} andeler ×{" "}
                {money.format(toNumber(price))}
              </small>
            </div>
          ) : null}
          <label>
            Inngangsverdi / totalt investert
            <input
              inputMode="decimal"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
            />
            <small>Brukes til å beregne total avkastning.</small>
          </label>
          <button className="submit" type="submit">
            Lagre endringer
          </button>
          <div className="danger-zone">
            <div>
              <b>Fjern investering</b>
              <span>Dette påvirker bare oversikten på denne enheten.</span>
            </div>
            <button
              type="button"
              className={confirmDelete ? "confirm" : ""}
              onClick={() =>
                confirmDelete ? onDelete(item.id) : setConfirmDelete(true)
              }
            >
              <Trash2 size={14} />
              {confirmDelete ? "Bekreft sletting" : "Fjern"}
            </button>
            {confirmDelete ? (
              <button
                type="button"
                className="cancel-delete"
                onClick={() => setConfirmDelete(false)}
              >
                Avbryt
              </button>
            ) : null}
          </div>
        </form>
      </aside>
    </div>
  );
}

function getAccount(item: Holding): AccountGroup {
  return item.accountGroup ?? "private";
}
async function refreshOfficialFunds(items: Holding[]) {
  const supported = new Set(["NO0010337678", "LU2075955943"]);
  const refreshed = await Promise.all(
    items.map(async (item) => {
      if (
        item.kind !== "fund" ||
        item.mode !== "automatic" ||
        !supported.has(item.symbol)
      )
        return item;
      try {
        const response = await fetch(
          `/api/quote?kind=fund&symbol=${encodeURIComponent(item.symbol)}`,
        );
        if (!response.ok)
          return { ...item, quoteStatus: "source_error" as const };
        const data = await response.json();
        return {
          ...item,
          name: data.name ?? item.name,
          price: Number(data.price) || item.price,
          previousPrice: data.previousPrice
            ? Number(data.previousPrice)
            : undefined,
          dailyPercent: data.changePercent ?? null,
          changePeriod: data.changePeriod,
          source: data.source ?? item.source,
          priceAsOf: data.asOf ?? item.priceAsOf,
          priceDate: data.priceDate ?? item.priceDate,
          updatedAt: data.updatedAt ?? new Date().toISOString(),
          quoteStatus: undefined,
        };
      } catch {
        return { ...item, quoteStatus: "source_error" as const };
      }
    }),
  );
  return refreshed;
}
function signedMoney(value: number) {
  return `${value >= 0 ? "+" : "−"}${money.format(Math.abs(value))}`;
}
function signedPercent(value: number) {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toLocaleString("nb-NO", { maximumFractionDigits: 2 })} %`;
}
function formatRate(value: number) {
  return `${value.toLocaleString("nb-NO", { maximumFractionDigits: 1 })} %`;
}
function projectValue(
  currentValue: number,
  monthlySaving: number,
  annualReturn: number,
  years: number,
) {
  const months = years * 12;
  const monthlyRate =
    Math.pow(1 + Math.max(-0.99, annualReturn / 100), 1 / 12) - 1;
  const growth = Math.pow(1 + monthlyRate, months);
  const contributions =
    Math.abs(monthlyRate) < 0.000001
      ? monthlySaving * months
      : (monthlySaving * (growth - 1)) / monthlyRate;
  return Math.max(0, currentValue * growth + contributions);
}
function toNumber(value: string) {
  const compact = value.replace(/\s/g, "");
  const withoutThousands = /^\d{1,3}(\.\d{3})+$/.test(compact)
    ? compact.replace(/\./g, "")
    : compact;
  return Number(withoutThousands.replace(",", ".")) || 0;
}
