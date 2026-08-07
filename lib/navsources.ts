import { inNavRushWindow } from "./navwindow";
import { parsePriceDate } from "./portfolio";

/** Multikilde-system for fonds-NAV: DNB-siden (tidlig verdi, sløv
 *  dato-etikett), Nordnet (eksplisitt datert, ofte først) og
 *  Yahoo (= Morningstars feed, korrekt datert, typisk T+2).
 *  Nyeste NAV-dato vinner; ved likhet vinner mest offisielle kilde. */

export type FundCandidate = {
  symbol: string;
  name?: string;
  price: number;
  previousPrice?: number;
  changePercent?: number | null;
  changePeriod?: "day";
  currency: string;
  nativeCurrency?: string;
  source: string;
  asOf?: string;
  priceDate?: string;
  updatedAt: string;
  rank: number;
};

export const officialFundPages: Record<string, { name: string; url: string }> =
  {
    NO0010337678: {
      name: "DNB Teknologi A",
      url: "https://www.dnb.no/sparing/fond/fond-liste/d/dnb-teknologi-a-NO0010337678",
    },
    LU2075955943: {
      name: "DNB Fund – Disruptive Opportunities Retail A (N) NOK",
      url: "https://www.dnb.no/sparing/fond/fond-liste/d/dnb-fund-disruptive-opportunities-n-nok-acc-LU2075955943",
    },
  };

function parseNorwegianNumber(value: string) {
  return Number(value.replace(/\s/g, "").replace(",", ".")) || 0;
}

function osloDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
  return parts;
}

/** Neste bankdag etter en ISO-dato (hopper over helg). */
export function nextBusinessDay(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  do {
    date.setUTCDate(date.getUTCDate() + 1);
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return date.toISOString().slice(0, 10);
}

/** DNBs egen fondsside — kun for fond vi har kartlagt URL for. */
export async function dnbFundQuote(
  symbol: string,
): Promise<FundCandidate | null> {
  const page = officialFundPages[symbol];
  if (!page) return null;
  try {
    const response = await fetch(page.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/138.0 Safari/537.36",
        "Accept-Language": "nb-NO,nb;q=0.9,en;q=0.7",
      },
      next: { revalidate: inNavRushWindow() ? 60 : 300 },
    });
    const html = await response.text();
    const navMatch = html.match(
      /data-testid="fund-properties-nav-price"[\s\S]{0,4000}?dnb-number-format__visible"[^>]*>([^<]+)<\/span>[\s\S]{0,1200}?FundProperties_fundInfoText[^>]*>([^<]+)<\/span>/,
    );
    const price = navMatch ? parseNorwegianNumber(navMatch[1]) : 0;
    if (!response.ok || !(price > 0)) return null;
    return {
      symbol,
      name: page.name,
      price,
      changePercent: null,
      currency: "NOK",
      source: "DNB · offisiell NAV",
      asOf: navMatch?.[2],
      priceDate: parsePriceDate(navMatch?.[2]),
      updatedAt: new Date().toISOString(),
      rank: 0,
    };
  } catch {
    return null;
  }
}

/** Yahoo relayer Morningstars fondsdata (ISIN → 0P-symbol), i NOK. */
export async function yahooFundQuote(
  symbol: string,
): Promise<FundCandidate | null> {
  try {
    let yahooSymbol = symbol;
    if (!symbol.startsWith("0P")) {
      const searchResponse = await fetch(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=3&newsCount=0`,
        {
          headers: { "User-Agent": "MinSparing/1.0" },
          next: { revalidate: 604800 },
        },
      );
      const found = searchResponse.ok
        ? ((await searchResponse.json()).quotes ?? []).find(
            (item: { quoteType?: string; symbol?: string }) =>
              Boolean(item.symbol) &&
              (item.quoteType === "MUTUALFUND" ||
                /^[A-Z]{2}[A-Z0-9]{10}$/.test(symbol)),
          )
        : null;
      if (!found) return null;
      yahooSymbol = found.symbol;
    }
    const chartResponse = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=5d`,
      {
        headers: { "User-Agent": "MinSparing/1.0" },
        next: { revalidate: 1800 },
      },
    );
    const chart = await chartResponse.json();
    const result = chart?.chart?.result?.[0];
    const priceValue = Number(result?.meta?.regularMarketPrice);
    if (!chartResponse.ok || !result || !(priceValue > 0)) return null;
    const fundCurrency = result.meta?.currency ?? "NOK";
    let rate = 1;
    let previousRate = 1;
    if (fundCurrency !== "NOK") {
      const fxResponse = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(`${fundCurrency}NOK=X`)}?interval=1d&range=5d`,
        {
          headers: { "User-Agent": "MinSparing/1.0" },
          next: { revalidate: 1800 },
        },
      );
      const fxMeta = (await fxResponse.json())?.chart?.result?.[0]?.meta;
      rate = Number(fxMeta?.regularMarketPrice ?? 0);
      previousRate = Number(
        fxMeta?.chartPreviousClose ?? fxMeta?.previousClose ?? rate,
      );
      if (!(rate > 0)) return null;
    }
    const previous = Number(
      result.meta?.chartPreviousClose ?? result.meta?.previousClose,
    );
    const stamp = new Date(
      (result.meta?.regularMarketTime ?? Date.now() / 1000) * 1000,
    );
    const priceNok = priceValue * rate;
    const previousNok = previous > 0 ? previous * previousRate : undefined;
    return {
      symbol,
      name: result.meta?.longName ?? result.meta?.shortName,
      price: priceNok,
      previousPrice: previousNok,
      changePercent:
        previousNok && previousNok > 0
          ? ((priceNok - previousNok) / previousNok) * 100
          : null,
      changePeriod: "day",
      currency: "NOK",
      nativeCurrency: fundCurrency,
      source:
        fundCurrency === "NOK"
          ? "Morningstar via Yahoo · NAV"
          : `Morningstar via Yahoo · NAV (omregnet fra ${fundCurrency})`,
      priceDate: osloDate(stamp),
      updatedAt: new Date().toISOString(),
      rank: 2,
    };
  } catch {
    return null;
  }
}

/** Nordnets åpne fondsdata fører NAV med EKSPLISITT dato og ligger ofte
 *  foran både DNB-siden og Morningstar. Krever anonym sesjonscookie fra
 *  forsiden — caches i minnet og fornyes ved 401. */
let nordnetSessionCache: { header: string; fetchedAt: number } | null = null;
const nordnetIdCache = new Map<string, number>();

async function nordnetSession(force = false): Promise<string | null> {
  if (
    !force &&
    nordnetSessionCache &&
    Date.now() - nordnetSessionCache.fetchedAt < 25 * 60 * 1000
  ) {
    return nordnetSessionCache.header;
  }
  try {
    const response = await fetch("https://www.nordnet.no/market/funds", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/138.0 Safari/537.36",
        Accept: "text/html",
      },
      cache: "no-store",
    });
    const cookies = response.headers.getSetCookie?.() ?? [];
    if (cookies.length === 0) return null;
    nordnetSessionCache = {
      header: cookies.map((cookie) => cookie.split(";")[0]).join("; "),
      fetchedAt: Date.now(),
    };
    return nordnetSessionCache.header;
  } catch {
    return null;
  }
}

export async function nordnetFundQuote(
  symbol: string,
  retried = false,
): Promise<FundCandidate | null> {
  try {
    const cookie = await nordnetSession(retried);
    if (!cookie) return null;
    const headers = {
      "User-Agent": "MinSparing/1.0",
      Accept: "application/json",
      Cookie: cookie,
      "client-id": "NEXT",
    };
    let instrumentId = nordnetIdCache.get(symbol);
    if (!instrumentId) {
      const search = await fetch(
        `https://www.nordnet.no/api/2/main_search?query=${encodeURIComponent(symbol)}&search_space=ALL&limit=3`,
        { headers, next: { revalidate: 604800 } },
      );
      if (search.status === 401 && !retried) {
        return nordnetFundQuote(symbol, true);
      }
      if (!search.ok) return null;
      const groups = (await search.json()) as {
        results?: { instrument_id?: number; instrument_group_type?: string }[];
      }[];
      const hit = (Array.isArray(groups) ? groups : [])
        .flatMap((group) => group.results ?? [])
        .find((item) => item.instrument_group_type === "FND");
      if (!hit?.instrument_id) return null;
      instrumentId = hit.instrument_id;
      nordnetIdCache.set(symbol, instrumentId);
    }
    const response = await fetch(
      `https://www.nordnet.no/api/2/instruments/${instrumentId}`,
      { headers, next: { revalidate: inNavRushWindow() ? 60 : 300 } },
    );
    if (response.status === 401 && !retried) {
      return nordnetFundQuote(symbol, true);
    }
    if (!response.ok) return null;
    const data = ((await response.json()) as Record<string, unknown>[])?.[0];
    const price = Number(data?.last_nav);
    const priceDate =
      typeof data?.last_nav_date === "string" ? data.last_nav_date : undefined;
    const unit = (data?.tradables as { price_unit?: string }[] | undefined)?.[0]
      ?.price_unit;
    if (!(price > 0) || !priceDate || (unit && unit !== "NOK")) return null;
    return {
      symbol,
      name:
        typeof data?.display_name === "string" ? data.display_name : undefined,
      price,
      changePercent: null,
      currency: "NOK",
      source: "Nordnet · NAV",
      asOf: priceDate,
      priceDate,
      updatedAt: new Date().toISOString(),
      rank: 1,
    };
  } catch {
    return null;
  }
}

/** Nyeste NAV-dato vinner; ved lik dato vinner lavest rank (offisiell kilde
 *  først). previousPrice hentes fra beste kandidat med strengt eldre dato
 *  OG reelt prisavvik — identisk verdi på eldre dato er kildens
 *  dato-etikett som henger etter (samme NAV, feil merket), aldri en ekte
 *  flat dag. */
export function pickFreshestFund(candidates: (FundCandidate | null)[]) {
  const valid = candidates.filter(
    (item): item is FundCandidate => item !== null && item.price > 0,
  );
  valid.sort((a, b) => {
    const dateA = a.priceDate ?? "";
    const dateB = b.priceDate ?? "";
    if (dateA !== dateB) return dateA < dateB ? 1 : -1;
    return a.rank - b.rank;
  });
  const winner = { ...valid[0] };
  if (winner.priceDate) {
    const previous = valid.find(
      (item) =>
        item.priceDate &&
        item.priceDate < (winner.priceDate as string) &&
        Math.abs(item.price - winner.price) / winner.price > 0.00005,
    );
    if (previous) {
      winner.previousPrice = previous.price;
      winner.changePercent =
        ((winner.price - previous.price) / previous.price) * 100;
      winner.changePeriod = "day";
    }
  }
  const { rank: _rank, ...payload } = winner;
  return payload;
}

export type FundSourcesResult = {
  winner: Omit<FundCandidate, "rank"> | null;
  sources: {
    dnb: FundCandidate | null;
    nordnet: FundCandidate | null;
    morningstar: FundCandidate | null;
  };
};

/** Hele multikilde-flyten for ett fond: hent alle tre parallelt, utled
 *  DNBs reelle dato ved verdi-avvik (etiketten henger), kår vinneren. */
export async function resolveFundQuote(
  symbol: string,
): Promise<FundSourcesResult> {
  const [dnb, yahoo, nordnet] = await Promise.all([
    dnbFundQuote(symbol),
    yahooFundQuote(symbol),
    nordnetFundQuote(symbol),
  ]);
  let dnbEffective = dnb;
  if (dnb && yahoo?.priceDate && yahoo.price > 0) {
    const relativeDiff = Math.abs(dnb.price - yahoo.price) / yahoo.price;
    const labelBehind = !dnb.priceDate || dnb.priceDate <= yahoo.priceDate;
    if (relativeDiff > 0.0005 && labelBehind) {
      const inferredDate = nextBusinessDay(yahoo.priceDate);
      dnbEffective = { ...dnb, priceDate: inferredDate, asOf: inferredDate };
    }
  }
  const winner =
    dnbEffective || nordnet || yahoo
      ? pickFreshestFund([dnbEffective, nordnet, yahoo])
      : null;
  return { winner, sources: { dnb: dnbEffective, nordnet, morningstar: yahoo } };
}
