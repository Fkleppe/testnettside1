"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { LogIn, LogOut, UserRound } from "lucide-react";

export function AccountButton({
  syncState,
}: {
  syncState?: "off" | "checking" | "synced" | "error";
}) {
  const { data: session, status } = useSession();
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth-config")
      .then((response) => response.json())
      .then((json) => {
        if (!cancelled) setGoogleEnabled(Boolean(json.googleEnabled));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!googleEnabled || status === "loading") return null;

  if (session?.user) {
    return (
      <button
        className="account-button"
        onClick={() => void signOut()}
        title={`Logget inn som ${session.user.email ?? session.user.name}`}
      >
        {syncState && syncState !== "off" ? (
          <i
            className={`sync-dot ${syncState}`}
            title={
              syncState === "synced"
                ? "Synkronisert til skyen"
                : syncState === "checking"
                  ? "Synkroniserer …"
                  : "Synkfeil — prøver igjen automatisk"
            }
          />
        ) : null}
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" width={18} height={18} />
        ) : (
          <UserRound size={14} />
        )}
        <span>{session.user.name?.split(" ")[0] ?? "Profil"}</span>
        <LogOut size={13} />
      </button>
    );
  }

  return (
    <button
      className="account-button"
      onClick={() => void signIn("google")}
    >
      <LogIn size={14} />
      <span>Logg inn</span>
    </button>
  );
}
