/** DNB legger ut gårsdagens NAV ~kl 11:30–11:40 på hverdager (målt
 *  empirisk; loggen i /api/nav-log bygger fasit over tid). I dette vinduet
 *  poller vi tettere både på klient og server. */
export function inNavRushWindow(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekday = get("weekday");
  if (weekday.startsWith("lør") || weekday.startsWith("søn")) return false;
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  // 11:00–12:45 Oslo-tid: dekker observert 11:35 med god margin begge veier.
  return minutes >= 660 && minutes <= 765;
}
