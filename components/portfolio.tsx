"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown, CircleHelp, Coins, Landmark, Plus, RefreshCw, Search, ShieldCheck, Sparkles, WalletCards, X } from "lucide-react";
import { searchInstruments, type Instrument } from "@/lib/catalog";
import { demoHoldings } from "@/lib/demo";
import type { AssetKind, Holding, PriceMode } from "@/lib/types";

const STORAGE_KEY = "min-sparing-holdings-v1";
const money = new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 4 });

const kindLabel: Record<AssetKind, string> = { fund: "Fond", stock: "Aksje", crypto: "Krypto" };
const kindIcon = { fund: Landmark, stock: WalletCards, crypto: Coins };

export function Portfolio() {
  const [holdings, setHoldings] = useState<Holding[]>(demoHoldings);
  const [ready, setReady] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("Du ser demo-data. Endringer lagres bare på denne enheten.");

  useEffect(() => {
    queueMicrotask(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) { try { setHoldings(JSON.parse(saved)); } catch {} }
      setReady(true);
    });
  }, []);

  useEffect(() => { if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings)); }, [holdings, ready]);

  const totals = useMemo(() => {
    const value = holdings.reduce((sum, item) => sum + item.units * item.price, 0);
    const cost = holdings.reduce((sum, item) => sum + item.cost, 0);
    const today = holdings.reduce((sum, item) => sum + item.units * item.price * item.dailyPercent / 100, 0);
    return { value, cost, today, total: value - cost, totalPercent: cost ? ((value - cost) / cost) * 100 : 0, todayPercent: value ? (today / (value - today)) * 100 : 0 };
  }, [holdings]);

  const remove = (id: string) => setHoldings((current) => current.filter((item) => item.id !== id));
  const resetDemo = () => { setHoldings(demoHoldings); setNotice("Demoporteføljen er gjenopprettet."); };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Min Sparing, forsiden"><span className="brand-mark">M</span><span>Min Sparing</span></a>
        <nav aria-label="Hovedmeny"><a href="#oversikt" className="active">Oversikt</a><a href="#beholdning">Beholdning</a><a href="#datakilder">Datakilder</a></nav>
        <button className="add-button compact" onClick={() => setAdding(true)}><Plus size={17} /> Legg til</button>
      </header>

      <section className="shell" id="top">
        <div className="intro" id="oversikt">
          <div><p className="eyebrow">Din samlede spareoversikt</p><h1>God oversikt.<br /><em>Bedre ro.</em></h1></div>
          <p className="intro-copy">Fond, aksjer og krypto samlet på ett sted — med ærlig merking av hva som er ferskt, forsinket eller manuelt.</p>
        </div>

        <section className="balance" aria-label="Porteføljeverdi">
          <div className="balance-main"><span>Total spareverdi</span><strong>{money.format(totals.value)}</strong><small><ShieldCheck size={15} /> Lagret lokalt på enheten din</small></div>
          <div className="balance-stat"><span>I dag</span><b className={totals.today >= 0 ? "positive" : "negative"}>{signedMoney(totals.today)}</b><small>{signedPercent(totals.todayPercent)}</small></div>
          <div className="balance-stat"><span>Total avkastning</span><b className={totals.total >= 0 ? "positive" : "negative"}>{signedMoney(totals.total)}</b><small>{signedPercent(totals.totalPercent)}</small></div>
        </section>

        <div className="notice"><Sparkles size={17} /><span>{notice}</span><button onClick={resetDemo}>Tilbakestill demo</button></div>

        <section className="holdings-section" id="beholdning">
          <div className="section-heading"><div><p className="eyebrow">Beholdning</p><h2>Alt du sparer i</h2></div><button className="add-button" onClick={() => setAdding(true)}><Plus size={18} /> Legg til investering</button></div>
          <div className="holdings-list">
            {holdings.map((item) => <HoldingRow key={item.id} item={item} onRemove={() => remove(item.id)} />)}
            {!holdings.length && <div className="empty"><p>Her er det god plass.</p><span>Legg til din første investering for å få en samlet oversikt.</span><button className="add-button" onClick={() => setAdding(true)}><Plus size={18} /> Kom i gang</button></div>}
          </div>
        </section>

        <section className="data-note" id="datakilder">
          <div><p className="eyebrow">Slik leser du tallene</p><h2>Ikke all kursdata er like fersk.</h2></div>
          <div className="note-grid"><p><b>Live / nylig</b>Aksjer og krypto kan hentes automatisk når datakilden er tilgjengelig.</p><p><b>Forsinket NAV</b>Fond prises vanligvis én gang daglig, ofte først neste bankdag.</p><p><b>Manuell</b>Ditt eget tall overstyrer automatisk kurs til du velger noe annet.</p></div>
        </section>
      </section>

      <footer><span>Min Sparing</span><p>En enkel oversikt, ikke investeringsråd.</p><a href="#datakilder">Om datakvalitet</a></footer>
      {adding && <AddPanel onClose={() => setAdding(false)} onAdd={(item) => { setHoldings((current) => [item, ...current]); setAdding(false); setNotice(`${item.name} ble lagt til.`); }} />}
    </main>
  );
}

function HoldingRow({ item, onRemove }: { item: Holding; onRemove: () => void }) {
  const Icon = kindIcon[item.kind];
  const value = item.units * item.price;
  const profit = value - item.cost;
  return <article className="holding-row">
    <div className={`asset-icon ${item.kind}`}><Icon size={20} /></div>
    <div className="asset-name"><h3>{item.name}</h3><p>{item.platform} · {item.symbol}</p></div>
    <div className="source"><span className={item.delayed ? "status delayed" : "status"}>{item.delayed ? "Forsinket NAV" : item.source}</span><small>{formatTime(item.updatedAt)}</small></div>
    <div className="asset-value"><b>{money.format(value)}</b><small>{number.format(item.units)} andeler</small></div>
    <div className={`asset-change ${item.dailyPercent >= 0 ? "positive" : "negative"}`}>{item.dailyPercent >= 0 ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}<div><b>{signedPercent(item.dailyPercent)}</b><small>{signedMoney(profit)} totalt</small></div></div>
    <button className="remove" onClick={onRemove} aria-label={`Fjern ${item.name}`}><X size={17} /></button>
  </article>;
}

function AddPanel({ onClose, onAdd }: { onClose: () => void; onAdd: (item: Holding) => void }) {
  const [kind, setKind] = useState<AssetKind>("fund");
  const [mode, setMode] = useState<PriceMode>("automatic");
  const [entryMethod, setEntryMethod] = useState<"value" | "units">("value");
  const [search, setSearch] = useState(""); const [selected, setSelected] = useState<Instrument | null>(null);
  const [symbol, setSymbol] = useState(""); const [name, setName] = useState(""); const [quoteSymbol, setQuoteSymbol] = useState(""); const [platform, setPlatform] = useState("Nordnet");
  const [portfolioValue, setPortfolioValue] = useState(""); const [units, setUnits] = useState(""); const [cost, setCost] = useState(""); const [price, setPrice] = useState(""); const [daily, setDaily] = useState("0");
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [quoteSource, setQuoteSource] = useState("Manuelt registrert");
  const matches = useMemo(() => searchInstruments(kind, search), [kind, search]);
  const calculatedUnits = toNumber(price) > 0 && toNumber(portfolioValue) > 0 ? toNumber(portfolioValue) / toNumber(price) : 0;
  const calculatedValue = toNumber(price) > 0 && toNumber(units) > 0 ? toNumber(units) * toNumber(price) : 0;

  async function fetchQuote(targetSymbol = quoteSymbol || symbol) {
    if (!targetSymbol) return setError("Velg et instrument eller skriv inn et symbol.");
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/quote?kind=${kind}&symbol=${encodeURIComponent(targetSymbol)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPrice(String(data.price)); setDaily(String(data.changePercent ?? 0)); setQuoteSource(data.source); if (data.name && !name) setName(data.name);
    } catch (e) { setError(e instanceof Error ? e.message : "Kunne ikke hente kurs."); }
    finally { setLoading(false); }
  }

  function selectInstrument(item: Instrument) {
    setSelected(item); setSearch(""); setName(item.name); setSymbol(item.symbol); setQuoteSymbol(item.quoteSymbol ?? item.symbol); setError("");
  }

  function changeKind(value: AssetKind) {
    setKind(value); setSelected(null); setSearch(""); setName(""); setSymbol(""); setQuoteSymbol(""); setPrice(""); setDaily("0"); setError("");
    if (value === "crypto" && platform === "Nordnet") setPlatform("Firi");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const finalUnits = entryMethod === "value" ? calculatedUnits : toNumber(units);
    const currentValue = finalUnits * toNumber(price);
    if (!name || !symbol || !price || !finalUnits) return setError("Velg investering og fyll inn verdi eller antall samt gjeldende kurs.");
    onAdd({ id: crypto.randomUUID(), name, symbol: symbol.toUpperCase(), kind, platform, mode, units: finalUnits, cost: toNumber(cost) || currentValue, price: toNumber(price), dailyPercent: toNumber(daily), currency: "NOK", source: quoteSource, updatedAt: new Date().toISOString(), delayed: kind === "fund" });
  }

  return <div className="panel-layer" role="dialog" aria-modal="true" aria-label="Legg til investering"><button className="panel-scrim" onClick={onClose} aria-label="Lukk" /><aside className="panel">
    <div className="panel-head"><div><p className="eyebrow">Ny investering</p><h2>Legg til i oversikten</h2></div><button className="close" onClick={onClose}><X /></button></div>
    <form onSubmit={submit}>
      <fieldset className="segmented"><legend>Type</legend>{(["fund", "stock", "crypto"] as AssetKind[]).map((value) => <button type="button" key={value} className={kind === value ? "selected" : ""} onClick={() => changeKind(value)}>{kindLabel[value]}</button>)}</fieldset>
      <div className="instrument-picker">
        <label>{selected ? "Valgt investering" : `Søk etter ${kindLabel[kind].toLocaleLowerCase("nb-NO")}`}</label>
        {selected ? <div className="selected-instrument"><div className={`asset-icon ${kind}`}>{kind === "fund" ? <Landmark size={19} /> : kind === "stock" ? <WalletCards size={19} /> : <Coins size={19} />}</div><span><b>{selected.name}</b><small>{selected.market} · {selected.symbol}</small></span><button type="button" onClick={() => { setSelected(null); setName(""); setSymbol(""); setQuoteSymbol(""); setPrice(""); }}>Bytt</button></div> : <><div className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} autoFocus placeholder={kind === "fund" ? "Søk KLP, DNB, global, indeks…" : kind === "stock" ? "Søk Equinor, Apple, ticker…" : "Søk Bitcoin, Ethereum…"} /></div><div className="instrument-results" role="listbox" aria-label={`Tilgjengelige ${kindLabel[kind].toLocaleLowerCase("nb-NO")}`}>{matches.map((item) => <button type="button" key={`${item.kind}-${item.symbol}`} onClick={() => selectInstrument(item)}><span><b>{item.name}</b><small>{item.market}</small></span><em>{item.symbol}</em></button>)}{!matches.length && <p>Ingen treff. Prøv navn, ticker eller marked.</p>}</div></>}
      </div>
      <fieldset className="mode-choice"><legend>Kurshenting</legend><label className={mode === "automatic" ? "chosen" : ""}><input type="radio" checked={mode === "automatic"} onChange={() => setMode("automatic")} /><span><b>Automatisk</b><small>Hent fra datakilde</small></span></label><label className={mode === "manual" ? "chosen" : ""}><input type="radio" checked={mode === "manual"} onChange={() => setMode("manual")} /><span><b>Manuell</b><small>Du styrer kursen</small></span></label></fieldset>
      {!selected && <div className="two-fields manual-identifiers"><label>Eget navn<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Navn på investeringen" /></label><label>Symbol / ISIN<input value={symbol} onChange={(e) => { setSymbol(e.target.value); setQuoteSymbol(e.target.value); }} placeholder="Ticker eller ISIN" /></label></div>}
      <label>Plattform<div className="select-wrap"><select value={platform} onChange={(e) => setPlatform(e.target.value)}><option>Nordnet</option><option>Kron</option><option>Firi</option><option>DNB</option><option>Storebrand</option><option>KLP</option><option>Annet</option></select><ChevronDown size={16} /></div></label>
      <fieldset className="entry-choice"><legend>Hva vil du skrive inn?</legend><button type="button" className={entryMethod === "value" ? "selected" : ""} onClick={() => setEntryMethod("value")}>Sum</button><button type="button" className={entryMethod === "units" ? "selected" : ""} onClick={() => setEntryMethod("units")}>Antall andeler</button></fieldset>
      {entryMethod === "value" ? <label>Sum i dag<input inputMode="decimal" value={portfolioValue} onChange={(e) => setPortfolioValue(e.target.value)} placeholder="For eksempel 50 000 kr" /></label> : <label>Antall andeler<input inputMode="decimal" value={units} onChange={(e) => setUnits(e.target.value)} placeholder="For eksempel 12,5" /></label>}
      {mode === "automatic" && selected && <button type="button" className="fetch" onClick={() => fetchQuote()} disabled={loading}><RefreshCw size={17} className={loading ? "spin" : ""} />{loading ? "Henter kurs…" : price ? "Oppdater kurs og beregning" : "Hent kurs og beregn"}</button>}
      {error && <p className="form-error"><CircleHelp size={16} />{error}</p>}
      <div className="two-fields"><label>Nåværende kurs<input inputMode="decimal" value={price} onChange={(e) => { setPrice(e.target.value); if (mode === "manual") setQuoteSource("Manuelt registrert"); }} placeholder="Hentes eller skrives inn" /></label><label>Dagens endring<input inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} placeholder="0 %" /></label></div>
      {entryMethod === "value" && calculatedUnits > 0 && <div className="calculation"><span>Beregnet beholdning</span><b>{number.format(calculatedUnits)} andeler</b><small>{money.format(toNumber(portfolioValue))} ÷ {money.format(toNumber(price))}</small></div>}
      {entryMethod === "units" && calculatedValue > 0 && <div className="calculation"><span>Beregnet verdi i dag</span><b>{money.format(calculatedValue)}</b><small>{number.format(toNumber(units))} andeler × {money.format(toNumber(price))}</small></div>}
      <label>Opprinnelig investert <small className="optional">Valgfritt — brukes til total avkastning</small><input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder={portfolioValue || "Hvis tomt brukes dagens verdi"} /></label>
      {kind === "fund" && <p className="fund-warning"><CircleHelp size={17} /><span><b>Fond har forsinket kurs.</b> NAV oppdateres normalt én gang per dag, ofte neste bankdag.</span></p>}
      <button className="submit" type="submit"><Plus size={18} /> Legg til investering</button>
    </form>
  </aside></div>;
}

function formatTime(value: string) { return new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function signedMoney(value: number) { return `${value >= 0 ? "+" : "−"}${money.format(Math.abs(value))}`; }
function signedPercent(value: number) { return `${value >= 0 ? "+" : "−"}${Math.abs(value).toLocaleString("nb-NO", { maximumFractionDigits: 2 })} %`; }
function toNumber(value: string) {
  const compact = value.replace(/\s/g, "");
  const withoutThousands = /^\d{1,3}(\.\d{3})+$/.test(compact) ? compact.replace(/\./g, "") : compact;
  return Number(withoutThousands.replace(",", ".")) || 0;
}
