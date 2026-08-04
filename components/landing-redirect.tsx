"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { STORAGE_KEYS } from "@/lib/storage";

/** Besøkende med egen portefølje sendes rett til dashbordet — landingssiden
 *  er for nye. Kjører kun klientside; crawlere ser alltid landingen. */
export function LandingRedirect() {
  const router = useRouter();
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DATA_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.holdings) && parsed.holdings.length > 0) {
        router.replace("/app");
      }
    } catch {
      // Uleselig lagring skal aldri blokkere landingssiden.
    }
  }, [router]);
  return null;
}
