"use client";

import {
  useEffect,
  useMemo,
  useRef,
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
  History,
  Landmark,
  ListFilter,
  LockKeyhole,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  TrendingUp,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { searchInstruments, type Instrument } from "@/lib/catalog";
import { AccountButton } from "@/components/account-button";
import { DataSafetyPanel } from "@/components/data-safety";
import { EquityHistory } from "@/components/equity-history";
import { MoversCard } from "@/components/movers-card";
import {
  mergeSnapshots,
  snapshotPoints,
  upsertDailySnapshot,
  type DailySnapshot,
} from "@/lib/history";
import {
  applyReconstruction,
  reconstructSnapshots,
  type PriceSeries,
} from "@/lib/reconstruct";
import { TaxPanel } from "@/components/tax-panel";
import { demoHoldings } from "@/lib/demo";
import {
  backupCurrent,
  loadPortfolio,
  savePortfolio,
  STORAGE_KEYS,
  type PortfolioData,
} from "@/lib/storage";
import { decideMerge, fetchRemote, pushRemote } from "@/lib/sync";
import type { SyncState } from "@/components/data-safety";
import {
  buildProjectionPath,
  buildProjectionSeries,
  calculateHistoricalPortfolio,
  projectValue,
  type ReturnPeriod,
} from "@/lib/historical-returns";
import {
  addPurchase,
  calculateTotals,
  dailyValue,
  getQuoteState,
  hasCalendarDayChange,
  holdingDailyPercent,
  holdingValue,
  migrateHolding,
} from "@/lib/portfolio";
import type {
  AccountGroup,
  AssetKind,
  Holding,
  PortfolioEvent,
  PriceMode,
} from "@/lib/types";

const money = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 4 });
const shortDate = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
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

type DataState = "loading" | "user" | "demo" | "corrupt";

export function Portfolio() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [events, setEvents] = useState<PortfolioEvent[]>([]);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [dataState, setDataState] = useState<DataState>("loading");
  const [corruptKey, setCorruptKey] = useState<string | null>(null);
  const lastSeenSavedAt = useRef<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [buying, setBuying] = useState<Holding | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [activeAccount, setActiveAccount] = useState<AccountFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("value");

  useEffect(() => {
    queueMicrotask(() => {
      const result = loadPortfolio(localStorage);
      if (result.status === "ok" || result.status === "recovered-legacy") {
        const migrated = result.data.holdings.map(migrateHolding);
        setHoldings(migrated);
        setEvents(result.data.events);
        setSnapshots(result.data.snapshots);
        lastSeenSavedAt.current = result.savedAt;
        setDataState("user");
        void refreshOfficialFunds(migrated).then(setHoldings);
      } else if (result.status === "corrupt") {
        setCorruptKey(result.corruptKey);
        setDataState("corrupt");
      } else {
        setHoldings(demoHoldings);
        setDataState("demo");
      }
    });
  }, []);
  useEffect(() => {
    if (dataState !== "user") return;
    lastSeenSavedAt.current = savePortfolio(
      localStorage,
      { holdings, events, snapshots },
      { lastSeenSavedAt: lastSeenSavedAt.current },
    );
  }, [holdings, events, snapshots, dataState]);
  /** NAV publiseres maks én gang per virkedag, men publiseringstidspunktet
   *  varierer — re-poll mens appen er åpen så ny kurs fanges raskt. Oppdaterer
   *  bare state når kurs/status faktisk endret seg. */
  useEffect(() => {
    if (dataState !== "user" || holdings.length === 0) return;
    const timer = window.setInterval(() => {
      void refreshOfficialFunds(holdings).then((next) => {
        const changed = next.some(
          (item, index) =>
            item.price !== holdings[index]?.price ||
            item.priceAsOf !== holdings[index]?.priceAsOf ||
            item.quoteStatus !== holdings[index]?.quoteStatus,
        );
        if (changed) setHoldings(next);
      });
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [holdings, dataState]);
  /** Rekonstruert historikk: dagens beholdning × ekte kurshistorikk gir en
   *  graf fra dag én. Kjøres når porteføljens sammensetning endres; ferske
   *  serier oppdaterer også fondskurser som er eldre enn kilden. */
  const reconstructedFor = useRef<string | null>(null);
  useEffect(() => {
    if (dataState !== "user" || holdings.length === 0) return;
    const signature = holdings
      .map((item) => `${item.kind}:${item.symbol}:${item.units}`)
      .sort()
      .join("|");
    if (reconstructedFor.current === signature) return;
    reconstructedFor.current = signature;
    const unique = [
      ...new Map(
        holdings.map((item) => [item.symbol.toUpperCase(), item]),
      ).values(),
    ];
    void (async () => {
      const series: PriceSeries = new Map();
      await Promise.all(
        unique.map(async (item) => {
          try {
            const response = await fetch(
              `/api/history?symbol=${encodeURIComponent(item.symbol)}&kind=${item.kind}`,
            );
            if (!response.ok) return;
            const json = await response.json();
            if (Array.isArray(json.points) && json.points.length > 1) {
              series.set(item.symbol.toUpperCase(), json.points);
            }
          } catch {
            // Manglende historikk for ett instrument stopper ikke resten.
          }
        }),
      );
      if (series.size === 0) return;
      setSnapshots((current) => {
        const observedDates = new Set(
          current
            .filter((item) => item.origin !== "rec")
            .map((item) => item.date),
        );
        const reconstructed = reconstructSnapshots(
          holdings,
          series,
          observedDates,
        );
        return applyReconstruction(current, reconstructed);
      });
      // Ferskere sluttkurs i serien enn på beholdningen? Oppdater fondet.
      setHoldings((current) => {
        let changed = false;
        const next = current.map((item) => {
          if (item.kind !== "fund" || item.mode !== "automatic") return item;
          const points = series.get(item.symbol.toUpperCase());
          if (!points || points.length < 2) return item;
          const last = points[points.length - 1];
          const previous = points[points.length - 2];
          if (item.priceDate && item.priceDate >= last.date) return item;
          changed = true;
          return {
            ...item,
            price: last.price,
            previousPrice: previous.price,
            dailyPercent:
              previous.price > 0
                ? ((last.price - previous.price) / previous.price) * 100
                : item.dailyPercent,
            changePeriod: "day" as const,
            priceDate: last.date,
            source: "Fondsportalen · offisiell NAV",
            updatedAt: new Date().toISOString(),
          };
        });
        return changed ? next : current;
      });
    })();
  }, [holdings, dataState]);
  /** Ett historikkpunkt per dag; dagens punkt følger siste observerte verdi.
   *  upsertDailySnapshot er referansestabil uten endring — ingen løkke. */
  useEffect(() => {
    if (dataState !== "user" || holdings.length === 0) return;
    const timer = window.setTimeout(() => {
      setSnapshots((current) =>
        upsertDailySnapshot(current, holdings, new Date()),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [holdings, dataState]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEYS.DATA_KEY || event.newValue === null) {
        return;
      }
      const result = loadPortfolio(localStorage);
      if (result.status === "ok") {
        lastSeenSavedAt.current = result.savedAt;
        setHoldings(result.data.holdings.map(migrateHolding));
        setEvents(result.data.events);
        // Fletting, ikke erstatning: en annen fane med eldre klient skal
        // aldri kunne nulle historikken i denne fanen.
        setSnapshots((current) =>
          mergeSnapshots(current, result.data.snapshots),
        );
        setDataState("user");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  /** Demo-data blir brukerens egne først når de faktisk endrer noe. */
  const claimOwnership = () =>
    setDataState((state) => (state === "user" ? state : "user"));
  const replaceAll = (data: PortfolioData) => {
    backupCurrent(localStorage, "pre-replace");
    claimOwnership();
    setCorruptKey(null);
    setHoldings(data.holdings.map(migrateHolding));
    setEvents(data.events);
    // Historikk unionsflettes i stedet for å erstattes — dager samlet lokalt
    // skal overleve import/gjenoppretting.
    setSnapshots((current) => mergeSnapshots(current, data.snapshots));
  };
  const startFresh = () => {
    claimOwnership();
    setHoldings([]);
    setEvents([]);
    setSnapshots([]);
  };

  const { data: session, status: authStatus } = useSession();
  /** Fey-hilsen for innloggede. Settes etter hydrering — SSR og første
   *  klient-render må være identiske («Porteføljen min»). */
  const [heading, setHeading] = useState("Porteføljen min");
  useEffect(() => {
    const name = session?.user?.name?.split(" ")[0];
    queueMicrotask(() => {
      if (authStatus !== "authenticated" || !name) {
        setHeading("Porteføljen min");
        return;
      }
      const hour = new Date().getHours();
      const time =
        hour >= 5 && hour < 12
          ? "morgen"
          : hour >= 12 && hour < 17
            ? "ettermiddag"
            : "kveld";
      setHeading(`God ${time}, ${name}`);
    });
  }, [authStatus, session]);
  const [syncState, setSyncState] = useState<SyncState>("off");
  const initialSyncDone = useRef(false);
  useEffect(() => {
    if (
      authStatus !== "authenticated" ||
      dataState === "loading" ||
      initialSyncDone.current
    ) {
      return;
    }
    initialSyncDone.current = true;
    const localData: PortfolioData =
      dataState === "user"
        ? { holdings, events, snapshots }
        : { holdings: [], events: [], snapshots: [] };
    void (async () => {
      setSyncState("checking");
      const remote = await fetchRemote();
      if (!remote) {
        setSyncState("error");
        return;
      }
      const decision = decideMerge(
        { savedAt: lastSeenSavedAt.current, data: localData },
        remote,
      );
      if (decision.action === "take-remote") {
        replaceAll(decision.data);
      } else {
        setSnapshots((current) => mergeSnapshots(current, decision.snapshots));
        if (decision.pushLocal) {
          await pushRemote(lastSeenSavedAt.current ?? new Date().toISOString(), {
            ...localData,
            snapshots: decision.snapshots,
          });
        }
      }
      setSyncState("synced");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, dataState, holdings, events, snapshots]);
  useEffect(() => {
    if (
      authStatus !== "authenticated" ||
      dataState !== "user" ||
      !initialSyncDone.current
    ) {
      return;
    }
    const timer = setTimeout(() => {
      void pushRemote(
        lastSeenSavedAt.current ?? new Date().toISOString(),
        { holdings, events, snapshots },
      ).then((ok) => setSyncState(ok ? "synced" : "error"));
    }, 2000);
    return () => clearTimeout(timer);
  }, [holdings, events, snapshots, authStatus, dataState]);
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      initialSyncDone.current = false;
      queueMicrotask(() => setSyncState("off"));
    }
  }, [authStatus]);
  /** Live-konvergens mellom enheter: en åpen fane henter skyen på nytt ved
   *  fokus og hvert 90. sekund, og tar nyere fjernversjoner i bruk med samme
   *  tapsfrie flettepolicy som ved innlogging. */
  const liveSyncData = useRef<PortfolioData>({
    holdings: [],
    events: [],
    snapshots: [],
  });
  useEffect(() => {
    liveSyncData.current = { holdings, events, snapshots };
  }, [holdings, events, snapshots]);
  useEffect(() => {
    if (authStatus !== "authenticated" || dataState !== "user") return;
    let busy = false;
    const pull = async () => {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const remote = await fetchRemote();
        if (!remote) return;
        const decision = decideMerge(
          { savedAt: lastSeenSavedAt.current, data: liveSyncData.current },
          remote,
        );
        if (decision.action === "take-remote") {
          const local = liveSyncData.current;
          const sameContent =
            JSON.stringify([local.holdings, local.events]) ===
            JSON.stringify([decision.data.holdings, decision.data.events]);
          if (sameContent) {
            // Kun savedAt er nyere (typisk vårt eget push fra en annen fane)
            // — adopter stempelet uten re-render, ellers pinger enhetene
            // hverandre med identisk innhold i evig løkke.
            lastSeenSavedAt.current = remote.savedAt;
            setSnapshots((current) =>
              mergeSnapshots(current, decision.data.snapshots),
            );
          } else {
            replaceAll(decision.data);
            setSyncState("synced");
          }
        } else {
          setSnapshots((current) =>
            mergeSnapshots(current, decision.snapshots),
          );
        }
      } finally {
        busy = false;
      }
    };
    const onFocus = () => void pull();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const timer = window.setInterval(() => void pull(), 90_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, dataState]);

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
  const remove = (id: string) => {
    claimOwnership();
    setHoldings((current) => current.filter((item) => item.id !== id));
  };
  const update = (next: Holding) => {
    claimOwnership();
    setHoldings((current) =>
      current.map((item) => (item.id === next.id ? next : item)),
    );
  };
  const moveAccount = (id: string, accountGroup: AccountGroup) => {
    claimOwnership();
    setHoldings((current) =>
      current.map((item) =>
        item.id === id ? { ...item, accountGroup } : item,
      ),
    );
  };
  const recordPurchase = (
    item: Holding,
    purchase: Omit<
      PortfolioEvent,
      "id" | "type" | "holdingId" | "holdingName" | "accountGroup" | "createdAt"
    >,
  ) => {
    claimOwnership();
    setHoldings((current) =>
      current.map((holding) =>
        holding.id === item.id ? addPurchase(holding, purchase) : holding,
      ),
    );
    setEvents((current) => [
      {
        ...purchase,
        id: crypto.randomUUID(),
        type: "buy",
        holdingId: item.id,
        holdingName: item.name,
        accountGroup: getAccount(item),
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
  };

  return (
    <main className="app-shell">
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
              Oversikt
            </a>
            <a href="#beholdning">Beholdning</a>
            <a href="#datakilder">Datakilder</a>
            <a href="#fordeling">Fordeling</a>
          </nav>
          <div className="header-actions">
            <AccountButton />
            <button
              className={`mode-toggle ${advanced ? "active" : ""}`}
              aria-pressed={advanced}
              onClick={() => {
                setAdvanced((value) => !value);
                setAdding(false);
                setEditing(null);
                setBuying(null);
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
        <h1>{heading}</h1>
        <nav className="economy-tabs">
          <button className="active">Oversikt</button>
          <a href="#beholdning">Beholdning</a>
          <a href="#datakilder">Datakvalitet</a>
          <a href="#fordeling">Fordeling</a>
        </nav>
        {dataState === "demo" ? (
          <div className="advanced-notice demo-notice">
            <CircleHelp size={15} />
            <span>
              <b>Du ser eksempeldata.</b> Ingenting lagres før du gjør din
              første endring – da blir porteføljen din egen.
            </span>
            <button
              onClick={() => {
                startFresh();
                setAdvanced(true);
                setAdding(true);
              }}
            >
              <Plus size={14} /> Start med tom portefølje
            </button>
          </div>
        ) : null}
        {dataState === "corrupt" ? (
          <div className="advanced-notice corrupt-notice">
            <CircleHelp size={15} />
            <span>
              <b>Lagrede data kunne ikke leses.</b> Ingenting er slettet – se
              «Sikkerhet»-panelet for råkopi og gjenoppretting.
            </span>
            <a href="#sikkerhet">Åpne Sikkerhet</a>
          </div>
        ) : null}
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
                setBuying(null);
              }}
            >
              <Eye size={14} /> Gå til visning
            </button>
          </div>
        ) : null}

        <AccountRail
          active={activeAccount}
          onChange={setActiveAccount}
          allTotals={allTotals}
          totals={accountTotals}
        />
        <section className="dash-grid">
          <div className="dash-hero">
            <EquityPanel
              totals={totals}
              activeAccount={activeAccount}
              snapshots={dataState === "user" ? snapshots : []}
            />
          </div>
          <aside className="dash-side">
            <TodayPanel totals={totals} />
            <MoversCard holdings={visibleHoldings} />
            <DataPanel holdings={visibleHoldings} />
          </aside>
          <div className="dash-tri">
            <BreakdownPanel
              holdings={holdings}
              totals={accountTotals}
              allTotals={allTotals}
              active={activeAccount}
              onChange={setActiveAccount}
            />
            <TaxPanel holdings={visibleHoldings} />
            <ActivityPanel events={events} activeAccount={activeAccount} />
          </div>
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
                    onBuy={() => setBuying(item)}
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
          <div className="dash-forecast">
            <ForecastPanel holdings={visibleHoldings} />
          </div>
          <aside className="dash-tail">
            <DataSafetyPanel
              data={{ holdings, events, snapshots }}
              isDemo={dataState === "demo"}
              corruptKey={corruptKey}
              onReplace={replaceAll}
              syncState={syncState}
            />
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
            claimOwnership();
            setHoldings((current) => [item, ...current]);
            setEvents((current) => [
              {
                id: crypto.randomUUID(),
                type: "opening",
                holdingId: item.id,
                holdingName: item.name,
                accountGroup: getAccount(item),
                date: new Date().toISOString().slice(0, 10),
                createdAt: new Date().toISOString(),
                units: item.units,
                price: item.units ? item.cost / item.units : item.price,
                amount: item.cost,
              },
              ...current,
            ]);
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
      {advanced && buying ? (
        <BuyPanel
          item={buying}
          onClose={() => setBuying(null)}
          onBuy={(purchase) => {
            recordPurchase(buying, purchase);
            setBuying(null);
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
}: {
  active: AccountFilter;
  onChange: (value: AccountFilter) => void;
  allTotals: ReturnType<typeof calculateTotals>;
  totals: Record<AccountGroup, ReturnType<typeof calculateTotals>>;
}) {
  const chips: {
    key: AccountFilter;
    label: string;
    short: string;
    color?: string;
    values: ReturnType<typeof calculateTotals>;
  }[] = [
    { key: "all", label: "Alle kontoer", short: "MS", values: allTotals },
    ...accountOrder.map((group) => ({
      key: group as AccountFilter,
      label: accountConfig[group].label,
      short: accountConfig[group].short,
      color: accountConfig[group].color,
      values: totals[group],
    })),
  ];
  return (
    <div className="account-chips" role="tablist" aria-label="Kontofilter">
      {chips.map((chip) => (
        <button
          key={chip.key}
          role="tab"
          aria-selected={active === chip.key}
          className={`acct-chip ${active === chip.key ? "on" : ""}`}
          style={
            chip.color
              ? ({ "--account-color": chip.color } as CSSProperties)
              : undefined
          }
          onClick={() => onChange(chip.key)}
        >
          <i>{chip.short}</i>
          <span>
            <b>{chip.label}</b>
            <small>{money.format(chip.values.value)}</small>
          </span>
          <em
            className={
              !chip.values.updated
                ? "neutral"
                : chip.values.today >= 0
                  ? "positive"
                  : "negative"
            }
          >
            {chip.values.updated
              ? signedPercent(chip.values.todayPercent)
              : "—"}
          </em>
        </button>
      ))}
    </div>
  );
}

function EquityPanel({
  totals,
  activeAccount,
  snapshots,
}: {
  totals: ReturnType<typeof calculateTotals>;
  activeAccount: AccountFilter;
  snapshots: DailySnapshot[];
}) {
  const historyPoints = useMemo(
    () => snapshotPoints(snapshots, activeAccount),
    [snapshots, activeAccount],
  );
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
            <b
              className={
                !totals.updated
                  ? "neutral"
                  : totals.today >= 0
                    ? "positive"
                    : "negative"
              }
            >
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
      <EquityHistory points={historyPoints} />
      <div className="range-row">
        <div className="selected">
          <span>I dag</span>
          <b
            className={
              !totals.updated
                ? "neutral"
                : totals.today >= 0
                  ? "positive"
                  : "negative"
            }
          >
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
        <strong
          className={
            !totals.updated
              ? "neutral"
              : totals.today >= 0
                ? "positive"
                : "negative"
          }
        >
          {totals.updated ? signedMoney(totals.today) : "—"}
        </strong>
        <b
          className={
            !totals.updated
              ? "neutral"
              : totals.today >= 0
                ? "positive"
                : "negative"
          }
        >
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
        {(
          [
            ["live", "Dagens utvikling tilgjengelig", current],
            ["nav", "Innen normal publisering", normal],
            ["late", "Datakilde etter fristen", late],
            ["manual", "Manuelt registrert", manual],
          ] as const
        ).map(([tone, label, count]) => (
          <div key={tone} className={count === 0 ? "is-zero" : undefined}>
            <span className={`quality-dot ${tone}`} />
            <p>
              <b>{label}</b>
              <small>{count} investeringer</small>
            </p>
          </div>
        ))}
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

function ActivityPanel({
  events,
  activeAccount,
}: {
  events: PortfolioEvent[];
  activeAccount: AccountFilter;
}) {
  const visibleEvents = events
    .filter(
      (event) =>
        activeAccount === "all" || event.accountGroup === activeAccount,
    )
    .slice(0, 5);

  return (
    <section className="activity-card" id="aktivitet">
      <div className="card-title-row">
        <div>
          <h2>Aktivitetslogg</h2>
          <span>Kjøp og nye investeringer</span>
        </div>
        <ReceiptText size={16} />
      </div>
      {visibleEvents.length ? (
        <div className="activity-list">
          {visibleEvents.map((event) => (
            <div className="activity-row" key={event.id}>
              <span className="activity-icon">
                {event.type === "buy" ? (
                  <ShoppingCart size={14} />
                ) : (
                  <Plus size={14} />
                )}
              </span>
              <p>
                <b>{event.type === "buy" ? "Ekstra kjøp" : "Lagt til"}</b>
                <span title={event.holdingName}>{event.holdingName}</span>
                <small>
                  {formatEventDate(event.date)} · {number.format(event.units)}{" "}
                  andeler
                </small>
              </p>
              <strong>{money.format(event.amount)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="activity-empty">
          <History size={20} />
          <p>
            <b>Ingen kjøp registrert ennå</b>
            <span>Kjøp du legger inn i avansert modus vises her.</span>
          </p>
        </div>
      )}
    </section>
  );
}

function ForecastPanel({ holdings }: { holdings: Holding[] }) {
  const [years, setYears] = useState(5);
  const [basis, setBasis] = useState<"history" | "manual">("history");
  const [historyPeriod, setHistoryPeriod] = useState<ReturnPeriod>(5);
  const [annualReturn, setAnnualReturn] = useState("7");
  const [fallbackReturn, setFallbackReturn] = useState("7");
  const [monthlySaving, setMonthlySaving] = useState("0");
  const [startOverride, setStartOverride] = useState("");
  const fallbackRate = Math.max(-99, Math.min(50, toNumber(fallbackReturn)));
  const history = useMemo(
    () => calculateHistoricalPortfolio(holdings, historyPeriod, fallbackRate),
    [holdings, historyPeriod, fallbackRate],
  );
  const currentValue = startOverride.trim()
    ? Math.max(0, toNumber(startOverride))
    : history.totalValue;
  const manualRate = Math.max(-99, Math.min(50, toNumber(annualReturn)));
  const rate = basis === "history" ? history.effectiveRate : manualRate;
  const monthly = Math.max(0, toNumber(monthlySaving));
  const cautiousRate = Math.max(-99, rate - 3);
  const strongRate = Math.min(50, rate + 3);
  const cautious = projectValue(currentValue, monthly, cautiousRate, years);
  const expected = projectValue(currentValue, monthly, rate, years);
  const optimistic = projectValue(currentValue, monthly, strongRate, years);
  const contributions = monthly * years * 12;
  const modeledReturn = expected - currentValue - contributions;
  const cautiousSeries = buildProjectionSeries(
    currentValue,
    monthly,
    cautiousRate,
    years,
  );
  const expectedSeries = buildProjectionSeries(
    currentValue,
    monthly,
    rate,
    years,
  );
  const strongSeries = buildProjectionSeries(
    currentValue,
    monthly,
    strongRate,
    years,
  );
  const chartMaximum = Math.max(
    1,
    ...strongSeries.map((point) => point.value),
    ...expectedSeries.map((point) => point.value),
  );
  const chartWidth = 620;
  const chartHeight = 176;

  return (
    <section className="forecast-card" id="prognose">
      <div className="card-title-row">
        <div>
          <h2>Fremtidsestimat</h2>
          <span>Historisk grunnlag eller egne antakelser</span>
        </div>
        <TrendingUp size={16} />
      </div>
      <div
        className="forecast-mode"
        role="group"
        aria-label="Grunnlag for avkastning"
      >
        <button
          className={basis === "history" ? "selected" : ""}
          aria-pressed={basis === "history"}
          onClick={() => setBasis("history")}
        >
          Historisk avkastning
        </button>
        <button
          className={basis === "manual" ? "selected" : ""}
          aria-pressed={basis === "manual"}
          onClick={() => setBasis("manual")}
        >
          Egne tall
        </button>
      </div>
      <div className="forecast-layout">
        <div className="forecast-controls">
          {basis === "history" ? (
            <div className="forecast-control-block">
              <div className="forecast-label-row">
                <span>Periode for avkastning</span>
                <small>Årlig CAGR</small>
              </div>
              <div
                className="forecast-periods"
                role="group"
                aria-label="Historikkperiode"
              >
                {([1, 3, 5, 10] as ReturnPeriod[]).map((value) => (
                  <button
                    key={value}
                    className={historyPeriod === value ? "selected" : ""}
                    aria-pressed={historyPeriod === value}
                    onClick={() => setHistoryPeriod(value)}
                  >
                    {value} år
                  </button>
                ))}
              </div>
              <div className="history-rate-summary">
                <span>
                  <b>
                    {history.historicalRate === null
                      ? "Ingen treff"
                      : formatRate(history.historicalRate)}
                  </b>
                  <small>verdi-vektet fondshistorikk</small>
                </span>
                <span>
                  <b>{Math.round(history.coveragePercent)} %</b>
                  <small>
                    {history.matched.length} av {holdings.length} investeringer
                  </small>
                </span>
              </div>
            </div>
          ) : null}

          <div className="forecast-control-block">
            <div className="forecast-label-row">
              <span>Tidshorisont</span>
              <small>{years} år</small>
            </div>
            <div
              className="forecast-years"
              role="group"
              aria-label="Tidshorisont"
            >
              {[1, 3, 5, 10, 20, 30].map((value) => (
                <button
                  key={value}
                  className={years === value ? "selected" : ""}
                  aria-pressed={years === value}
                  onClick={() => setYears(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="forecast-inputs">
            <label>
              Startverdi
              <span>
                <input
                  inputMode="numeric"
                  value={startOverride}
                  onChange={(event) => setStartOverride(event.target.value)}
                  placeholder={String(Math.round(history.totalValue))}
                  aria-label="Startverdi for scenario"
                />
                <i>kr</i>
              </span>
              <small>Tomt felt bruker porteføljen</small>
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
            <label>
              {basis === "history"
                ? "Uten tilgjengelig historikk"
                : "Forventet avkastning"}
              <span>
                <input
                  inputMode="decimal"
                  value={basis === "history" ? fallbackReturn : annualReturn}
                  onChange={(event) =>
                    basis === "history"
                      ? setFallbackReturn(event.target.value)
                      : setAnnualReturn(event.target.value)
                  }
                  aria-label={
                    basis === "history"
                      ? "Årlig avkastning for investeringer uten historikk"
                      : "Forventet årlig avkastning"
                  }
                />
                <i>%</i>
              </span>
              {basis === "history" ? (
                <small>
                  Brukes på {Math.round(100 - history.coveragePercent)} % av
                  verdien
                </small>
              ) : null}
            </label>
          </div>

          {basis === "history" ? (
            <details className="forecast-source">
              <summary>
                Se historisk datagrunnlag ({history.matched.length})
              </summary>
              <div>
                {history.matched.length ? (
                  history.matched.map((fund) => (
                    <p key={fund.name}>
                      <span>
                        <b>{fund.name}</b>
                        <small>
                          {fund.source} · per {fund.asOf} · etter fondsgebyr
                        </small>
                      </span>
                      <strong>{formatRate(fund.annualReturn)}</strong>
                    </p>
                  ))
                ) : (
                  <p>
                    <span>
                      <b>Ingen fond har {historyPeriod}-årshistorikk ennå.</b>
                      <small>
                        Det manuelle reservetallet brukes i scenarioet.
                      </small>
                    </span>
                  </p>
                )}
              </div>
            </details>
          ) : null}
        </div>

        <div className="forecast-result">
          <div className="forecast-main">
            <span>Estimert verdi om {years} år</span>
            <strong>{money.format(expected)}</strong>
            <small>
              {money.format(currentValue)} i startverdi · {formatRate(rate)}{" "}
              årlig
            </small>
          </div>
          <div className="forecast-chart">
            <div className="chart-scale">
              <span>{compactMoney(chartMaximum)}</span>
              <span>{compactMoney(chartMaximum / 2)}</span>
              <span>0</span>
            </div>
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              role="img"
              aria-label={`Modellert verdiutvikling over ${years} år`}
            >
              <line x1="0" y1="0" x2={chartWidth} y2="0" />
              <line
                x1="0"
                y1={chartHeight / 2}
                x2={chartWidth}
                y2={chartHeight / 2}
              />
              <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} />
              <path
                className="cautious-line"
                d={buildProjectionPath(
                  cautiousSeries.map((point) => point.value),
                  chartWidth,
                  chartHeight,
                  chartMaximum,
                )}
              />
              <path
                className="strong-line"
                d={buildProjectionPath(
                  strongSeries.map((point) => point.value),
                  chartWidth,
                  chartHeight,
                  chartMaximum,
                )}
              />
              <path
                className="selected-line"
                d={buildProjectionPath(
                  expectedSeries.map((point) => point.value),
                  chartWidth,
                  chartHeight,
                  chartMaximum,
                )}
              />
            </svg>
            <div className="chart-axis">
              <span>I dag</span>
              <span>{years} år</span>
            </div>
          </div>
          <div className="forecast-composition">
            <span>
              <small>Startverdi</small>
              <b>{money.format(currentValue)}</b>
            </span>
            <span>
              <small>Nye innskudd</small>
              <b>{money.format(contributions)}</b>
            </span>
            <span>
              <small>Modellert avkastning</small>
              <b className={modeledReturn >= 0 ? "positive" : "negative"}>
                {signedMoney(modeledReturn)}
              </b>
            </span>
          </div>
        </div>
      </div>
      <div className="forecast-range">
        <div>
          <span>Forsiktig</span>
          <b>{money.format(cautious)}</b>
          <small>{formatRate(cautiousRate)} årlig</small>
        </div>
        <div className="selected">
          <span>Valgt</span>
          <b>{money.format(expected)}</b>
          <small>{formatRate(rate)} årlig</small>
        </div>
        <div>
          <span>Sterk</span>
          <b>{money.format(optimistic)}</b>
          <small>{formatRate(strongRate)} årlig</small>
        </div>
      </div>
      <p className="forecast-note">
        <CircleHelp size={14} /> Historisk avkastning er ingen garanti for
        fremtidig avkastning. Scenarioet er nominelt og før skatt,
        plattformgebyr og inflasjon.
      </p>
    </section>
  );
}

const kindConfig: Record<AssetKind, { label: string; color: string }> = {
  fund: { label: "Fond", color: "var(--account-private)" },
  stock: { label: "Aksjer", color: "var(--account-business)" },
  crypto: { label: "Krypto", color: "var(--warning)" },
};
const kindOrder: AssetKind[] = ["fund", "stock", "crypto"];

function BreakdownPanel({
  holdings,
  totals,
  allTotals,
  active,
  onChange,
}: {
  holdings: Holding[];
  totals: Record<AccountGroup, ReturnType<typeof calculateTotals>>;
  allTotals: ReturnType<typeof calculateTotals>;
  active: AccountFilter;
  onChange: (value: AccountFilter) => void;
}) {
  const [mode, setMode] = useState<"account" | "kind">("account");
  const kindTotals = useMemo(
    () =>
      Object.fromEntries(
        kindOrder.map((kind) => [
          kind,
          holdings
            .filter((item) => item.kind === kind)
            .reduce((sum, item) => sum + holdingValue(item), 0),
        ]),
      ) as Record<AssetKind, number>,
    [holdings],
  );
  const rows =
    mode === "account"
      ? accountOrder.map((group) => ({
          key: group as string,
          label: accountConfig[group].label,
          color: accountConfig[group].color,
          value: totals[group].value,
          onClick: () => onChange(group),
          selected: active === group,
        }))
      : kindOrder.map((kind) => ({
          key: kind as string,
          label: kindConfig[kind].label,
          color: kindConfig[kind].color,
          value: kindTotals[kind],
          onClick: undefined,
          selected: false,
        }));
  const gradient = rows
    .map((row, index) => {
      const percent = allTotals.value
        ? (row.value / allTotals.value) * 100
        : 0;
      const from = rows
        .slice(0, index)
        .reduce(
          (sum, prev) =>
            sum + (allTotals.value ? (prev.value / allTotals.value) * 100 : 0),
          0,
        );
      return `${row.color} ${from}% ${from + percent}%`;
    })
    .join(", ");
  return (
    <section className="breakdown-card" id="fordeling">
      <div className="card-title-row">
        <h2>Fordeling</h2>
        <div className="breakdown-mode" role="tablist" aria-label="Fordeling etter">
          <button
            role="tab"
            aria-selected={mode === "account"}
            className={mode === "account" ? "on" : ""}
            onClick={() => setMode("account")}
          >
            Kontoer
          </button>
          <button
            role="tab"
            aria-selected={mode === "kind"}
            className={mode === "kind" ? "on" : ""}
            onClick={() => setMode("kind")}
          >
            Type
          </button>
        </div>
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
        {rows.map((row) => {
          const percent = allTotals.value
            ? Math.round((row.value / allTotals.value) * 100)
            : 0;
          return (
            <button
              key={row.key}
              className={row.selected ? "active" : ""}
              disabled={!row.onClick}
              onClick={row.onClick}
            >
              <i style={{ background: row.color }} />
              <span>{row.label}</span>
              <em className="row-meter" aria-hidden="true">
                <span
                  style={{ width: `${percent}%`, background: row.color }}
                />
              </em>
              <b>{percent}%</b>
              <small>{money.format(row.value)}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function HoldingRow({
  item,
  advanced,
  onEdit,
  onBuy,
  onAccountChange,
}: {
  item: Holding;
  advanced: boolean;
  onEdit: () => void;
  onBuy: () => void;
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
        <div className="row-actions">
          <button
            className="buy-holding"
            onClick={onBuy}
            aria-label={`Registrer kjøp i ${item.name}`}
            title="Registrer ekstra kjøp"
          >
            <Plus size={14} />
          </button>
          <button
            className="edit-holding"
            onClick={onEdit}
            aria-label={`Rediger ${item.name}`}
            title="Rediger beholdning"
          >
            <Pencil size={14} />
          </button>
        </div>
      ) : (
        <span className="locked-cell" role="img" aria-label="Visningsmodus">
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

function BuyPanel({
  item,
  onClose,
  onBuy,
}: {
  item: Holding;
  onClose: () => void;
  onBuy: (
    purchase: Omit<
      PortfolioEvent,
      "id" | "type" | "holdingId" | "holdingName" | "accountGroup" | "createdAt"
    >,
  ) => void;
}) {
  const [entryMethod, setEntryMethod] = useState<"amount" | "units">("amount");
  const [amount, setAmount] = useState("");
  const [units, setUnits] = useState("");
  const [price, setPrice] = useState(String(item.price));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const purchasePrice = Math.max(0, toNumber(price));
  const purchaseUnits =
    entryMethod === "amount"
      ? purchasePrice
        ? toNumber(amount) / purchasePrice
        : 0
      : Math.max(0, toNumber(units));
  const purchaseAmount =
    entryMethod === "amount"
      ? Math.max(0, toNumber(amount))
      : purchaseUnits * purchasePrice;
  const nextUnits = item.units + purchaseUnits;
  const nextCost = item.cost + purchaseAmount;
  const averageCost = nextUnits ? nextCost / nextUnits : 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!purchasePrice || !purchaseUnits || !purchaseAmount || !date) {
      setError("Fyll inn kjøpssum eller andeler, kurs og kjøpsdato.");
      return;
    }
    onBuy({
      date,
      units: purchaseUnits,
      price: purchasePrice,
      amount: purchaseAmount,
      note: note.trim() || undefined,
    });
  }

  return (
    <div
      className="panel-layer"
      role="dialog"
      aria-modal="true"
      aria-label={`Registrer kjøp i ${item.name}`}
    >
      <button className="panel-scrim" onClick={onClose} aria-label="Lukk" />
      <aside className="panel buy-panel">
        <div className="panel-head">
          <div>
            <span>Ny aktivitet</span>
            <h2>Registrer ekstra kjøp</h2>
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
              {number.format(item.units)} andeler · {money.format(item.cost)}{" "}
              investert
            </small>
          </span>
        </div>
        <form onSubmit={submit}>
          <fieldset className="entry-choice">
            <legend>Hva vil du skrive inn?</legend>
            <button
              type="button"
              className={entryMethod === "amount" ? "selected" : ""}
              onClick={() => setEntryMethod("amount")}
            >
              Kjøpssum
            </button>
            <button
              type="button"
              className={entryMethod === "units" ? "selected" : ""}
              onClick={() => setEntryMethod("units")}
            >
              Antall andeler
            </button>
          </fieldset>
          <div className="two-fields">
            {entryMethod === "amount" ? (
              <label>
                Kjøpssum
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="For eksempel 10 000"
                  autoFocus
                />
              </label>
            ) : (
              <label>
                Antall andeler
                <input
                  inputMode="decimal"
                  value={units}
                  onChange={(event) => setUnits(event.target.value)}
                  placeholder="For eksempel 4,25"
                  autoFocus
                />
              </label>
            )}
            <label>
              Kurs ved kjøp
              <input
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </label>
          </div>
          <div className="two-fields">
            <label>
              Kjøpsdato
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <label>
              Notat <small>valgfritt</small>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="For eksempel månedssparing"
              />
            </label>
          </div>
          {purchaseUnits > 0 && purchaseAmount > 0 ? (
            <div className="purchase-summary">
              <p>
                <span>Kjøp</span>
                <b>{money.format(purchaseAmount)}</b>
                <small>{number.format(purchaseUnits)} nye andeler</small>
              </p>
              <p>
                <span>Ny beholdning</span>
                <b>{number.format(nextUnits)} andeler</b>
                <small>{money.format(nextCost)} totalt investert</small>
              </p>
              <p>
                <span>Ny snittpris</span>
                <b>{money.format(averageCost)}</b>
                <small>per andel</small>
              </p>
            </div>
          ) : null}
          {error ? (
            <p className="form-error">
              <CircleHelp size={15} /> {error}
            </p>
          ) : null}
          <p className="purchase-note">
            <LockKeyhole size={13} /> Kjøpet oppdaterer andeler og inngangsverdi
            og legges i aktivitetsloggen.
          </p>
          <button className="submit" type="submit">
            <ShoppingCart size={16} /> Registrer kjøp
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
        const newPrice = Number(data.price) || item.price;
        // Kilden gir bare siste NAV. Dag-over-dag beregnes derfor mot vår
        // egen forrige kurs når en NYERE NAV-dato kommer inn; samme dato
        // beholder eksisterende grunnlag (nullstill aldri ved re-poll).
        let previousPrice = item.previousPrice;
        let dailyPercent = item.dailyPercent ?? null;
        let changePeriod = item.changePeriod;
        if (data.previousPrice) {
          previousPrice = Number(data.previousPrice);
          dailyPercent = data.changePercent ?? null;
          changePeriod = data.changePeriod;
        } else if (
          item.priceDate &&
          data.priceDate &&
          data.priceDate > item.priceDate &&
          item.price > 0
        ) {
          previousPrice = item.price;
          dailyPercent = ((newPrice - item.price) / item.price) * 100;
          changePeriod = "day";
        }
        return {
          ...item,
          name: data.name ?? item.name,
          price: newPrice,
          previousPrice,
          dailyPercent,
          changePeriod,
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
function compactMoney(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
function formatEventDate(value: string) {
  return shortDate.format(new Date(`${value}T12:00:00.000Z`));
}
function toNumber(value: string) {
  const compact = value.replace(/\s/g, "");
  const withoutThousands = /^\d{1,3}(\.\d{3})+$/.test(compact)
    ? compact.replace(/\./g, "")
    : compact;
  return Number(withoutThousands.replace(",", ".")) || 0;
}
