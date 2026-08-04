import type { Metadata } from "next";
import "@fontsource-variable/schibsted-grotesk";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Min Sparing — hele sparingen på ett sted",
  description: "Samle fond, aksjer og krypto. Se hva som er oppdatert, estimert og registrert manuelt.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nb">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
