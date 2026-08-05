import Image from "next/image";
import Link from "next/link";
import { LandingRedirect } from "@/components/landing-redirect";

const JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Min Sparing",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "Gratis norsk porteføljeoversikt for fond, aksjer og krypto — med ekte daglig historikk, skatteestimat og kryptert synk.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "NOK" },
  inLanguage: "nb",
}).replace(/</g, "\\u003c");

function MiniChart() {
  return (
    <div className="ld-vignette ld-vignette-chart" aria-hidden="true">
      <div className="ld-mini-pills">
        <span>1 uke</span>
        <span>3 mnd</span>
        <span className="on">Maks</span>
        <b>+12,4 %</b>
      </div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ld-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--positive)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--positive)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,33L8,31L14,32L22,28L30,29L38,25L44,26.5L52,22L60,23L66,18L74,19.5L82,14L90,15L100,9L100,40L0,40Z"
          fill="url(#ld-area)"
        />
        <path
          d="M0,33L8,31L14,32L22,28L30,29L38,25L44,26.5L52,22L60,23L66,18L74,19.5L82,14L90,15L100,9"
          fill="none"
          stroke="var(--positive)"
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function MiniTax() {
  return (
    <div className="ld-vignette ld-vignette-tax" aria-hidden="true">
      <div className="ld-tax-bars">
        <div className="ld-tax-bar">
          <i style={{ height: "168px" }} />
          <b>848 388</b>
          <span>Før skatt</span>
        </div>
        <div className="ld-tax-bar net">
          <i style={{ height: "156px" }} />
          <b>790 188</b>
          <span>Etter skatt</span>
        </div>
      </div>
      <div className="ld-vignette-rows">
        <div className="ld-mini-row">
          <span>Aksjefond (1,72 × 22 %)</span>
          <b>37,84 %</b>
        </div>
        <div className="ld-mini-row">
          <span>Krypto</span>
          <b>22 %</b>
        </div>
        <div className="ld-mini-row ld-mini-sum">
          <span>Verdi etter skatt</span>
          <b className="positive">790 188 kr</b>
        </div>
      </div>
    </div>
  );
}

function MiniAccounts() {
  const groups: [string, string][] = [
    ["PR", "Privat"],
    ["AS", "Bedrift"],
    ["BF", "Barn & familie"],
    ["PS", "Pensjon"],
  ];
  return (
    <div className="ld-vignette ld-vignette-rows" aria-hidden="true">
      {groups.map(([short, label]) => (
        <div key={short} className="ld-mini-row">
          <i className={`ld-avatar ld-avatar-${short.toLowerCase()}`}>{short}</i>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function MiniQuality() {
  return (
    <div className="ld-vignette ld-vignette-rows" aria-hidden="true">
      <div className="ld-mini-row">
        <i className="ld-dot ok" />
        <span>Offisiell sluttkurs</span>
      </div>
      <div className="ld-mini-row">
        <i className="ld-dot wait" />
        <span>Innen normal publisering</span>
      </div>
      <div className="ld-mini-row">
        <i className="ld-dot late" />
        <span>Datakilde etter fristen</span>
      </div>
    </div>
  );
}

function MiniSnapshots() {
  return (
    <div className="ld-vignette ld-vignette-days" aria-hidden="true">
      {Array.from({ length: 21 }, (_, index) => (
        <i key={index} className={index < 19 ? "on" : undefined} />
      ))}
    </div>
  );
}

function MiniSync() {
  return (
    <div className="ld-vignette ld-vignette-sync" aria-hidden="true">
      <span className="ld-device">Mac</span>
      <svg viewBox="0 0 48 10" className="ld-sync-arrows">
        <path d="M4,3H40M40,3l-4,-2.4M40,3l-4,2.4" stroke="currentColor" fill="none" strokeWidth="1.2" />
        <path d="M44,7H8M8,7l4,-2.4M8,7l4,2.4" stroke="currentColor" fill="none" strokeWidth="1.2" />
      </svg>
      <span className="ld-device">Mobil</span>
    </div>
  );
}

export function Landing() {
  return (
    <div className="ld">
      <LandingRedirect />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON_LD }}
      />
      <header className="ld-nav">
        <Link href="/" className="ld-brand" aria-label="Min Sparing">
          <span className="ld-brand-mark" aria-hidden="true">
            <i />
            <i />
          </span>
          Min Sparing
        </Link>
        <nav aria-label="Seksjoner">
          <a href="#funksjoner">Funksjoner</a>
          <a href="#sikkerhet">Sikkerhet</a>
          <a href="#skatt">Skatt</a>
        </nav>
        <div className="ld-nav-actions">
          <Link href="/app" className="ld-ghost">
            Logg inn
          </Link>
          <Link href="/app" className="ld-cta">
            Kom i gang gratis
          </Link>
        </div>
      </header>

      <main>
        <section className="ld-hero">
          <Link href="/app" className="ld-tour">
            <svg viewBox="0 0 10 12" aria-hidden="true">
              <path d="M1 1.2v9.6L9 6z" fill="currentColor" />
            </svg>
            Se demoen med eksempeldata
          </Link>
          <h1>
            Hele sparingen din.
            <br />
            Én oversikt.
          </h1>
          <p className="ld-sub">
            Fond, aksjer og krypto fra Nordnet, Kron, Firi og DNB — samlet i ett
            presist dashbord. Sett opp porteføljen på under ett minutt, uten å
            koble til banken.
          </p>
          <div className="ld-hero-actions">
            <Link href="/app" className="ld-cta ld-cta-lg">
              Sett opp porteføljen gratis
            </Link>
            <a href="#funksjoner" className="ld-ghost ld-ghost-lg">
              Se hva du får
            </a>
          </div>
          <div className="ld-shot">
            <div className="ld-laptop">
              <div className="ld-laptop-screen">
                <Image
                  src="/marketing/dashboard-10.png"
                  width={1560}
                  height={975}
                  priority
                  alt="Dashbordet i Min Sparing: kontoer, historikk-graf over egenkapital, dagens bevegelser og skatteestimat"
                />
              </div>
              <div className="ld-laptop-base" aria-hidden="true">
                <i />
              </div>
            </div>
            <div className="ld-shot-fade" aria-hidden="true" />
          </div>
        </section>

        <section className="ld-proof" aria-label="Nøkkelfakta">
          <span>909 norske fond med ISIN</span>
          <span>Offisiell NAV fra DNB</span>
          <span>Kurser fra CoinGecko &amp; Yahoo</span>
          <span>AES-256-kryptert skysynk</span>
        </section>

        <section className="ld-section ld-how" id="slik-fungerer-det">
          <p className="ld-kicker">Slik fungerer det</p>
          <h2>I gang på ett minutt</h2>
          <div className="ld-steps">
            <div className="ld-step">
              <span>01</span>
              <h3>Legg inn beholdningen</h3>
              <p>
                Søk blant 909 norske fond, eller registrer aksjer og krypto
                manuelt. Ingen BankID, ingen fullmakter.
              </p>
            </div>
            <div className="ld-step">
              <span>02</span>
              <h3>Følg utviklingen daglig</h3>
              <p>
                Kurser hentes automatisk, og hver dag festes et nytt punkt i
                historikken din — helt av seg selv.
              </p>
            </div>
            <div className="ld-step">
              <span>03</span>
              <h3>Se hele bildet</h3>
              <p>
                Fordeling, dagens bevegelser og verdi etter skatt — samlet i ett
                dashbord som alltid er oppdatert.
              </p>
            </div>
          </div>
        </section>

        <section className="ld-section" id="funksjoner">
          <p className="ld-kicker">Funksjoner</p>
          <h2>Alt du trenger for å følge formuen</h2>
          <p className="ld-section-sub">
            Ingen tilkoblinger, ingen fullmakter. Du registrerer beholdningen én
            gang — resten holder appen styr på.
          </p>
          <div className="ld-bento">
            <article className="ld-card ld-card-hist">
              <MiniChart />
              <h3>Ekte historikk, aldri syntetisk</h3>
              <p>
                Porteføljen lagrer ett verdipunkt per dag og tegner utviklingen
                fra faktiske observasjoner — med intervaller fra én uke til maks.
              </p>
            </article>
            <article className="ld-card ld-card-tax">
              <MiniTax />
              <h3>Skatteestimat med 2026-satser</h3>
              <p>
                Se hva du sitter igjen med hvis alt selges i dag. Aksjefond og
                krypto beskattes ulikt — appen regner riktig sats per type.
              </p>
            </article>
            <article className="ld-card">
              <MiniAccounts />
              <h3>Fire kontogrupper</h3>
              <p>
                Del porteføljen mellom privat, bedrift, barn og pensjon — og
                filtrer hele dashbordet med ett klikk.
              </p>
            </article>
            <article className="ld-card">
              <MiniSnapshots />
              <h3>Daglige snapshots</h3>
              <p>
                Hver dag appen er åpen festes verdien til historikken din — på
                tvers av enheter, uten dobbeltlagring.
              </p>
            </article>
            <article className="ld-card">
              <MiniSync />
              <h3>Synk mellom enheter</h3>
              <p>
                Logg inn med Google når du vil ha porteføljen på flere enheter.
                Alt krypteres før det forlater nettleseren.
              </p>
            </article>
            <article className="ld-card">
              <MiniQuality />
              <h3>Datakvalitet du kan stole på</h3>
              <p>
                Hver kurs merkes med status: offisiell, innen publisering eller
                etter fristen. Aldri pyntede tall.
              </p>
            </article>
            <article className="ld-card ld-card-cta">
              <h3>Ett minutt. Null tilkoblinger.</h3>
              <p>
                Legg inn første beholdning nå — resten kan vente til senere.
              </p>
              <Link href="/app" className="ld-arrow-link">
                Kom i gang <span aria-hidden="true">→</span>
              </Link>
            </article>
          </div>
        </section>

        <section className="ld-section ld-security" id="sikkerhet">
          <div>
            <p className="ld-kicker">Sikkerhet</p>
            <h2>Dine data bor hos deg</h2>
            <p className="ld-section-sub">
              Min Sparing er bygget lokalt-først: porteføljen ligger i din egen
              nettleser og fungerer helt uten konto.
            </p>
            <ul className="ld-list">
              <li>Lokal lagring først — ingen server ser tallene dine</li>
              <li>Skysynk er valgfritt og AES-256-GCM-kryptert per bruker</li>
              <li>Eksporter og importer alt som JSON når som helst</li>
              <li>Rullerende sikkerhetskopier hver sjette time</li>
            </ul>
          </div>
          <div className="ld-vault" aria-hidden="true">
            <div className="ld-mini-row">
              <span>backup-2026-08-04</span>
              <b>14 punkter</b>
            </div>
            <div className="ld-mini-row">
              <span>backup-2026-08-03</span>
              <b>14 punkter</b>
            </div>
            <div className="ld-mini-row">
              <span>eksport.json</span>
              <b className="positive">Lastet ned</b>
            </div>
            <div className="ld-vault-note">Kryptert · 3 versjoner i sky</div>
          </div>
        </section>

        <section className="ld-section ld-tax" id="skatt">
          <p className="ld-kicker">Skatt</p>
          <h2>Se hva du faktisk sitter igjen med</h2>
          <p className="ld-section-sub">
            Estimert skatt beregnes løpende med gjeldende satser — så «verdi
            etter skatt» alltid er ett blikk unna.
          </p>
          <div className="ld-tax-row">
            <div>
              <b>37,84&nbsp;%</b>
              <span>Aksjer og aksjefond (1,72 × 22 %)</span>
            </div>
            <div>
              <b>22&nbsp;%</b>
              <span>Krypto og rentefond</span>
            </div>
            <div>
              <b>Etter skatt</b>
              <span>Netto verdi vises rett i dashbordet</span>
            </div>
          </div>
        </section>

        <section className="ld-final">
          <h2>Klar til å samle sparingen?</h2>
          <p>Gratis. Ingen kredittkort. Ingen registrering.</p>
          <Link href="/app" className="ld-cta ld-cta-lg">
            Sett opp porteføljen gratis
          </Link>
        </section>
      </main>

      <div className="ld-footer" role="contentinfo">
        <div>
          <b>Min Sparing</b>
          <span>Samlet oversikt · ikke investeringsråd</span>
        </div>
        <div>
          <Link href="/app">Åpne appen</Link>
          <a href="#funksjoner">Funksjoner</a>
          <a href="#sikkerhet">Sikkerhet</a>
        </div>
        <small>Data lagres lokalt på enheten din</small>
      </div>
    </div>
  );
}
