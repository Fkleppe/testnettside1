import { NextRequest, NextResponse } from "next/server";
import { searchInstruments, type Instrument } from "@/lib/catalog";

type AssetKind = "stock" | "fund" | "crypto";

/** Livesøk på tvers av hele universet: lokal katalog (norske fond) +
 *  Yahoo (aksjer/ETF/fond globalt) + CoinGecko (all krypto). */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const kind = request.nextUrl.searchParams.get("kind") as AssetKind | null;
  if (!kind || !["stock", "fund", "crypto"].includes(kind)) {
    return NextResponse.json({ error: "Ugyldig type." }, { status: 400 });
  }
  const local = searchInstruments(kind, q);
  if (q.length < 2) {
    return NextResponse.json({ results: local.slice(0, 12) });
  }
  const results: Instrument[] = [...local];
  try {
    if (kind === "crypto") {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`,
        { next: { revalidate: 3600 } },
      );
      if (response.ok) {
        const json = await response.json();
        for (const coin of (json.coins ?? []).slice(0, 8)) {
          results.push({
            name: coin.name,
            symbol: String(coin.symbol ?? "").toUpperCase(),
            quoteSymbol: coin.id,
            kind: "crypto",
            market: coin.market_cap_rank
              ? `Krypto · #${coin.market_cap_rank}`
              : "Krypto",
            tags: [],
          });
        }
      }
    } else {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`,
        {
          headers: { "User-Agent": "MinSparing/1.0" },
          next: { revalidate: 3600 },
        },
      );
      if (response.ok) {
        const json = await response.json();
        const wanted =
          kind === "fund" ? ["MUTUALFUND"] : ["EQUITY", "ETF"];
        for (const quote of (json.quotes ?? []).filter(
          (item: { quoteType?: string }) =>
            wanted.includes(item.quoteType ?? ""),
        )) {
          results.push({
            name: quote.longname ?? quote.shortname ?? quote.symbol,
            symbol: quote.symbol,
            kind,
            market:
              quote.exchDisp ??
              (kind === "fund" ? "Fond" : "Aksje"),
            tags: [],
          });
        }
      }
    }
  } catch {
    // Eksterne kilder nede → lokale treff er bedre enn ingenting.
  }
  const seen = new Set<string>();
  const merged = results.filter((item) => {
    const key = `${item.symbol}`.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return NextResponse.json({ results: merged.slice(0, 12) });
}
