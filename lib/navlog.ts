import { list, put } from "@vercel/blob";

type NavLogEntry = { priceDate: string; detectedAt: string };

const seenThisInstance = new Set<string>();

/** Logger første gang vi observerer en ny NAV-dato for et fond — bygger
 *  empirisk fasit for NÅR DNB faktisk publiserer. Feiler stille; logging
 *  skal aldri velte en kursrespons. */
export async function logNavDetection(symbol: string, priceDate: string) {
  const key = `${symbol}:${priceDate}`;
  if (seenThisInstance.has(key)) return;
  seenThisInstance.add(key);
  try {
    const path = `nav-log/${symbol}.json`;
    let entries: NavLogEntry[] = [];
    const { blobs } = await list({ prefix: path });
    if (blobs[0]) {
      const response = await fetch(blobs[0].url, { cache: "no-store" });
      if (response.ok) {
        const parsed = (await response.json()) as NavLogEntry[];
        if (Array.isArray(parsed)) entries = parsed;
      }
    }
    if (entries.some((entry) => entry.priceDate === priceDate)) return;
    entries.push({ priceDate, detectedAt: new Date().toISOString() });
    await put(path, JSON.stringify(entries.slice(-120)), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
  } catch {
    // Stille — kursresponsen er viktigere enn loggen.
  }
}

export async function readNavLog(): Promise<Record<string, NavLogEntry[]>> {
  const out: Record<string, NavLogEntry[]> = {};
  try {
    const { blobs } = await list({ prefix: "nav-log/" });
    await Promise.all(
      blobs.map(async (blob) => {
        const response = await fetch(blob.url, { cache: "no-store" });
        if (!response.ok) return;
        const symbol = blob.pathname.replace("nav-log/", "").replace(".json", "");
        const parsed = (await response.json()) as NavLogEntry[];
        if (Array.isArray(parsed)) out[symbol] = parsed;
      }),
    );
  } catch {
    // Tom logg ved feil.
  }
  return out;
}
