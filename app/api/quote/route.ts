import { NextRequest, NextResponse } from "next/server";
import { inNavRushWindow } from "@/lib/navwindow";
import { logNavDetection } from "@/lib/navlog";
import { parsePriceDate } from "@/lib/portfolio";

type AssetKind = "stock" | "fund" | "crypto";

const cryptoIds: Record<string, string> = {
  BTC: "bitcoin",
  BITCOIN: "bitcoin",
  ETH: "ethereum",
  ETHEREUM: "ethereum",
  SOL: "solana",
  SOLANA: "solana",
  ADA: "cardano",
  CARDANO: "cardano",
};

const officialFundPages: Record<string, { name: string; url: string }> = {
  NO0010337678: {
    name: "DNB Teknologi A",
    url: "https://www.dnb.no/sparing/fond/fond-liste/d/dnb-teknologi-a-NO0010337678",
  },
  LU2075955943: {
    name: "DNB Fund – Disruptive Opportunities Retail A (N) NOK",
    url: "https://www.dnb.no/sparing/fond/fond-liste/d/dnb-fund-disruptive-opportunities-n-nok-acc-LU2075955943",
  },
};

/** Yahoo/Morningstar-NAV for fond (ISIN → 0P-symbol), i NOK. Returnerer
 *  null når fondet ikke finnes der — kaller avgjør fallback. */
async function yahooFundQuote(symbol: string) {
  try {
    let yahooSymbol = symbol;
    if (!symbol.startsWith("0P")) {
      const searchResponse = await fetch(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=3&newsCount=0`,
        { headers: { "User-Agent": "MinSparing/1.0" }, next: { revalidate: 604800 } },
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
      { headers: { "User-Agent": "MinSparing/1.0" }, next: { revalidate: 1800 } },
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
        { headers: { "User-Agent": "MinSparing/1.0" }, next: { revalidate: 1800 } },
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
      changePeriod: "day" as const,
      currency: "NOK",
      nativeCurrency: fundCurrency,
      source:
        fundCurrency === "NOK"
          ? "Yahoo · NAV"
          : `Yahoo · NAV (omregnet fra ${fundCurrency})`,
      priceDate: osloDate(stamp),
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

type FundCandidate = {
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

/** Nyeste NAV-dato vinner; ved lik dato vinner lavest rank (offisiell kilde
 *  først). previousPrice hentes fra beste kandidat med strengt eldre dato,
 *  slik at dagsendringen alltid regnes mot forrige faktiske NAV. */
function pickFreshestFund(candidates: (FundCandidate | null)[]) {
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
    // Identisk verdi på eldre dato = kildens dato-etikett henger etter
    // (samme NAV, feil merket) — aldri en ekte flat dag. Hopp over slike.
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

async function nordnetFundQuote(
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
    const unit = (
      data?.tradables as { price_unit?: string }[] | undefined
    )?.[0]?.price_unit;
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

/** Neste bankdag etter en ISO-dato (hopper over helg). */
function nextBusinessDay(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  do {
    date.setUTCDate(date.getUTCDate() + 1);
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return date.toISOString().slice(0, 10);
}

function parseNorwegianNumber(value: string) {
  return Number(value.replace(/[^\d,.-]/g, "").replace(",", "."));
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams
    .get("symbol")
    ?.trim()
    .toUpperCase();
  const kind = request.nextUrl.searchParams.get("kind") as AssetKind | null;
  if (!symbol || !kind || !["stock", "fund", "crypto"].includes(kind)) {
    return NextResponse.json(
      { error: "Mangler gyldig type eller symbol." },
      { status: 400 },
    );
  }

  try {
    if (kind === "crypto") {
      const id = cryptoIds[symbol] ?? symbol.toLowerCase();
      const key = process.env.COINGECKO_API_KEY;
      const base = key
        ? "https://api.coingecko.com/api/v3"
        : "https://api.coingecko.com/api/v3";
      const response = await fetch(
        `${base}/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=nok&include_24hr_change=true&include_last_updated_at=true`,
        {
          headers: key ? { "x-cg-demo-api-key": key } : {},
          next: { revalidate: 120 },
        },
      );
      if (!response.ok) throw new Error("Kunne ikke hente kryptokurs.");
      let data = await response.json();
      let resolvedId = id;
      if (!data[id]?.nok) {
        // Ukjent symbol → slå opp id-en hos CoinGecko og prøv igjen.
        const searchResponse = await fetch(
          `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`,
          { headers: key ? { "x-cg-demo-api-key": key } : {}, next: { revalidate: 86400 } },
        );
        const found = searchResponse.ok
          ? ((await searchResponse.json()).coins ?? []).find(
              (coin: { symbol?: string; id?: string }) =>
                String(coin.symbol ?? "").toUpperCase() === symbol,
            )
          : null;
        if (found?.id) {
          resolvedId = found.id;
          const retry = await fetch(
            `${base}/simple/price?ids=${encodeURIComponent(resolvedId)}&vs_currencies=nok&include_24hr_change=true&include_last_updated_at=true`,
            { headers: key ? { "x-cg-demo-api-key": key } : {}, next: { revalidate: 120 } },
          );
          if (retry.ok) data = await retry.json();
        }
      }
      if (!data[resolvedId]?.nok) throw new Error("Fant ikke kryptovalutaen.");
      return NextResponse.json({
        symbol,
        price: data[resolvedId].nok,
        changePercent: data[resolvedId].nok_24h_change ?? 0,
        changePeriod: "24h",
        currency: "NOK",
        source: "CoinGecko · siste 24 timer",
        updatedAt: data[resolvedId].last_updated_at
          ? new Date(data[resolvedId].last_updated_at * 1000).toISOString()
          : new Date().toISOString(),
        priceDate: osloDate(
          data[resolvedId].last_updated_at
            ? new Date(data[resolvedId].last_updated_at * 1000)
            : new Date(),
        ),
      });
    }

    const officialFundPage =
      kind === "fund" ? officialFundPages[symbol] : undefined;
    if (officialFundPage) {
      const response = await fetch(officialFundPage.url, {
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
      if (response.ok && price > 0) {
        const dnbQuote = {
          symbol,
          name: officialFundPage.name,
          price,
          changePercent: null,
          currency: "NOK",
          source: "DNB · offisiell NAV",
          asOf: navMatch?.[2],
          priceDate: parsePriceDate(navMatch?.[2]),
          updatedAt: new Date().toISOString(),
        };
        // Tre kilder: DNB-siden (tidlig verdi, sløv dato-etikett — verdi-
        // avvik mot Yahoo betyr neste bankdags NAV), Nordnet (eksplisitt
        // datert, ofte først) og Yahoo/Morningstar (korrekt datert, T+2).
        const [yahoo, nordnet] = await Promise.all([
          yahooFundQuote(symbol),
          nordnetFundQuote(symbol),
        ]);
        let dnbEffective: FundCandidate = { ...dnbQuote, rank: 0 };
        if (yahoo?.priceDate && yahoo.price > 0) {
          const relativeDiff =
            Math.abs(dnbQuote.price - yahoo.price) / yahoo.price;
          const labelBehind =
            !dnbQuote.priceDate || dnbQuote.priceDate <= yahoo.priceDate;
          if (relativeDiff > 0.0005 && labelBehind) {
            const inferredDate = nextBusinessDay(yahoo.priceDate);
            dnbEffective = {
              ...dnbEffective,
              priceDate: inferredDate,
              asOf: inferredDate,
            };
          }
        }
        const winner = pickFreshestFund([
          dnbEffective,
          nordnet,
          yahoo ? { ...yahoo, rank: 2 } : null,
        ]);
        if (winner.priceDate) {
          await logNavDetection(symbol, winner.priceDate);
        }
        return NextResponse.json(winner);
      }
    }

    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (apiKey) {
      const response = await fetch(
        `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`,
        { next: { revalidate: kind === "fund" ? 3600 : 60 } },
      );
      const data = await response.json();
      if (response.ok && data.status !== "error" && data.close) {
        return NextResponse.json({
          symbol: data.symbol ?? symbol,
          name: data.name,
          price: Number(data.close),
          previousPrice: Number(data.previous_close) || undefined,
          changePercent: Number(data.percent_change ?? 0),
          changePeriod: "day",
          currency: data.currency ?? "NOK",
          source: "Twelve Data",
          updatedAt: data.datetime
            ? new Date(data.datetime).toISOString()
            : new Date().toISOString(),
          priceDate: parsePriceDate(data.datetime) ?? osloDate(),
        });
      }
    }

    if (kind === "fund") {
      // Nordnet (eksplisitt datert, ofte først) + Yahoo (ISIN → 0P…-symbol).
      const [yahoo, nordnet] = await Promise.all([
        yahooFundQuote(symbol),
        nordnetFundQuote(symbol),
      ]);
      if (yahoo || nordnet) {
        return NextResponse.json(
          pickFreshestFund([nordnet, yahoo ? { ...yahoo, rank: 2 } : null]),
        );
      }
      return NextResponse.json(
        {
          error:
            "Automatisk fondskurs er ikke tilgjengelig for dette fondet ennå. Velg manuell og skriv inn siste NAV.",
        },
        { status: 503 },
      );
    }

    const chartResponse = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      {
        headers: { "User-Agent": "MinSparing/1.0" },
        next: { revalidate: 60 },
      },
    );
    const chart = await chartResponse.json();
    const result = chart?.chart?.result?.[0];
    if (!chartResponse.ok || !result?.meta?.regularMarketPrice)
      throw new Error("Fant ikke aksjekursen.");
    const originalCurrency = result.meta.currency ?? "NOK";
    let nokRate = 1;
    let previousNokRate = 1;
    if (originalCurrency !== "NOK") {
      const fxResponse = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(`${originalCurrency}NOK=X`)}?interval=1d&range=5d`,
        {
          headers: { "User-Agent": "MinSparing/1.0" },
          next: { revalidate: 300 },
        },
      );
      const fx = await fxResponse.json();
      const fxMeta = fx?.chart?.result?.[0]?.meta;
      nokRate = Number(fxMeta?.regularMarketPrice ?? 1);
      previousNokRate = Number(
        fxMeta?.chartPreviousClose ?? fxMeta?.previousClose ?? nokRate,
      );
    }
    const current = Number(result.meta.regularMarketPrice);
    const previous = Number(
      result.meta.chartPreviousClose ?? result.meta.previousClose ?? current,
    );
    const currentNok = current * nokRate;
    const previousNok = previous * previousNokRate;
    const timestamp = new Date(
      (result.meta.regularMarketTime ?? Date.now() / 1000) * 1000,
    );
    return NextResponse.json({
      symbol,
      name: result.meta.longName ?? result.meta.shortName,
      price: currentNok,
      previousPrice: previousNok,
      nativePrice: current,
      changePercent: previousNok
        ? ((currentNok - previousNok) / previousNok) * 100
        : 0,
      changePeriod: "day",
      currency: "NOK",
      nativeCurrency: originalCurrency,
      source: "Markedsdata",
      updatedAt: timestamp.toISOString(),
      priceDate: osloDate(timestamp),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukjent feil." },
      { status: 502 },
    );
  }
}

function osloDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${date.year}-${date.month}-${date.day}`;
}
