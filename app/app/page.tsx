import type { Metadata } from "next";
import { Portfolio } from "@/components/portfolio";

export const metadata: Metadata = {
  title: "Porteføljen — Min Sparing",
  robots: { index: false, follow: false },
};

export default function AppPage() {
  return <Portfolio />;
}
