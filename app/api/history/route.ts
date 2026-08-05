import { NextRequest, NextResponse } from "next/server";

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

export type HistoryPointDto = { date: string; price: number };

/** Ett år med daglige sluttkurser for ett instrument, i NOK der kilden
 *  leverer det. Fond: Fondsportalens NAV-historikk (ISIN). */
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
    if (kind === "fund") {
      // Primær: Yahoo indekserer norske fond (ISIN-søk → 0P…-symbol) med
      // ett års daglige NAV-er i NOK. Fallback: Fondsportalens NAV-arkiv.
      try {
        const search = await fetch(
          `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=3&newsCount=0`,
          {
            headers: { "User-Agent": "MinSparing/1.0" },
            next: { revalidate: 604800 },
          },
        );
        if (search.ok) {
          const found = ((await search.json()).quotes ?? []).find(
            (q: { quoteType?: string; symbol?: string }) =>
              Boolean(q.symbol) &&
              (q.quoteType === "MUTUALFUND" ||
                /^[A-Z]{2}[A-Z0-9]{10}$/.test(symbol)),
          );
          if (found) {
            const chartResponse = await fetch(
              `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(found.symbol)}?interval=1d&range=1y`,
              {
                headers: { "User-Agent": "MinSparing/1.0" },
                next: { revalidate: 21600 },
              },
            );
            const chart = await chartResponse.json();
            const result = chart?.chart?.result?.[0];
            if (
              chartResponse.ok &&
              result &&
              (result.meta?.currency ?? "NOK") === "NOK"
            ) {
              const stamps: number[] = result.timestamp ?? [];
              const closes: (number | null)[] =
                result.indicators?.quote?.[0]?.close ?? [];
              const points: HistoryPointDto[] = stamps
                .map((ts, index) => ({
                  date: new Date(ts * 1000).toISOString().slice(0, 10),
                  price: closes[index] ?? NaN,
                }))
                .filter((p) => Number.isFinite(p.price) && p.price > 0);
              const last = points[points.length - 1];
              if (
                points.length > 30 &&
                last &&
                Date.now() - Date.parse(`${last.date}T00:00:00Z`) <
                  30 * 86_400_000
              ) {
                return NextResponse.json({
                  symbol,
                  currency: "NOK",
                  source: "Yahoo · NAV-historikk",
                  points,
                });
              }
            }
          }
        }
      } catch {
        // Yahoo nede → prøv fallback under.
      }
      const response = await fetch(
        `https://fondsportalen.no/api/funds/${encodeURIComponent(symbol)}/nav-history?period=1y`,
        { next: { revalidate: 21600 } },
      );
      if (!response.ok) {
        return NextResponse.json(
          { error: "Ingen NAV-historikk for dette fondet." },
          { status: 404 },
        );
      }
      const json = await response.json();
      const points: HistoryPointDto[] = Array.isArray(json.data)
        ? json.data
            .filter(
              (row: { time?: string; value?: number }) =>
                typeof row.time === "string" &&
                Number.isFinite(row.value) &&
                (row.value ?? 0) > 0,
            )
            .map((row: { time: string; value: number }) => ({
              date: row.time,
              price: row.value,
            }))
        : [];
      if (points.length < 2) {
        return NextResponse.json(
          { error: "For lite NAV-historikk." },
          { status: 404 },
        );
      }
      // Ferskhets-port: en kilde som har sluttet å synke skal ikke gi
      // rekonstruksjon som later som den er aktuell. (Fondsportalens
      // NAV-sync verifisert død per 2026-01-29 — gjenåpnes automatisk
      // når syncen repareres.)
      const lastDate = points[points.length - 1].date;
      if (Date.now() - Date.parse(`${lastDate}T00:00:00Z`) > 30 * 86_400_000) {
        return NextResponse.json(
          { error: `NAV-historikken er utdatert (siste: ${lastDate}).` },
          { status: 404 },
        );
      }
      return NextResponse.json({
        symbol,
        currency: "NOK",
        source: "Fondsportalen · offisiell NAV",
        points,
      });
    }

    if (kind === "crypto") {
      const id = cryptoIds[symbol] ?? symbol.toLowerCase();
      const key = process.env.COINGECKO_API_KEY;
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=nok&days=365&interval=daily`,
        {
          headers: key ? { "x-cg-demo-api-key": key } : {},
          next: { revalidate: 21600 },
        },
      );
      if (!response.ok) throw new Error("Kunne ikke hente kryptohistorikk.");
      const json = await response.json();
      const points: HistoryPointDto[] = Array.isArray(json.prices)
        ? json.prices.map(([ts, price]: [number, number]) => ({
            date: new Date(ts).toISOString().slice(0, 10),
            price,
          }))
        : [];
      const byDate = new Map(points.map((p) => [p.date, p]));
      return NextResponse.json({
        symbol,
        currency: "NOK",
        source: "CoinGecko",
        points: [...byDate.values()],
      });
    }

    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`,
      {
        headers: { "User-Agent": "MinSparing/1.0" },
        next: { revalidate: 21600 },
      },
    );
    const chart = await response.json();
    const result = chart?.chart?.result?.[0];
    const closes: (number | null)[] =
      result?.indicators?.quote?.[0]?.close ?? [];
    const stamps: number[] = result?.timestamp ?? [];
    if (!response.ok || !result || stamps.length === 0) {
      throw new Error("Fant ikke kurshistorikk.");
    }
    if ((result.meta?.currency ?? "NOK") !== "NOK") {
      // Uten FX-historikk blir en rekonstruksjon i NOK feil — hopp over.
      return NextResponse.json(
        { error: "Historikk i utenlandsk valuta støttes ikke ennå." },
        { status: 404 },
      );
    }
    const points: HistoryPointDto[] = stamps
      .map((ts, index) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        price: closes[index] ?? NaN,
      }))
      .filter((p) => Number.isFinite(p.price) && p.price > 0);
    return NextResponse.json({
      symbol,
      currency: "NOK",
      source: "Markedsdata",
      points,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukjent feil." },
      { status: 502 },
    );
  }
}
