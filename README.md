# Min Sparing

En norsk spareoversikt for fond, aksjer og krypto. MVP-en kan hente kryptokurs fra CoinGecko, aksjekurs fra Yahoo Finance eller Twelve Data og utvalgte offisielle fondskurser fra DNB. Brukeren kan alltid registrere eller overstyre en kurs manuelt.

## Lokal utvikling

```bash
npm install
cp .env.example .env.local
npm run dev
```

`TWELVE_DATA_API_KEY` er valgfri og skal bare ligge i lokale/Vercel-miljøvariabler. Ingen hemmelige nøkler eksponeres i nettleseren. CoinGecko brukes uten nøkkel for et begrenset offentlig kall, eller med valgfri Demo-nøkkel. Supabase-variablene leveres automatisk av Vercel Marketplace-integrasjonen.

## Datakilder og begrensninger

- **CoinGecko**: kryptopriser i NOK og rullerende 24-timers endring. En 24-timers endring tas ikke med i porteføljens «i dag», fordi den ikke er det samme som utvikling siden midnatt.
- **Twelve Data**: ett felles grensesnitt for aksjer og internasjonale fond. Freemium-konto kreves; instrument- og børsdekning avhenger av abonnementet.
- **Yahoo Finance**: reservekilde for aksjer. Utenlandske priser regnes om til NOK, inklusive endringen i valutakurs fra forrige sluttkurs. Dette er en uoffisiell gratiskilde uten garantert oppetid eller komplett børsdekning.
- **DNB**: offisiell NAV støttes foreløpig for DNB Teknologi A og DNB Fund – Disruptive Opportunities Retail A (N) NOK.
- **Historisk fondsavkastning**: 1-, 3-, 5- og 10-års annualisert avkastning (CAGR) for 22 mye brukte fond. Hovedsettet er kontrollert mot Rentersrente/Morningstar per juni 2026. DNB Fund – Disruptive Opportunities bruker DNBs fondsoversikt per 3. august 2026. Tallene er etter fondets forvaltningsgebyr, men før plattformgebyr og skatt.
- **Fond/NAV**: offisiell NAV beregnes normalt én gang daglig etter markedsslutt og publiseres senere. Appen skiller mellom «beregnes etter markedsslutt», «innen normal publisering» og «datakilde etter fristen». Den siste statusen brukes først når forventet publisering er passert. Helger håndteres; norske og internasjonale børshelligdager kommer i en senere fase.

## MVP-arkitektur

- Next.js App Router og TypeScript
- serverrute i `/api/quote` skjuler API-nøkler og cacher svar
- Supabase Auth gir passordfri e-postinnlogging, mens Postgres lagrer én atomisk og versjonert porteføljekopi per bruker
- Row Level Security knytter alle spørringer til den innloggede brukerens ID; anonyme brukere har ingen tilgang og hele skykopien kan ikke slettes fra appen
- eksisterende nettleserdata valideres, sikkerhetskopieres og kopieres til skyen først etter vellykket innlogging; den versjonerte lokale kopien, eksport/import og rullerende sikkerhetskopier beholdes
- ekstra kjøp kan registreres som sum eller antall andeler; beholdning, inngangsverdi og aktivitetslogg oppdateres og synkroniseres samlet
- dagsendring regnes fra forrige kurs når den finnes; prosent alene omregnes tilbake til korrekt kroneendring
- fremtidsestimatet kan bruke verdi-vektet historisk CAGR eller helt manuelle antakelser, med egen startverdi og månedlig sparing
- en historikkgraf vises først når løsningen har ekte, vedvarende daglige snapshots
- responsivt, norsk grensesnitt med demoportefølje

Databaseskjema og RLS-regler ligger i `supabase/portfolio_snapshots.sql`. Neste naturlige steg er en lisensiert instrument- og fondsdatabase, servergenererte daglige snapshots, børskalender, tydelig konflikthåndtering for helt samtidige endringer og en etterprøvbar estimatmodell for fond.
