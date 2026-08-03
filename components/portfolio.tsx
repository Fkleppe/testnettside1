"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, Baby, Bell, BriefcaseBusiness, ChevronDown,
  CircleHelp, Coins, Landmark, LayoutDashboard, ListFilter, Menu, MoreHorizontal,
  Plus, RefreshCw, Search, ShieldCheck, SlidersHorizontal, UserRound, WalletCards, X,
} from "lucide-react";
import { searchInstruments, type Instrument } from "@/lib/catalog";
import { demoHoldings } from "@/lib/demo";
import type { AccountGroup, AssetKind, Holding, PriceMode } from "@/lib/types";

const STORAGE_KEY = "min-sparing-holdings-v1";
const money = new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 4 });

const kindLabel: Record<AssetKind, string> = { fund: "Fond", stock: "Aksje", crypto: "Krypto" };
const kindIcon = { fund: Landmark, stock: WalletCards, crypto: Coins };
const accountOrder: AccountGroup[] = ["private", "business", "family", "pension"];
const accountConfig: Record<AccountGroup, { label: string; short: string; color: string; icon: typeof UserRound }> = {
  private: { label: "Privat", short: "PR", color: "var(--account-private)", icon: UserRound },
  business: { label: "Bedrift", short: "AS", color: "var(--account-business)", icon: BriefcaseBusiness },
  family: { label: "Barn & familie", short: "BF", color: "var(--account-family)", icon: Baby },
  pension: { label: "Pensjon", short: "PS", color: "var(--account-pension)", icon: ShieldCheck },
};

type AccountFilter = "all" | AccountGroup;
type SortMode = "value" | "today" | "name";

export function Portfolio() {
  const [holdings, setHoldings] = useState<Holding[]>(demoHoldings);
  const [ready, setReady] = useState(false);
  const [adding, setAdding] = useState(false);
  const [activeAccount, setActiveAccount] = useState<AccountFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("value");

  useEffect(() => {
    queueMicrotask(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Holding[];
          setHoldings(parsed.map((item) => item.delayed && item.dailyPercent === 0
            ? { ...item, dailyPercent: null }
            : item));
        } catch {}
      }
      setReady(true);
    });
  }, []);

  useEffect(() => { if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings)); }, [holdings, ready]);

  const visibleHoldings = useMemo(() => holdings.filter((item) => activeAccount === "all" || getAccount(item) === activeAccount), [holdings, activeAccount]);
  const sortedHoldings = useMemo(() => [...visibleHoldings].sort((a, b) => {
    if (sortMode === "name") return a.name.localeCompare(b.name, "nb");
    if (sortMode === "today") return dailyValue(b) - dailyValue(a);
    return holdingValue(b) - holdingValue(a);
  }), [visibleHoldings, sortMode]);
  const totals = useMemo(() => calculateTotals(visibleHoldings), [visibleHoldings]);
  const allTotals = useMemo(() => calculateTotals(holdings), [holdings]);
  const accountTotals = useMemo(() => Object.fromEntries(accountOrder.map((group) => [group, calculateTotals(holdings.filter((item) => getAccount(item) === group))])) as Record<AccountGroup, ReturnType<typeof calculateTotals>>, [holdings]);

  const remove = (id: string) => setHoldings((current) => current.filter((item) => item.id !== id));
  const moveAccount = (id: string, accountGroup: AccountGroup) => setHoldings((current) => current.map((item) => item.id === id ? { ...item, accountGroup } : item));
  const delayedCount = visibleHoldings.filter((item) => item.delayed).length;
  const freshCount = visibleHoldings.filter((item) => item.dailyPercent !== null && item.dailyPercent !== undefined).length;

  return (
    <main className="app-shell">
      <div className="data-strip"><div><span className="pulse" /> Kursstatus</div><span>{freshCount} med dagens utvikling</span><span>{delayedCount} forsinket NAV</span><span>Alle beløp i NOK</span><small>Data lagres lokalt</small></div>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Min Sparing, forsiden"><span className="brand-mark">M</span><span>Min Sparing</span></a>
        <nav aria-label="Hovedmeny"><a href="#top" className="active">Min økonomi</a><a href="#beholdning">Beholdning</a><a href="#datakilder">Datakilder</a></nav>
        <div className="header-actions"><button aria-label="Varsler"><Bell size={17} /></button><button className="header-add" onClick={() => setAdding(true)}><Plus size={17} /> Legg til</button><button className="mobile-menu" aria-label="Meny"><Menu size={19} /></button></div>
      </header>

      <div className="workspace" id="top">
        <div className="page-heading"><div><p className="kicker">Portefølje</p><h1>Min økonomi</h1></div><button className="primary-action" onClick={() => setAdding(true)}><Plus size={18} /> Legg til investering</button></div>
        <div className="page-tabs"><button className="selected"><LayoutDashboard size={15} /> Oversikt</button><a href="#beholdning">Beholdning</a><a href="#datakilder">Datakvalitet</a></div>

        <section className="dashboard-grid">
          <AccountRail active={activeAccount} onChange={setActiveAccount} allTotals={allTotals} totals={accountTotals} />
          <OverviewPanel holdings={visibleHoldings} totals={totals} activeAccount={activeAccount} />
          <StatusPanel holdings={visibleHoldings} />
        </section>

        <section className="holdings-panel" id="beholdning">
          <div className="holdings-head"><div><p className="kicker">Investeringer</p><h2>{activeAccount === "all" ? "Samlet beholdning" : accountConfig[activeAccount].label}</h2><span>{visibleHoldings.length} posisjoner · {money.format(totals.value)}</span></div><div className="table-actions"><div className="filter-summary"><span className="account-dot" style={{ background: activeAccount === "all" ? "var(--accent)" : accountConfig[activeAccount].color }} />{activeAccount === "all" ? "Alle kontoer" : accountConfig[activeAccount].label}</div><label><ListFilter size={15} /><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}><option value="value">Størst verdi</option><option value="today">Dagens bidrag</option><option value="name">Navn A–Å</option></select><ChevronDown size={14} /></label></div></div>
          <div className="table-labels"><span>Investering</span><span>Konto</span><span>Datakilde</span><span>Verdi</span><span>I dag</span><span /></div>
          <div className="holdings-list">
            {sortedHoldings.map((item) => <HoldingRow key={item.id} item={item} onRemove={() => remove(item.id)} onAccountChange={(group) => moveAccount(item.id, group)} />)}
            {!sortedHoldings.length && <div className="empty"><p>Ingen investeringer her ennå.</p><span>Legg til en investering eller velg en annen konto.</span><button className="primary-action" onClick={() => setAdding(true)}><Plus size={18} /> Legg til</button></div>}
          </div>
        </section>

        <section className="data-note" id="datakilder"><div><p className="kicker">Datakvalitet</p><h2>Ærlige tall, også når markedet er tregt.</h2></div><div className="note-grid"><p><b>Oppdatert i dag</b>Aksjer og krypto får dagsendring når markedskursen er tilgjengelig.</p><p><b>Forsinket NAV</b>Fond som DNB Teknologi og beholdninger hos Kron kan ligge én eller flere dager bak.</p><p><b>Ikke falsk null</b>Mangler dagens NAV, viser vi «Venter på NAV» — aldri en misvisende 0 %.</p></div></section>
      </div>

      <footer><span>Min Sparing</span><p>Samlet oversikt · ikke investeringsråd</p><span>Bygget for norske småsparere</span></footer>
      {adding ? <AddPanel onClose={() => setAdding(false)} onAdd={(item) => { setHoldings((current) => [item, ...current]); setActiveAccount(item.accountGroup ?? "private"); setAdding(false); }} /> : null}
    </main>
  );
}

function AccountRail({ active, onChange, allTotals, totals }: { active: AccountFilter; onChange: (value: AccountFilter) => void; allTotals: ReturnType<typeof calculateTotals>; totals: Record<AccountGroup, ReturnType<typeof calculateTotals>> }) {
  return <aside className="accounts-card"><div className="card-heading"><div><p className="kicker">Kontoer</p><h2>Fordeling</h2></div><SlidersHorizontal size={17} /></div><button className={`account-row all ${active === "all" ? "selected" : ""}`} onClick={() => onChange("all")}><span className="account-avatar">MS</span><span><b>Alle kontoer</b><small>{allTotals.positions} investeringer</small></span><em><b>{money.format(allTotals.value)}</b><small className={allTotals.today >= 0 ? "positive" : "negative"}>{allTotals.updated ? signedPercent(allTotals.todayPercent) : "Venter"}</small></em></button><div className="account-separator">Kategorier</div>{accountOrder.map((group) => { const config = accountConfig[group]; const values = totals[group]; const Icon = config.icon; return <button key={group} className={`account-row ${active === group ? "selected" : ""}`} style={{ "--account-color": config.color } as React.CSSProperties} onClick={() => onChange(group)}><span className="account-avatar"><Icon size={15} /></span><span><b>{config.label}</b><small>{values.positions} investeringer</small></span><em><b>{money.format(values.value)}</b><small className={values.today >= 0 ? "positive" : "negative"}>{values.updated ? signedPercent(values.todayPercent) : "—"}</small></em></button>; })}</aside>;
}

function OverviewPanel({ holdings, totals, activeAccount }: { holdings: Holding[]; totals: ReturnType<typeof calculateTotals>; activeAccount: AccountFilter }) {
  const contributions = holdings.filter((item) => item.dailyPercent !== null && item.dailyPercent !== undefined).sort((a, b) => Math.abs(dailyValue(b)) - Math.abs(dailyValue(a))).slice(0, 5);
  const maxContribution = Math.max(...contributions.map((item) => Math.abs(dailyValue(item))), 1);
  return <section className="overview-card"><div className="overview-top"><div><p>{activeAccount === "all" ? "Samlet egenkapital" : `${accountConfig[activeAccount].label} · egenkapital`}</p><h2>{money.format(totals.value)}</h2><span>{totals.positions} investeringer</span></div><button aria-label="Flere valg"><MoreHorizontal size={18} /></button></div><div className={`today-block ${totals.today >= 0 ? "up" : "down"}`}><div><span>Dagens utvikling</span><strong>{totals.updated ? signedMoney(totals.today) : "Venter på kurs"}</strong></div><div><b>{totals.updated ? signedPercent(totals.todayPercent) : "—"}</b><small>{totals.updated} av {totals.positions} oppdatert</small></div></div><div className="contribution"><div className="subheading"><span>Bidrag i dag</span><small>basert på tilgjengelige kurser</small></div>{contributions.length ? contributions.map((item) => { const amount = dailyValue(item); return <div className="contribution-row" key={item.id}><span>{item.name}</span><div className="bar-track"><i className={amount >= 0 ? "gain" : "loss"} style={{ width: `${Math.max(5, Math.abs(amount) / maxContribution * 100)}%` }} /></div><b className={amount >= 0 ? "positive" : "negative"}>{signedMoney(amount)}</b></div>; }) : <div className="no-day-data">Ingen dagskurser tilgjengelig for dette utvalget ennå.</div>}</div><div className="overview-stats"><div><span>Totalt investert</span><b>{money.format(totals.cost)}</b></div><div><span>Total avkastning</span><b className={totals.total >= 0 ? "positive" : "negative"}>{signedMoney(totals.total)}</b></div><div><span>Avkastning</span><b className={totals.totalPercent >= 0 ? "positive" : "negative"}>{signedPercent(totals.totalPercent)}</b></div></div></section>;
}

function StatusPanel({ holdings }: { holdings: Holding[] }) {
  const delayed = holdings.filter((item) => item.delayed).length;
  const automatic = holdings.filter((item) => item.mode === "automatic").length;
  const waiting = holdings.filter((item) => item.dailyPercent === null || item.dailyPercent === undefined).length;
  return <aside className="status-card"><div className="card-heading"><div><p className="kicker">Status</p><h2>Datakilder</h2></div><RefreshCw size={17} /></div><div className="status-score"><strong>{holdings.length ? Math.round((holdings.length - waiting) / holdings.length * 100) : 0}%</strong><span>av beholdningen har dagens utvikling</span></div><div className="status-list"><div><span className="status-icon fresh"><RefreshCw size={14} /></span><span><b>Automatisk kurs</b><small>{automatic} investeringer</small></span></div><div><span className="status-icon delayed"><CircleHelp size={14} /></span><span><b>Forsinket NAV</b><small>{delayed} investeringer</small></span></div><div><span className="status-icon waiting"><Bell size={14} /></span><span><b>Venter på dagens tall</b><small>{waiting} investeringer</small></span></div></div>{holdings.some((item) => item.platform === "Kron") ? <p className="kron-note"><b>Kron kan ligge etter.</b> Vi bruker siste tilgjengelige offisielle NAV og merker datoen tydelig.</p> : null}</aside>;
}

function HoldingRow({ item, onRemove, onAccountChange }: { item: Holding; onRemove: () => void; onAccountChange: (group: AccountGroup) => void }) {
  const Icon = kindIcon[item.kind];
  const value = holdingValue(item);
  const profit = value - item.cost;
  const account = getAccount(item);
  const today = dailyValue(item);
  const hasDaily = item.dailyPercent !== null && item.dailyPercent !== undefined;
  return <article className="holding-row"><div className="asset-main"><div className={`asset-icon ${item.kind}`}><Icon size={18} /></div><div><h3>{item.name}</h3><p>{item.platform} · {item.symbol}</p></div></div><div className="account-cell" style={{ "--account-color": accountConfig[account].color } as React.CSSProperties}><span className="account-dot" /><select value={account} onChange={(event) => onAccountChange(event.target.value as AccountGroup)} aria-label={`Konto for ${item.name}`}>{accountOrder.map((group) => <option value={group} key={group}>{accountConfig[group].label}</option>)}</select><ChevronDown size={12} /></div><div className="source"><span className={item.delayed ? "status delayed" : "status"}>{item.delayed ? "Forsinket NAV" : item.source}</span><small>{formatTime(item.updatedAt)}</small></div><div className="asset-value"><b>{money.format(value)}</b><small>{number.format(item.units)} andeler</small></div><div className={`asset-change ${hasDaily ? (today >= 0 ? "positive" : "negative") : "waiting"}`}>{hasDaily ? (today >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />) : <CircleHelp size={15} />}<div><b>{hasDaily ? signedPercent(item.dailyPercent ?? 0) : "Venter på NAV"}</b><small>{hasDaily ? signedMoney(today) : `${signedMoney(profit)} totalt`}</small></div></div><button className="remove" onClick={onRemove} aria-label={`Fjern ${item.name}`}><X size={16} /></button></article>;
}

function AddPanel({ onClose, onAdd }: { onClose: () => void; onAdd: (item: Holding) => void }) {
  const [kind, setKind] = useState<AssetKind>("fund");
  const [mode, setMode] = useState<PriceMode>("automatic");
  const [accountGroup, setAccountGroup] = useState<AccountGroup>("private");
  const [entryMethod, setEntryMethod] = useState<"value" | "units">("value");
  const [search, setSearch] = useState(""); const [selected, setSelected] = useState<Instrument | null>(null);
  const [symbol, setSymbol] = useState(""); const [name, setName] = useState(""); const [quoteSymbol, setQuoteSymbol] = useState(""); const [platform, setPlatform] = useState("Nordnet");
  const [portfolioValue, setPortfolioValue] = useState(""); const [units, setUnits] = useState(""); const [cost, setCost] = useState(""); const [price, setPrice] = useState(""); const [daily, setDaily] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [quoteSource, setQuoteSource] = useState("Manuelt registrert");
  const matches = useMemo(() => searchInstruments(kind, search), [kind, search]);
  const calculatedUnits = toNumber(price) > 0 && toNumber(portfolioValue) > 0 ? toNumber(portfolioValue) / toNumber(price) : 0;
  const calculatedValue = toNumber(price) > 0 && toNumber(units) > 0 ? toNumber(units) * toNumber(price) : 0;

  async function fetchQuote(targetSymbol = quoteSymbol || symbol) {
    if (!targetSymbol) return setError("Velg et instrument eller skriv inn et symbol.");
    setLoading(true); setError("");
    try { const response = await fetch(`/api/quote?kind=${kind}&symbol=${encodeURIComponent(targetSymbol)}`); const data = await response.json(); if (!response.ok) throw new Error(data.error); setPrice(String(data.price)); setDaily(data.changePercent === null || data.changePercent === undefined ? "" : String(data.changePercent)); setQuoteSource(data.source); if (data.name && !name) setName(data.name); }
    catch (e) { setError(e instanceof Error ? e.message : "Kunne ikke hente kurs."); }
    finally { setLoading(false); }
  }

  function selectInstrument(item: Instrument) { setSelected(item); setSearch(""); setName(item.name); setSymbol(item.symbol); setQuoteSymbol(item.quoteSymbol ?? item.symbol); setError(""); }
  function changeKind(value: AssetKind) { setKind(value); setSelected(null); setSearch(""); setName(""); setSymbol(""); setQuoteSymbol(""); setPrice(""); setDaily(""); setError(""); if (value === "crypto" && platform === "Nordnet") setPlatform("Firi"); }
  function submit(event: React.FormEvent) { event.preventDefault(); const finalUnits = entryMethod === "value" ? calculatedUnits : toNumber(units); const currentValue = finalUnits * toNumber(price); if (!name || !symbol || !price || !finalUnits) return setError("Velg investering og fyll inn verdi eller antall samt gjeldende kurs."); onAdd({ id: crypto.randomUUID(), name, symbol: symbol.toUpperCase(), kind, platform, mode, units: finalUnits, cost: toNumber(cost) || currentValue, price: toNumber(price), dailyPercent: daily.trim() ? toNumber(daily) : null, currency: "NOK", source: quoteSource, updatedAt: new Date().toISOString(), delayed: kind === "fund", accountGroup }); }

  return <div className="panel-layer" role="dialog" aria-modal="true" aria-label="Legg til investering"><button className="panel-scrim" onClick={onClose} aria-label="Lukk" /><aside className="panel"><div className="panel-head"><div><p className="kicker">Ny investering</p><h2>Legg til i oversikten</h2></div><button className="close" onClick={onClose}><X /></button></div><form onSubmit={submit}><fieldset className="segmented"><legend>Type</legend>{(["fund", "stock", "crypto"] as AssetKind[]).map((value) => <button type="button" key={value} className={kind === value ? "selected" : ""} onClick={() => changeKind(value)}>{kindLabel[value]}</button>)}</fieldset><div className="instrument-picker"><label>{selected ? "Valgt investering" : `Søk etter ${kindLabel[kind].toLocaleLowerCase("nb-NO")}`}</label>{selected ? <div className="selected-instrument"><div className={`asset-icon ${kind}`}>{kind === "fund" ? <Landmark size={18} /> : kind === "stock" ? <WalletCards size={18} /> : <Coins size={18} />}</div><span><b>{selected.name}</b><small>{selected.market} · {selected.symbol}</small></span><button type="button" onClick={() => { setSelected(null); setName(""); setSymbol(""); setQuoteSymbol(""); setPrice(""); }}>Bytt</button></div> : <><div className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} autoFocus placeholder={kind === "fund" ? "Søk KLP, DNB, global, indeks…" : kind === "stock" ? "Søk Equinor, Apple, ticker…" : "Søk Bitcoin, Ethereum…"} /></div><div className="instrument-results" role="listbox">{matches.map((item) => <button type="button" key={`${item.kind}-${item.symbol}`} onClick={() => selectInstrument(item)}><span><b>{item.name}</b><small>{item.market}</small></span><em>{item.symbol}</em></button>)}</div></>}</div><fieldset className="mode-choice"><legend>Kurshenting</legend><label className={mode === "automatic" ? "chosen" : ""}><input type="radio" checked={mode === "automatic"} onChange={() => setMode("automatic")} /><span><b>Automatisk</b><small>Hent fra datakilde</small></span></label><label className={mode === "manual" ? "chosen" : ""}><input type="radio" checked={mode === "manual"} onChange={() => setMode("manual")} /><span><b>Manuell</b><small>Du styrer kursen</small></span></label></fieldset>{!selected ? <div className="two-fields"><label>Eget navn<input value={name} onChange={(e) => setName(e.target.value)} /></label><label>Symbol / ISIN<input value={symbol} onChange={(e) => { setSymbol(e.target.value); setQuoteSymbol(e.target.value); }} /></label></div> : null}<div className="two-fields"><label>Plattform<div className="select-wrap"><select value={platform} onChange={(e) => setPlatform(e.target.value)}><option>Nordnet</option><option>Kron</option><option>Firi</option><option>DNB</option><option>Storebrand</option><option>KLP</option><option>Annet</option></select><ChevronDown size={15} /></div></label><label>Konto<div className="select-wrap"><select value={accountGroup} onChange={(e) => setAccountGroup(e.target.value as AccountGroup)}>{accountOrder.map((group) => <option value={group} key={group}>{accountConfig[group].label}</option>)}</select><ChevronDown size={15} /></div></label></div><div className="account-preview" style={{ "--account-color": accountConfig[accountGroup].color } as React.CSSProperties}><span className="account-dot" />Denne investeringen legges under <b>{accountConfig[accountGroup].label}</b></div><fieldset className="entry-choice"><legend>Hva vil du skrive inn?</legend><button type="button" className={entryMethod === "value" ? "selected" : ""} onClick={() => setEntryMethod("value")}>Sum</button><button type="button" className={entryMethod === "units" ? "selected" : ""} onClick={() => setEntryMethod("units")}>Antall andeler</button></fieldset>{entryMethod === "value" ? <label>Sum i dag<input inputMode="decimal" value={portfolioValue} onChange={(e) => setPortfolioValue(e.target.value)} placeholder="For eksempel 50 000 kr" /></label> : <label>Antall andeler<input inputMode="decimal" value={units} onChange={(e) => setUnits(e.target.value)} placeholder="For eksempel 12,5" /></label>}{mode === "automatic" && selected ? <button type="button" className="fetch" onClick={() => fetchQuote()} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} />{loading ? "Henter kurs…" : price ? "Oppdater kurs og beregning" : "Hent kurs og beregn"}</button> : null}{error ? <p className="form-error"><CircleHelp size={16} />{error}</p> : null}<div className="two-fields"><label>Nåværende kurs<input inputMode="decimal" value={price} onChange={(e) => { setPrice(e.target.value); if (mode === "manual") setQuoteSource("Manuelt registrert"); }} placeholder="Hentes eller skrives inn" /></label><label>Dagens endring <small className="optional">kan være tom</small><input inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} placeholder="Venter på NAV" /></label></div>{entryMethod === "value" && calculatedUnits > 0 ? <div className="calculation"><span>Beregnet beholdning</span><b>{number.format(calculatedUnits)} andeler</b><small>{money.format(toNumber(portfolioValue))} ÷ {money.format(toNumber(price))}</small></div> : null}{entryMethod === "units" && calculatedValue > 0 ? <div className="calculation"><span>Beregnet verdi i dag</span><b>{money.format(calculatedValue)}</b><small>{number.format(toNumber(units))} andeler × {money.format(toNumber(price))}</small></div> : null}<label>Opprinnelig investert <small className="optional">valgfritt</small><input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder={portfolioValue || "Hvis tomt brukes dagens verdi"} /></label>{kind === "fund" ? <p className="fund-warning"><CircleHelp size={16} /><span><b>Fond har forsinket kurs.</b> Mangler dagens NAV, viser vi «Venter på NAV».</span></p> : null}<button className="submit" type="submit"><Plus size={17} /> Legg til investering</button></form></aside></div>;
}

function getAccount(item: Holding): AccountGroup { return item.accountGroup ?? "private"; }
function holdingValue(item: Holding) { return item.units * item.price; }
function dailyValue(item: Holding) { return item.dailyPercent === null || item.dailyPercent === undefined ? 0 : holdingValue(item) * item.dailyPercent / 100; }
function calculateTotals(items: Holding[]) { const value = items.reduce((sum, item) => sum + holdingValue(item), 0); const cost = items.reduce((sum, item) => sum + item.cost, 0); const today = items.reduce((sum, item) => sum + dailyValue(item), 0); const updated = items.filter((item) => item.dailyPercent !== null && item.dailyPercent !== undefined).length; return { value, cost, today, total: value - cost, totalPercent: cost ? (value - cost) / cost * 100 : 0, todayPercent: value - today ? today / (value - today) * 100 : 0, positions: items.length, updated }; }
function formatTime(value: string) { return new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function signedMoney(value: number) { return `${value >= 0 ? "+" : "−"}${money.format(Math.abs(value))}`; }
function signedPercent(value: number) { return `${value >= 0 ? "+" : "−"}${Math.abs(value).toLocaleString("nb-NO", { maximumFractionDigits: 2 })} %`; }
function toNumber(value: string) { const compact = value.replace(/\s/g, ""); const withoutThousands = /^\d{1,3}(\.\d{3})+$/.test(compact) ? compact.replace(/\./g, "") : compact; return Number(withoutThousands.replace(",", ".")) || 0; }
