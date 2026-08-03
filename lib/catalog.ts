import type { AssetKind } from "./types";
import { nordnetFunds } from "./funds.generated";

export type Instrument = {
  name: string;
  symbol: string;
  quoteSymbol?: string;
  kind: AssetKind;
  market: string;
  tags: string[];
};

const funds: Instrument[] = [
  { name: "KLP AksjeGlobal Indeks N", symbol: "KLP-GLOBAL-N", kind: "fund", market: "Global indeks", tags: ["klp", "global", "indeks"] },
  { name: "KLP AksjeGlobal Indeks P", symbol: "NO0010776040", kind: "fund", market: "Global indeks", tags: ["klp", "global", "indeks"] },
  { name: "KLP AksjeVerden Indeks N", symbol: "KLP-VERDEN-N", kind: "fund", market: "Hele verden", tags: ["klp", "verden", "indeks"] },
  { name: "KLP AksjeNorge Indeks N", symbol: "KLP-NORGE-N", kind: "fund", market: "Norge indeks", tags: ["klp", "norge", "indeks"] },
  { name: "KLP AksjeNorge Indeks P", symbol: "KLP-NORGE-P", kind: "fund", market: "Norge indeks", tags: ["klp", "norge", "indeks"] },
  { name: "KLP AksjeFremvoksende Markeder Indeks N", symbol: "KLP-EM-N", kind: "fund", market: "Fremvoksende markeder", tags: ["klp", "emerging", "indeks"] },
  { name: "KLP AksjeEuropa Indeks N", symbol: "KLP-EUROPA-N", kind: "fund", market: "Europa indeks", tags: ["klp", "europa", "indeks"] },
  { name: "DNB Global Indeks A", symbol: "DNB-GLOBAL-A", kind: "fund", market: "Global indeks", tags: ["dnb", "global", "indeks"] },
  { name: "DNB Norge Indeks A", symbol: "DNB-NORGE-A", kind: "fund", market: "Norge indeks", tags: ["dnb", "norge", "indeks"] },
  { name: "DNB Teknologi A", symbol: "NO0010337678", quoteSymbol: "NO0010337678", kind: "fund", market: "Teknologi", tags: ["dnb", "teknologi", "aktiv"] },
  { name: "DNB Fund – Disruptive Opportunities Retail A (N) NOK", symbol: "LU2075955943", quoteSymbol: "LU2075955943", kind: "fund", market: "Global teknologi · aktiv", tags: ["dnb", "fund", "disruptive", "opportunities", "retail a", "n nok", "teknologi", "innovasjon", "aktiv"] },
  { name: "DNB Norden Indeks A", symbol: "DNB-NORDEN-A", kind: "fund", market: "Norden indeks", tags: ["dnb", "norden", "indeks"] },
  { name: "DNB Klima Indeks A", symbol: "DNB-KLIMA-A", kind: "fund", market: "Global klimaindeks", tags: ["dnb", "klima", "indeks"] },
  { name: "Storebrand Indeks – Alle Markeder N", symbol: "STOREBRAND-ALLE-N", kind: "fund", market: "Hele verden", tags: ["storebrand", "global", "indeks"] },
  { name: "Storebrand Indeks Norge N", symbol: "STOREBRAND-NORGE-N", kind: "fund", market: "Norge indeks", tags: ["storebrand", "norge", "indeks"] },
  { name: "Storebrand Global Indeks N", symbol: "STOREBRAND-GLOBAL-N", kind: "fund", market: "Global indeks", tags: ["storebrand", "global", "indeks"] },
  { name: "Kron Indeks Global", symbol: "KRON-GLOBAL", kind: "fund", market: "Global indeks", tags: ["kron", "global", "indeks"] },
  { name: "Kron Indeks Norge", symbol: "KRON-NORGE", kind: "fund", market: "Norge indeks", tags: ["kron", "norge", "indeks"] },
  { name: "Nordnet Global Indeks", symbol: "NORDNET-GLOBAL", kind: "fund", market: "Global indeks", tags: ["nordnet", "global", "indeks"] },
  { name: "Nordnet Norge Indeks", symbol: "NO0010582979", kind: "fund", market: "Norge indeks", tags: ["nordnet", "norge", "indeks"] },
  { name: "Nordnet USA Indeks", symbol: "NORDNET-USA", kind: "fund", market: "USA indeks", tags: ["nordnet", "usa", "indeks"] },
  { name: "Nordnet Teknologi Indeks", symbol: "NORDNET-TEKNOLOGI", kind: "fund", market: "Teknologi", tags: ["nordnet", "teknologi", "indeks"] },
  { name: "Nordnet Emerging Markets Indeks", symbol: "NORDNET-EM", kind: "fund", market: "Fremvoksende markeder", tags: ["nordnet", "emerging", "indeks"] },
  { name: "SpareBank 1 Indeks Global N", symbol: "SB1-GLOBAL-N", kind: "fund", market: "Global indeks", tags: ["sparebank 1", "global", "indeks"] },
  { name: "ODIN Global C", symbol: "ODIN-GLOBAL-C", kind: "fund", market: "Global aktiv", tags: ["odin", "global", "aktiv"] },
  { name: "Alfred Berg Gambak", symbol: "ALFRED-GAMBAK", kind: "fund", market: "Norge aktiv", tags: ["alfred berg", "norge", "aktiv"] },
];

const stocks: Instrument[] = [
  { name: "Equinor", symbol: "EQNR", quoteSymbol: "EQNR.OL", kind: "stock", market: "Oslo Børs", tags: ["energi", "norge"] },
  { name: "DNB Bank", symbol: "DNB", quoteSymbol: "DNB.OL", kind: "stock", market: "Oslo Børs", tags: ["bank", "norge"] },
  { name: "Kongsberg Gruppen", symbol: "KOG", quoteSymbol: "KOG.OL", kind: "stock", market: "Oslo Børs", tags: ["industri", "forsvar", "norge"] },
  { name: "Norsk Hydro", symbol: "NHY", quoteSymbol: "NHY.OL", kind: "stock", market: "Oslo Børs", tags: ["aluminium", "norge"] },
  { name: "Mowi", symbol: "MOWI", quoteSymbol: "MOWI.OL", kind: "stock", market: "Oslo Børs", tags: ["sjømat", "norge"] },
  { name: "Telenor", symbol: "TEL", quoteSymbol: "TEL.OL", kind: "stock", market: "Oslo Børs", tags: ["telekom", "norge"] },
  { name: "Aker BP", symbol: "AKRBP", quoteSymbol: "AKRBP.OL", kind: "stock", market: "Oslo Børs", tags: ["energi", "norge"] },
  { name: "Orkla", symbol: "ORK", quoteSymbol: "ORK.OL", kind: "stock", market: "Oslo Børs", tags: ["forbruk", "norge"] },
  { name: "Yara International", symbol: "YAR", quoteSymbol: "YAR.OL", kind: "stock", market: "Oslo Børs", tags: ["gjødsel", "norge"] },
  { name: "Gjensidige Forsikring", symbol: "GJF", quoteSymbol: "GJF.OL", kind: "stock", market: "Oslo Børs", tags: ["forsikring", "norge"] },
  { name: "SalMar", symbol: "SALM", quoteSymbol: "SALM.OL", kind: "stock", market: "Oslo Børs", tags: ["sjømat", "norge"] },
  { name: "Subsea 7", symbol: "SUBC", quoteSymbol: "SUBC.OL", kind: "stock", market: "Oslo Børs", tags: ["energi", "norge"] },
  { name: "Tomra Systems", symbol: "TOM", quoteSymbol: "TOM.OL", kind: "stock", market: "Oslo Børs", tags: ["miljø", "industri", "norge"] },
  { name: "AutoStore", symbol: "AUTO", quoteSymbol: "AUTO.OL", kind: "stock", market: "Oslo Børs", tags: ["teknologi", "lager", "norge"] },
  { name: "Vår Energi", symbol: "VAR", quoteSymbol: "VAR.OL", kind: "stock", market: "Oslo Børs", tags: ["energi", "norge"] },
  { name: "Apple", symbol: "AAPL", kind: "stock", market: "NASDAQ", tags: ["teknologi", "usa"] },
  { name: "Microsoft", symbol: "MSFT", kind: "stock", market: "NASDAQ", tags: ["teknologi", "usa"] },
  { name: "Nvidia", symbol: "NVDA", kind: "stock", market: "NASDAQ", tags: ["halvleder", "teknologi", "usa"] },
  { name: "Alphabet", symbol: "GOOGL", kind: "stock", market: "NASDAQ", tags: ["teknologi", "usa"] },
  { name: "Amazon", symbol: "AMZN", kind: "stock", market: "NASDAQ", tags: ["handel", "teknologi", "usa"] },
  { name: "Meta Platforms", symbol: "META", kind: "stock", market: "NASDAQ", tags: ["teknologi", "usa"] },
  { name: "Tesla", symbol: "TSLA", kind: "stock", market: "NASDAQ", tags: ["bil", "teknologi", "usa"] },
  { name: "Berkshire Hathaway B", symbol: "BRK-B", kind: "stock", market: "NYSE", tags: ["finans", "usa"] },
  { name: "JPMorgan Chase", symbol: "JPM", kind: "stock", market: "NYSE", tags: ["bank", "usa"] },
  { name: "Visa", symbol: "V", kind: "stock", market: "NYSE", tags: ["betaling", "usa"] },
  { name: "Novo Nordisk", symbol: "NOVO-B", quoteSymbol: "NOVO-B.CO", kind: "stock", market: "København", tags: ["helse", "danmark"] },
  { name: "ASML", symbol: "ASML", quoteSymbol: "ASML.AS", kind: "stock", market: "Amsterdam", tags: ["halvleder", "europa"] },
  { name: "Volvo B", symbol: "VOLV-B", quoteSymbol: "VOLV-B.ST", kind: "stock", market: "Stockholm", tags: ["industri", "sverige"] },
];

const crypto: Instrument[] = [
  { name: "Bitcoin", symbol: "BTC", kind: "crypto", market: "Krypto", tags: ["bitcoin"] },
  { name: "Ethereum", symbol: "ETH", kind: "crypto", market: "Krypto", tags: ["ethereum"] },
  { name: "Solana", symbol: "SOL", kind: "crypto", market: "Krypto", tags: ["solana"] },
  { name: "Cardano", symbol: "ADA", kind: "crypto", market: "Krypto", tags: ["cardano"] },
];

export const instrumentCatalog = [...funds, ...nordnetFunds, ...stocks, ...crypto]
  .filter((item, index, all) => all.findIndex((candidate) => candidate.kind === item.kind && candidate.symbol === item.symbol) === index);

export function searchInstruments(kind: AssetKind, query: string) {
  const needle = query.trim().toLocaleLowerCase("nb-NO");
  return instrumentCatalog
    .filter((item) => item.kind === kind)
    .filter((item) => !needle || `${item.name} ${item.symbol} ${item.market} ${item.tags.join(" ")}`.toLocaleLowerCase("nb-NO").includes(needle))
    .slice(0, 10);
}
