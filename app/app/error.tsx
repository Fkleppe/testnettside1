"use client";

/** Feilgrense for dashbordet: en klientfeil skal aldri gi nettleserens
 *  dødsside — vis norsk melding med gjenopprettingsvalg i stedet. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="app-shell">
      <div className="app-error">
        <h1>Noe gikk galt</h1>
        <p>
          Dashbordet støtte på en feil. Dataene dine er trygge — lokalt og i
          skykopien hvis du er innlogget.
        </p>
        <p className="app-error-detail">{error.digest ?? error.message}</p>
        <button onClick={() => reset()}>Prøv igjen</button>
      </div>
    </main>
  );
}
