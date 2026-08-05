export type AssetKind = "fund" | "stock" | "crypto";
export type PriceMode = "automatic" | "manual";
export type AccountGroup = "private" | "business" | "family" | "pension";
export type QuoteStatus =
  | "official_current"
  | "awaiting_market_close"
  | "within_publication_window"
  | "official_previous"
  | "source_late"
  | "estimated_intraday"
  | "manual_override"
  | "source_error";

export type Holding = {
  id: string;
  name: string;
  symbol: string;
  kind: AssetKind;
  platform: string;
  mode: PriceMode;
  units: number;
  cost: number;
  price: number;
  previousPrice?: number;
  dailyPercent: number | null;
  changePeriod?: "day" | "24h";
  currency: string;
  source: string;
  updatedAt: string;
  priceDate?: string;
  quoteStatus?: QuoteStatus;
  priceAsOf?: string;
  /** @deprecated Kept only to migrate older data stored in the browser. */
  delayed?: boolean;
  accountGroup?: AccountGroup;
};

export type PortfolioEvent = {
  id: string;
  type: "opening" | "buy";
  holdingId: string;
  holdingName: string;
  accountGroup: AccountGroup;
  date: string;
  createdAt: string;
  units: number;
  price: number;
  amount: number;
  note?: string;
};

/** Sparemål. amount 0 = mål fjernet (gravstein — hindrer at eldre klienter
 *  gjenoppliver et slettet mål); nyeste setAt vinner all fletting. */
export type SavingsGoal = {
  amount: number;
  label?: string;
  setAt: string;
};
