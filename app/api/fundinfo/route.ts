import { NextRequest, NextResponse } from "next/server";

/** Fondsfakta (løpende kostnad m.m.) per ISIN, proxet fra Fondsportalen
 *  med døgncache — brukes til «hva betaler jeg»-kortet. */
export async function GET(request: NextRequest) {
  const isin = request.nextUrl.searchParams.get("isin")?.trim().toUpperCase();
  if (!isin || !/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)) {
    return NextResponse.json({ error: "Ugyldig ISIN." }, { status: 400 });
  }
  try {
    const response = await fetch(
      `https://fondsportalen.no/api/funds/${encodeURIComponent(isin)}`,
      { next: { revalidate: 86400 } },
    );
    if (!response.ok) {
      return NextResponse.json({ error: "Ukjent fond." }, { status: 404 });
    }
    const json = await response.json();
    return NextResponse.json({
      isin,
      name: json.name ?? null,
      ongoingCharge:
        typeof json.ongoing_charge === "number" ? json.ongoing_charge : null,
      morningstarRating:
        typeof json.morningstar_rating === "number"
          ? json.morningstar_rating
          : null,
      category: json.category ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Kilden svarte ikke." }, { status: 502 });
  }
}
