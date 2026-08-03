# Min Sparing

En norsk spareoversikt for fond, aksjer og krypto. MVP-en kan hente kryptokurs fra CoinGecko, hente aksje- og fondskurs fra Twelve Data når en nøkkel er konfigurert, og lar alltid brukeren registrere kurs manuelt.

## Lokal utvikling

```bash
npm install
cp .env.example .env.local
npm run dev
```

`TWELVE_DATA_API_KEY` er valgfri og skal bare ligge i lokale/Vercel-miljøvariabler. Ingen nøkler eksponeres i nettleseren. CoinGecko brukes uten nøkkel for et begrenset offentlig kall, eller med valgfri Demo-nøkkel.

## Datakilder og begrensninger

- **CoinGecko**: kryptopriser i NOK og 24-timers endring. Offentlig tilgang er ratebegrenset og bør caches.
- **Twelve Data**: ett felles grensesnitt for aksjer og internasjonale fond. Freemium-konto kreves; instrument- og børsdekning avhenger av abonnementet.
- **Fond/NAV**: offisiell NAV beregnes normalt én gang daglig. Nordnet opplyser at flere egne indeksfond først publiseres påfølgende bankdag, og enkelte fond etter to bankdager. Appen merker derfor fond som «Forsinket NAV» og støtter manuell overstyring.

## MVP-arkitektur

- Next.js App Router og TypeScript
- serverrute i `/api/quote` skjuler API-nøkler og cacher svar
- porteføljen lagres lokalt i nettleseren; ingen konto eller database i første versjon
- responsivt, norsk grensesnitt med demoportefølje

Neste naturlige steg er innlogging og synkronisering på tvers av enheter, bedre fondsøk på navn/ISIN, valutakonvertering, historiske grafer og en tydelig estimatmodell for forsinkede fond.
