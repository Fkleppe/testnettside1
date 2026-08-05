import { del, list, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { validatePortfolioData } from "@/lib/storage";

export const runtime = "nodejs";

const KEPT_REMOTE_VERSIONS = 3;

const putSchema = z.object({
  savedAt: z.string().min(1),
  holdings: z.array(z.unknown()),
  events: z.array(z.unknown()),
  snapshots: z.array(z.unknown()).optional(),
});

function userPrefix(userId: string) {
  return `portfolios/${userId}/`;
}

async function latestBlob(userId: string) {
  const { blobs } = await list({ prefix: userPrefix(userId) });
  return blobs.sort((a, b) =>
    a.uploadedAt < b.uploadedAt ? 1 : -1,
  );
}

export async function GET() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
  }
  try {
    const [newest] = await latestBlob(session.userId);
    if (!newest) {
      return NextResponse.json({ exists: false });
    }
    const response = await fetch(newest.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Blob-henting feilet: ${response.status}`);
    }
    const decrypted = JSON.parse(decryptJson(await response.text()));
    const validated = validatePortfolioData(decrypted);
    if (!validated.ok) {
      return NextResponse.json(
        { error: "Skylagret data kunne ikke valideres" },
        { status: 500 },
      );
    }
    return NextResponse.json({
      exists: true,
      savedAt: typeof decrypted.savedAt === "string" ? decrypted.savedAt : null,
      holdings: validated.data.holdings,
      events: validated.data.events,
      snapshots: validated.data.snapshots,
    });
  } catch (error) {
    console.error("Portfolio GET failed:", error);
    return NextResponse.json(
      { error: "Kunne ikke hente skykopi" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ugyldig payload" }, { status: 400 });
  }
  const validated = validatePortfolioData(parsed.data);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  try {
    const existing = await latestBlob(session.userId);
    let data = validated.data;
    // Historikk-vern: en klient uten snapshots (eldre bundle) skal ikke
    // kunne slette skyens historikk-dager. Ved tom innsending arves
    // eksisterende snapshots videre.
    if (data.snapshots.length === 0 && data.holdings.length > 0 && existing[0]) {
      try {
        const response = await fetch(existing[0].url, { cache: "no-store" });
        if (response.ok) {
          const previous = validatePortfolioData(
            JSON.parse(decryptJson(await response.text())),
          );
          if (previous.ok && previous.data.snapshots.length > 0) {
            data = { ...data, snapshots: previous.data.snapshots };
          }
        }
      } catch {
        // Klarer vi ikke lese forrige versjon, lagrer vi som innsendt.
      }
    }
    const payload = encryptJson(
      JSON.stringify({ savedAt: parsed.data.savedAt, ...data }),
    );
    await put(
      `${userPrefix(session.userId)}${Date.now()}.enc`,
      payload,
      { access: "public", addRandomSuffix: true, contentType: "text/plain" },
    );
    const stale = existing.slice(KEPT_REMOTE_VERSIONS - 1);
    if (stale.length) {
      await del(stale.map((blob) => blob.url));
    }
    return NextResponse.json({ ok: true, savedAt: parsed.data.savedAt });
  } catch (error) {
    console.error("Portfolio PUT failed:", error);
    return NextResponse.json(
      { error: "Kunne ikke lagre skykopi" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
  }
  try {
    const blobs = await latestBlob(session.userId);
    if (blobs.length) {
      await del(blobs.map((blob) => blob.url));
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Portfolio DELETE failed:", error);
    return NextResponse.json(
      { error: "Kunne ikke slette skykopi" },
      { status: 500 },
    );
  }
}
