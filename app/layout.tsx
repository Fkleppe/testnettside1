import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Min Sparing — hele sparingen på ett sted",
  description: "Samle fond, aksjer og krypto. Se hva som er oppdatert, estimert og registrert manuelt.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nb"><head><link rel="preconnect" href="https://api.fontshare.com" /><link href="https://api.fontshare.com/v2/css?f[]=switzer@400,700,800&display=swap" rel="stylesheet" /></head><body>{children}</body></html>;
}
