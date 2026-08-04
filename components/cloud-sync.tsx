"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  Check,
  Cloud,
  CloudOff,
  LoaderCircle,
  LogOut,
  Mail,
  ShieldCheck,
  X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Holding, PortfolioEvent } from "@/lib/types";

const BACKUP_KEY = "min-sparing-cloud-backup-v1";
const CLOUD_OWNER_KEY = "min-sparing-cloud-owner-v1";
const SYNC_DELAY_MS = 700;

type PortfolioSnapshot = {
  holdings: Holding[];
  events: PortfolioEvent[];
};

type RemoteSnapshot = PortfolioSnapshot & {
  revision: number;
  updated_at: string;
};

type SyncStatus =
  | "checking"
  | "local"
  | "loading"
  | "syncing"
  | "synced"
  | "error";

export function CloudSync({
  holdings,
  events,
  localReady,
  localHasData,
  onRestore,
}: {
  holdings: Holding[];
  events: PortfolioEvent[];
  localReady: boolean;
  localHasData: boolean;
  onRestore: (snapshot: PortfolioSnapshot) => void;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<SyncStatus>("checking");
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const revisionRef = useRef(0);
  const hydratedUserRef = useRef<string | null>(null);
  const lastSyncedRef = useRef("");
  const snapshotRef = useRef({ holdings, events, localHasData });
  const restoreRef = useRef(onRestore);

  useEffect(() => {
    snapshotRef.current = { holdings, events, localHasData };
  }, [events, holdings, localHasData]);

  useEffect(() => {
    restoreRef.current = onRestore;
  }, [onRestore]);

  const saveRemote = useCallback(
    async (userId: string, snapshot: PortfolioSnapshot) => {
      const supabase = getSupabaseBrowserClient();
      const nextRevision = revisionRef.current + 1;
      const updatedAt = new Date().toISOString();
      backupLocally(snapshot);

      const { data, error } = await supabase
        .from("portfolio_snapshots")
        .upsert(
          {
            user_id: userId,
            holdings: snapshot.holdings,
            events: snapshot.events,
            schema_version: 1,
            revision: nextRevision,
            updated_at: updatedAt,
          },
          { onConflict: "user_id" },
        )
        .select("revision, updated_at")
        .single();

      if (error) throw error;

      revisionRef.current = Number(data.revision ?? nextRevision);
      lastSyncedRef.current = fingerprint(snapshot);
      localStorage.setItem(CLOUD_OWNER_KEY, userId);
      return String(data.updated_at ?? updatedAt);
    },
    [],
  );

  const loadRemote = useCallback(
    async (nextUser: User) => {
      if (!localReady) return;

      hydratedUserRef.current = nextUser.id;
      setStatus("loading");
      setCloudReady(false);
      const local = snapshotRef.current;
      backupLocally(local);

      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("portfolio_snapshots")
          .select("holdings, events, revision, updated_at")
          .eq("user_id", nextUser.id)
          .maybeSingle();

        if (error) throw error;

        const remote = data as RemoteSnapshot | null;
        let next: PortfolioSnapshot;
        let needsUpload = false;

        if (remote) {
          revisionRef.current = Number(remote.revision ?? 0);
          const remoteSnapshot = normaliseSnapshot(remote);
          next = local.localHasData
            ? mergeSnapshots(remoteSnapshot, local)
            : remoteSnapshot;
          needsUpload = fingerprint(next) !== fingerprint(remoteSnapshot);
        } else {
          next = local.localHasData
            ? { holdings: local.holdings, events: local.events }
            : { holdings: [], events: [] };
          needsUpload = true;
        }

        restoreRef.current(next);

        if (needsUpload) {
          await saveRemote(nextUser.id, next);
        } else {
          lastSyncedRef.current = fingerprint(next);
          localStorage.setItem(CLOUD_OWNER_KEY, nextUser.id);
        }

        setCloudReady(true);
        setStatus("synced");
      } catch (error) {
        console.error("Min Sparing cloud load failed", error);
        hydratedUserRef.current = null;
        setStatus("error");
      }
    },
    [localReady, saveRemote],
  );

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        hydratedUserRef.current = null;
        setCloudReady(false);
        setStatus("local");
        return;
      }

      if (
        (event === "INITIAL_SESSION" || event === "SIGNED_IN") &&
        hydratedUserRef.current !== nextUser.id
      ) {
        queueMicrotask(() => void loadRemote(nextUser));
      }
    });

    return () => data.subscription.unsubscribe();
  }, [loadRemote]);

  useEffect(() => {
    if (
      user &&
      localReady &&
      hydratedUserRef.current !== user.id
    ) {
      queueMicrotask(() => void loadRemote(user));
    }
  }, [loadRemote, localReady, user]);

  useEffect(() => {
    if (!user || !localReady || !cloudReady) return;

    const snapshot = { holdings, events };
    if (fingerprint(snapshot) === lastSyncedRef.current) return;

    setStatus("syncing");
    const timer = window.setTimeout(() => {
      void saveRemote(user.id, snapshot)
        .then(() => setStatus("synced"))
        .catch((error) => {
          console.error("Min Sparing cloud save failed", error);
          setStatus("error");
        });
    }, SYNC_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [cloudReady, events, holdings, localReady, saveRemote, user]);

  const sendMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    setSending(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setMessage("Innloggingslenken er sendt. Åpne e-posten på enheten du bruker.");
    } catch (error) {
      console.error("Min Sparing sign-in failed", error);
      setMessage("Kunne ikke sende lenken. Kontroller e-postadressen og prøv igjen.");
    } finally {
      setSending(false);
    }
  };

  const signOut = async () => {
    try {
      await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
    } finally {
      setShowLogin(false);
    }
  };

  const label = statusLabel(status, Boolean(user));
  const Icon =
    status === "checking" || status === "loading" || status === "syncing"
      ? LoaderCircle
      : status === "synced"
        ? Check
        : user
          ? CloudOff
          : Cloud;

  return (
    <>
      <button
        className={`cloud-button ${status}`}
        onClick={() => setShowLogin(true)}
        aria-label={`${label}. Åpne konto og synkronisering.`}
      >
        <Icon
          size={14}
          className={
            status === "checking" || status === "loading" || status === "syncing"
              ? "spin"
              : undefined
          }
        />
        <span>{label}</span>
      </button>

      {showLogin ? (
        <div className="auth-layer" role="presentation">
          <button
            className="auth-scrim"
            aria-label="Lukk innlogging"
            onClick={() => setShowLogin(false)}
          />
          <section
            className="auth-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cloud-dialog-title"
          >
            <button
              className="auth-close"
              aria-label="Lukk"
              onClick={() => setShowLogin(false)}
            >
              <X size={18} />
            </button>
            <span className="auth-icon">
              <Cloud size={22} />
            </span>
            <p className="auth-kicker">MIN SPARING-KONTO</p>
            <h2 id="cloud-dialog-title">
              {user ? "Lagret på alle enheter" : "Ta sparingen med deg"}
            </h2>

            {user ? (
              <>
                <div className="auth-status-card">
                  <ShieldCheck size={19} />
                  <span>
                    <b>{statusLabel(status, true)}</b>
                    <small>{user.email}</small>
                  </span>
                </div>
                <p className="auth-copy">
                  Beholdninger og kjøpslogg ligger privat i skyen. Den lokale
                  kopien beholdes som reserve på denne enheten.
                </p>
                <button className="auth-secondary" onClick={signOut}>
                  <LogOut size={15} /> Logg ut på denne enheten
                </button>
              </>
            ) : (
              <>
                <p className="auth-copy">
                  Logg inn med e-post for å se samme portefølje på mobil, PC og
                  nettbrett. Du trenger ikke passord.
                </p>
                <form className="auth-form" onSubmit={sendMagicLink}>
                  <label htmlFor="cloud-email">E-postadresse</label>
                  <div>
                    <Mail size={16} />
                    <input
                      id="cloud-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="navn@epost.no"
                      required
                      autoFocus
                    />
                  </div>
                  <button type="submit" disabled={sending}>
                    {sending ? <LoaderCircle className="spin" size={15} /> : <Mail size={15} />}
                    {sending ? "Sender …" : "Send sikker innloggingslenke"}
                  </button>
                </form>
                {message ? <p className="auth-message">{message}</p> : null}
                <p className="auth-safety">
                  <ShieldCheck size={14} /> Dagens data slettes aldri under
                  flyttingen til skyen.
                </p>
              </>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

function normaliseSnapshot(snapshot: PortfolioSnapshot): PortfolioSnapshot {
  return {
    holdings: Array.isArray(snapshot.holdings) ? snapshot.holdings : [],
    events: Array.isArray(snapshot.events) ? snapshot.events : [],
  };
}

function mergeSnapshots(
  remote: PortfolioSnapshot,
  local: PortfolioSnapshot,
): PortfolioSnapshot {
  return {
    holdings: mergeById(remote.holdings, local.holdings),
    events: mergeById(remote.events, local.events),
  };
}

function mergeById<T extends { id: string }>(primary: T[], secondary: T[]) {
  const merged = new Map(primary.map((item) => [item.id, item]));
  for (const item of secondary) {
    if (!merged.has(item.id)) merged.set(item.id, item);
  }
  return [...merged.values()];
}

function fingerprint(snapshot: PortfolioSnapshot) {
  return JSON.stringify([snapshot.holdings, snapshot.events]);
}

function backupLocally(snapshot: PortfolioSnapshot) {
  localStorage.setItem(
    BACKUP_KEY,
    JSON.stringify({ ...snapshot, savedAt: new Date().toISOString() }),
  );
}

function statusLabel(status: SyncStatus, signedIn: boolean) {
  if (status === "checking") return "Sjekker lagring";
  if (status === "loading") return "Henter porteføljen";
  if (status === "syncing") return "Lagrer …";
  if (status === "synced") return "Synkronisert";
  if (status === "error") return "Synkfeil";
  return signedIn ? "Koblet til skyen" : "Kun på denne enheten";
}

