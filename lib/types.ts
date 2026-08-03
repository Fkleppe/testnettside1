export type AssetKind = "fund" | "stock" | "crypto";
export type PriceMode = "automatic" | "manual";
export type AccountGroup = "private" | "business" | "family" | "pension";

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
  dailyPercent: number | null;
  currency: string;
  source: string;
  updatedAt: string;
  delayed?: boolean;
  accountGroup?: AccountGroup;
};
