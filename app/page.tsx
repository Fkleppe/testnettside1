import type { Metadata } from "next";
import { Landing } from "@/components/landing";

export const metadata: Metadata = {
  title: "Min Sparing — gratis porteføljeoversikt for fond, aksjer og krypto",
  description:
    "Samle fond, aksjer og krypto fra Nordnet, Kron, Firi og DNB i ett dashbord. Ekte daglig historikk, skatteestimat med 2026-satser og kryptert synk. Gratis, uten registrering.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Min Sparing — hele sparingen din i én oversikt",
    description:
      "Gratis norsk porteføljeoversikt med ekte historikk, skatteestimat og kryptert synk mellom enheter.",
    url: "/",
    siteName: "Min Sparing",
    locale: "nb_NO",
    type: "website",
  },
};

export default function Home() {
  return <Landing />;
}
