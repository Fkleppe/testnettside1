import { NextResponse } from "next/server";
import { googleConfigured } from "@/auth";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ googleEnabled: googleConfigured });
}
