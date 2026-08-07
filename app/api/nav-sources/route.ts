import { NextRequest, NextResponse } from "next/server";
import { resolveFundQuote } from "@/lib/navsources";

export const runtime = "nodejs";

/** Diagnose: alle kilders syn på ett fonds NAV (pris + dato per kilde) og
 *  hvilken som serveres. Offentlige fondsdata — ingen brukerinformasjon. */
export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: "Mangler symbol." }, { status: 400 });
  }
  const { winner, sources } = await resolveFundQuote(symbol);
  const compact = (item: { price: number; priceDate?: string; source: string } | null) =>
    item ? { price: item.price, priceDate: item.priceDate ?? null, source: item.source } : null;
  return NextResponse.json(
    {
      symbol,
      serving: winner ? { price: winner.price, priceDate: winner.priceDate ?? null, source: winner.source } : null,
      sources: {
        dnb: compact(sources.dnb),
        nordnet: compact(sources.nordnet),
        morningstar: compact(sources.morningstar),
      },
    },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=300" } },
  );
}
