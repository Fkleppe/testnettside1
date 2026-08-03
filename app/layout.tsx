import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Min Sparing — hele sparingen på ett sted",
  description: "Samle fond, aksjer og krypto. Se hva som er oppdatert, estimert og registrert manuelt.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nb" className={`${GeistSans.variable} ${GeistMono.variable}`}><body className={GeistSans.className}>{children}</body></html>;
}
