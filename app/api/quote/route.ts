import { NextRequest, NextResponse } from "next/server";
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
          next: { revalidate: 30 },
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
            { headers: key ? { "x-cg-demo-api-key": key } : {}, next: { revalidate: 30 } },
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
        next: { revalidate: 300 },
      });
      const html = await response.text();
      const navMatch = html.match(
        /data-testid="fund-properties-nav-price"[\s\S]{0,4000}?dnb-number-format__visible"[^>]*>([^<]+)<\/span>[\s\S]{0,1200}?FundProperties_fundInfoText[^>]*>([^<]+)<\/span>/,
      );
      const price = navMatch ? parseNorwegianNumber(navMatch[1]) : 0;
      if (response.ok && price > 0) {
        return NextResponse.json({
          symbol,
          name: officialFundPage.name,
          price,
          changePercent: null,
          currency: "NOK",
          source: "DNB · offisiell NAV",
          asOf: navMatch?.[2],
          priceDate: parsePriceDate(navMatch?.[2]),
          updatedAt: new Date().toISOString(),
        });
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
      // Yahoo dekker de fleste norske/europeiske fond (ISIN → 0P…-symbol).
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
          if (found) yahooSymbol = found.symbol;
        }
        const chartResponse = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=5d`,
          { headers: { "User-Agent": "MinSparing/1.0" }, next: { revalidate: 1800 } },
        );
        const chart = await chartResponse.json();
        const result = chart?.chart?.result?.[0];
        const priceValue = Number(result?.meta?.regularMarketPrice);
        if (
          chartResponse.ok &&
          result &&
          priceValue > 0 &&
          (result.meta?.currency ?? "NOK") === "NOK"
        ) {
          const previous = Number(
            result.meta?.chartPreviousClose ?? result.meta?.previousClose,
          );
          const stamp = new Date(
            (result.meta?.regularMarketTime ?? Date.now() / 1000) * 1000,
          );
          return NextResponse.json({
            symbol,
            name: result.meta?.longName ?? result.meta?.shortName,
            price: priceValue,
            previousPrice: previous > 0 ? previous : undefined,
            changePercent:
              previous > 0 ? ((priceValue - previous) / previous) * 100 : null,
            changePeriod: "day",
            currency: "NOK",
            source: "Yahoo · NAV",
            priceDate: osloDate(stamp),
            updatedAt: new Date().toISOString(),
          });
        }
      } catch {
        // Faller videre til manuell-melding.
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
