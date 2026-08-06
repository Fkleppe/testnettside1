import { NextResponse } from "next/server";
import { readNavLog } from "@/lib/navlog";

export const runtime = "nodejs";

/** Når har DNB faktisk publisert NAV? Offentlige fondsdata — ingen
 *  brukerinformasjon. detectedAt = første gang appen observerte datoen. */
export async function GET() {
  const log = await readNavLog();
  return NextResponse.json(log, {
    headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
  });
}
