import type { Holding, QuoteStatus } from "./types";

export type QuoteTone =
  "fresh" | "waiting" | "warning" | "manual" | "estimated" | "error";

export type QuoteState = {
  code: QuoteStatus;
  label: string;
  detail: string;
  tone: QuoteTone;
};

type FundPolicy = {
  delayBusinessDays: number;
  publishHour: number;
  marketCloseHour: number;
};

const DEFAULT_FUND_POLICY: FundPolicy = {
  delayBusinessDays: 1,
  publishHour: 14,
  marketCloseHour: 22,
};
const FUND_POLICIES: Record<string, FundPolicy> = {
  NO0010337678: { delayBusinessDays: 1, publishHour: 14, marketCloseHour: 22 },
  LU2075955943: { delayBusinessDays: 2, publishHour: 14, marketCloseHour: 22 },
  NO0010582979: { delayBusinessDays: 1, publishHour: 11, marketCloseHour: 17 },
};

const MONTHS: Record<string, string> = {
  jan: "01",
  januar: "01",
  feb: "02",
  februar: "02",
  mar: "03",
  mars: "03",
  apr: "04",
  april: "04",
  mai: "05",
  jun: "06",
  juni: "06",
  jul: "07",
  juli: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  okt: "10",
  oktober: "10",
  nov: "11",
  november: "11",
  des: "12",
  desember: "12",
};

const dateLabel = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function holdingValue(item: Holding) {
  return item.units * item.price;
}

export function addPurchase(
  item: Holding,
  purchase: { units: number; amount: number },
) {
  return {
    ...item,
    units: item.units + Math.max(0, purchase.units),
    cost: item.cost + Math.max(0, purchase.amount),
  };
}

export function hasCalendarDayChange(item: Holding) {
  return (
    item.changePeriod !== "24h" &&
    ((Number.isFinite(item.previousPrice) && (item.previousPrice ?? 0) > 0) ||
      (item.dailyPercent !== null && item.dailyPercent !== undefined))
  );
}

export function holdingDailyPercent(item: Holding) {
  if (!hasCalendarDayChange(item)) return null;
  if (Number.isFinite(item.previousPrice) && (item.previousPrice ?? 0) > 0) {
    return (
      ((item.price - (item.previousPrice ?? item.price)) /
        (item.previousPrice ?? item.price)) *
      100
    );
  }
  return item.dailyPercent;
}

export function dailyValue(item: Holding) {
  if (!hasCalendarDayChange(item)) return 0;
  if (Number.isFinite(item.previousPrice) && (item.previousPrice ?? 0) > 0) {
    return item.units * (item.price - (item.previousPrice ?? item.price));
  }
  const percent = item.dailyPercent ?? 0;
  if (percent <= -100) return -holdingValue(item);
  return (holdingValue(item) * percent) / (100 + percent);
}

export function calculateTotals(items: Holding[]) {
  const value = items.reduce((sum, item) => sum + holdingValue(item), 0);
  const cost = items.reduce((sum, item) => sum + item.cost, 0);
  const today = items.reduce((sum, item) => sum + dailyValue(item), 0);
  const covered = items.filter(hasCalendarDayChange);
  const coveredValue = covered.reduce(
    (sum, item) => sum + holdingValue(item),
    0,
  );
  const previousCoveredValue = coveredValue - today;
  // Seneste kursdato blant bidragene: styrer om endringen kan kalles
  // «i dag» eller må merkes med NAV-datoen den faktisk gjelder.
  const changeDate = covered.reduce<string | null>(
    (latest, item) =>
      item.priceDate && (!latest || item.priceDate > latest)
        ? item.priceDate
        : latest,
    null,
  );
  return {
    changeDate,
    value,
    cost,
    today,
    total: value - cost,
    totalPercent: cost ? ((value - cost) / cost) * 100 : 0,
    todayPercent: previousCoveredValue
      ? (today / previousCoveredValue) * 100
      : 0,
    positions: items.length,
    updated: covered.length,
    coveragePercent: value ? (coveredValue / value) * 100 : 0,
    complete: items.length > 0 && covered.length === items.length,
  };
}

export function parsePriceDate(value?: string) {
  if (!value) return undefined;
  const iso = value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const numeric = value.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})\b/);
  if (numeric)
    return `${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
  const named = value
    .toLocaleLowerCase("nb-NO")
    .match(/\b(\d{1,2})\.?\s+([a-zæøå]+)\.?\s+(20\d{2})\b/);
  if (!named) return undefined;
  const month = MONTHS[named[2]];
  return month
    ? `${named[3]}-${month}-${named[1].padStart(2, "0")}`
    : undefined;
}

export function migrateHolding(item: Holding): Holding {
  const dailyPercent =
    item.delayed && item.dailyPercent === 0 ? null : item.dailyPercent;
  const previousPrice =
    item.previousPrice ??
    (item.changePeriod !== "24h" &&
    dailyPercent !== null &&
    dailyPercent !== undefined &&
    dailyPercent > -100
      ? item.price / (1 + dailyPercent / 100)
      : undefined);
  return {
    ...item,
    dailyPercent,
    previousPrice,
    priceDate: item.priceDate ?? parsePriceDate(item.priceAsOf),
    quoteStatus: item.mode === "manual" ? "manual_override" : item.quoteStatus,
  };
}

export function getQuoteState(item: Holding, now = new Date()): QuoteState {
  if (item.quoteStatus === "source_error") {
    return {
      code: "source_error",
      label: "Kunne ikke oppdatere",
      detail: item.source,
      tone: "error",
    };
  }
  if (item.quoteStatus === "estimated_intraday") {
    return {
      code: "estimated_intraday",
      label: "Estimert i dag",
      detail: "Ikke offisiell sluttkurs",
      tone: "estimated",
    };
  }
  if (item.mode === "manual" || item.quoteStatus === "manual_override") {
    return {
      code: "manual_override",
      label: "Manuelt registrert",
      detail: item.priceDate
        ? `Verdi fra ${formatDateKey(item.priceDate)}`
        : `Oppdatert ${formatTimestamp(item.updatedAt)}`,
      tone: "manual",
    };
  }

  const oslo = getOsloParts(now);
  const priceDate =
    item.priceDate ?? parsePriceDate(item.priceAsOf) ?? oslo.date;

  if (item.kind !== "fund") {
    if (priceDate === oslo.date) {
      return {
        code: "official_current",
        label:
          item.changePeriod === "24h" ? "Kurs oppdatert" : "Oppdatert i dag",
        detail: item.source,
        tone: "fresh",
      };
    }
    return {
      code: "official_previous",
      label: "Siste sluttkurs",
      detail: `${formatDateKey(priceDate)} · ${item.source}`,
      tone: "waiting",
    };
  }

  const policy = FUND_POLICIES[item.symbol] ?? DEFAULT_FUND_POLICY;
  const latestDue = latestDueValueDate(oslo.date, oslo.hour, policy);
  if (priceDate < latestDue) {
    return {
      code: "source_late",
      label: "Kilde etter fristen",
      detail: `Datakilden mangler NAV for ${formatDateKey(latestDue)}`,
      tone: "warning",
    };
  }
  if (priceDate === oslo.date) {
    return {
      code: "official_current",
      label: "Offisiell NAV",
      detail: `NAV ${formatDateKey(priceDate)}`,
      tone: "fresh",
    };
  }

  const latestValueDay = mostRecentBusinessDay(oslo.date);
  const nextUnpublishedValueDay = nextValueDayAfter(priceDate, latestValueDay);
  if (!nextUnpublishedValueDay) {
    return {
      code: "official_previous",
      label: "Siste offisielle NAV",
      detail: `NAV ${formatDateKey(priceDate)}`,
      tone: "waiting",
    };
  }
  const publicationDate = addBusinessDays(
    nextUnpublishedValueDay,
    policy.delayBusinessDays,
  );
  if (publicationDate === oslo.date && oslo.hour < policy.publishHour) {
    return {
      code: "within_publication_window",
      label: "Innen normal publisering",
      detail: `NAV for ${formatDateKey(nextUnpublishedValueDay)} forventes i dag etter kl. ${policy.publishHour}`,
      tone: "waiting",
    };
  }
  if (
    nextUnpublishedValueDay === oslo.date &&
    oslo.hour < policy.marketCloseHour
  ) {
    return {
      code: "awaiting_market_close",
      label: "Beregnes etter markedsslutt",
      detail: `NAV for i dag forventes ${formatExpectedDate(publicationDate, oslo.date)} etter kl. ${policy.publishHour}`,
      tone: "waiting",
    };
  }
  return {
    code: "within_publication_window",
    label: "Innen normal publisering",
    detail: `NAV for ${formatDateKey(nextUnpublishedValueDay)} forventes ${formatExpectedDate(publicationDate, oslo.date)} etter kl. ${policy.publishHour}`,
    tone: "waiting",
  };
}

function getOsloParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
  };
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(key: string, count: number) {
  const date = dateFromKey(key);
  date.setUTCDate(date.getUTCDate() + count);
  return dateKey(date);
}

function isBusinessDay(key: string) {
  const day = dateFromKey(key).getUTCDay();
  return day !== 0 && day !== 6;
}

function addBusinessDays(key: string, count: number) {
  let result = key;
  let remaining = count;
  while (remaining > 0) {
    result = addDays(result, 1);
    if (isBusinessDay(result)) remaining -= 1;
  }
  return result;
}

function mostRecentBusinessDay(today: string) {
  let result = today;
  while (!isBusinessDay(result)) result = addDays(result, -1);
  return result;
}

function latestDueValueDate(today: string, hour: number, policy: FundPolicy) {
  let candidate = mostRecentBusinessDay(today);
  for (let attempts = 0; attempts < 14; attempts += 1) {
    const publication = addBusinessDays(candidate, policy.delayBusinessDays);
    if (
      publication < today ||
      (publication === today && hour >= policy.publishHour)
    )
      return candidate;
    candidate = previousBusinessDay(candidate);
  }
  return candidate;
}

function previousBusinessDay(key: string) {
  let result = addDays(key, -1);
  while (!isBusinessDay(result)) result = addDays(result, -1);
  return result;
}

function nextValueDayAfter(priceDate: string, latestValueDay: string) {
  let candidate = addDays(priceDate, 1);
  while (candidate <= latestValueDay) {
    if (isBusinessDay(candidate)) return candidate;
    candidate = addDays(candidate, 1);
  }
  return undefined;
}

export function formatDateKey(key: string) {
  return dateLabel.format(dateFromKey(key)).replace(".", "");
}

function formatExpectedDate(key: string, today: string) {
  return key === addDays(today, 1) ? "i morgen" : formatDateKey(key);
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Oslo",
  }).format(new Date(value));
}
