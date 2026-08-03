# Min Sparing

En norsk spareoversikt for fond, aksjer og krypto. MVP-en kan hente kryptokurs fra CoinGecko, aksjekurs fra Yahoo Finance eller Twelve Data og utvalgte offisielle fondskurser fra DNB. Brukeren kan alltid registrere eller overstyre en kurs manuelt.

## Lokal utvikling

```bash
npm install
cp .env.example .env.local
npm run dev
```

`TWELVE_DATA_API_KEY` er valgfri og skal bare ligge i lokale/Vercel-miljøvariabler. Ingen nøkler eksponeres i nettleseren. CoinGecko brukes uten nøkkel for et begrenset offentlig kall, eller med valgfri Demo-nøkkel.

## Datakilder og begrensninger

- **CoinGecko**: kryptopriser i NOK og rullerende 24-timers endring. En 24-timers endring tas ikke med i porteføljens «i dag», fordi den ikke er det samme som utvikling siden midnatt.
- **Twelve Data**: ett felles grensesnitt for aksjer og internasjonale fond. Freemium-konto kreves; instrument- og børsdekning avhenger av abonnementet.
- **Yahoo Finance**: reservekilde for aksjer. Utenlandske priser regnes om til NOK, inklusive endringen i valutakurs fra forrige sluttkurs. Dette er en uoffisiell gratiskilde uten garantert oppetid eller komplett børsdekning.
- **DNB**: offisiell NAV støttes foreløpig for DNB Teknologi A og DNB Fund – Disruptive Opportunities Retail A (N) NOK.
- **Fond/NAV**: offisiell NAV beregnes normalt én gang daglig etter markedsslutt og publiseres senere. Appen skiller mellom «beregnes etter markedsslutt», «innen normal publisering» og «datakilde etter fristen». Den siste statusen brukes først når forventet publisering er passert. Helger håndteres; norske og internasjonale børshelligdager kommer i en senere fase.

## MVP-arkitektur

- Next.js App Router og TypeScript
- serverrute i `/api/quote` skjuler API-nøkler og cacher svar
- porteføljen lagres lokalt i nettleseren; ingen konto eller database i første versjon
- dagsendring regnes fra forrige kurs når den finnes; prosent alene omregnes tilbake til korrekt kroneendring
- en historikkgraf vises først når løsningen har ekte, vedvarende daglige snapshots
- responsivt, norsk grensesnitt med demoportefølje

Neste naturlige steg er innlogging og synkronisering på tvers av enheter, en lisensiert instrument- og fondsdatabase, daglige snapshots, børskalender og en etterprøvbar estimatmodell for fond.
