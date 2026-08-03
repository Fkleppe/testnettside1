import { NextRequest, NextResponse } from "next/server";

type AssetKind = "stock" | "fund" | "crypto";

const cryptoIds: Record<string, string> = {
  BTC: "bitcoin", BITCOIN: "bitcoin", ETH: "ethereum", ETHEREUM: "ethereum",
  SOL: "solana", SOLANA: "solana", ADA: "cardano", CARDANO: "cardano",
};

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();
  const kind = request.nextUrl.searchParams.get("kind") as AssetKind | null;
  if (!symbol || !kind || !["stock", "fund", "crypto"].includes(kind)) {
    return NextResponse.json({ error: "Mangler gyldig type eller symbol." }, { status: 400 });
  }

  try {
    if (kind === "crypto") {
      const id = cryptoIds[symbol] ?? symbol.toLowerCase();
      const key = process.env.COINGECKO_API_KEY;
      const base = key ? "https://api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3";
      const response = await fetch(`${base}/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=nok&include_24hr_change=true&include_last_updated_at=true`, {
        headers: key ? { "x-cg-demo-api-key": key } : {}, next: { revalidate: 30 },
      });
      if (!response.ok) throw new Error("Kunne ikke hente kryptokurs.");
      const data = await response.json();
      if (!data[id]?.nok) throw new Error("Fant ikke kryptovalutaen.");
      return NextResponse.json({
        symbol, price: data[id].nok, changePercent: data[id].nok_24h_change ?? 0,
        currency: "NOK", source: "CoinGecko", updatedAt: data[id].last_updated_at ? new Date(data[id].last_updated_at * 1000).toISOString() : new Date().toISOString(),
      });
    }

    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (apiKey) {
      const response = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`, { next: { revalidate: kind === "fund" ? 3600 : 60 } });
      const data = await response.json();
      if (response.ok && data.status !== "error" && data.close) {
        return NextResponse.json({
          symbol: data.symbol ?? symbol, name: data.name, price: Number(data.close),
          changePercent: Number(data.percent_change ?? 0), currency: data.currency ?? "NOK",
          source: "Twelve Data", updatedAt: data.datetime ? new Date(data.datetime).toISOString() : new Date().toISOString(),
        });
      }
    }

    if (kind === "fund") {
      return NextResponse.json({ error: "Automatisk fondskurs er ikke tilgjengelig for dette fondet ennå. Velg manuell og skriv inn siste NAV." }, { status: 503 });
    }

    const chartResponse = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`, {
      headers: { "User-Agent": "MinSparing/1.0" }, next: { revalidate: 60 },
    });
    const chart = await chartResponse.json();
    const result = chart?.chart?.result?.[0];
    if (!chartResponse.ok || !result?.meta?.regularMarketPrice) throw new Error("Fant ikke aksjekursen.");
    const originalCurrency = result.meta.currency ?? "NOK";
    let nokRate = 1;
    if (originalCurrency !== "NOK") {
      const fxResponse = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(`${originalCurrency}NOK=X`)}?interval=1d&range=5d`, {
        headers: { "User-Agent": "MinSparing/1.0" }, next: { revalidate: 300 },
      });
      const fx = await fxResponse.json();
      nokRate = Number(fx?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 1);
    }
    const current = Number(result.meta.regularMarketPrice);
    const previous = Number(result.meta.chartPreviousClose ?? result.meta.previousClose ?? current);
    return NextResponse.json({
      symbol, name: result.meta.longName ?? result.meta.shortName, price: current * nokRate,
      nativePrice: current, changePercent: previous ? ((current - previous) / previous) * 100 : 0,
      currency: "NOK", nativeCurrency: originalCurrency, source: "Markedsdata", updatedAt: new Date((result.meta.regularMarketTime ?? Date.now() / 1000) * 1000).toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ukjent feil." }, { status: 502 });
  }
}
