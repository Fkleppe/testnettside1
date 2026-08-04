"use client";

import { useEffect, useRef, useState } from "react";
import {
  DownloadCloud,
  FileWarning,
  History,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import {
  exportPortfolioJson,
  getCorruptPayloads,
  listBackups,
  parseImportedJson,
  restoreBackup,
  type BackupEntry,
  type PortfolioData,
} from "@/lib/storage";

const backupDate = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Oslo",
});

function downloadFile(name: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DataSafetyPanel({
  data,
  isDemo,
  corruptKey,
  onReplace,
}: {
  data: PortfolioData;
  isDemo: boolean;
  corruptKey: string | null;
  onReplace: (data: PortfolioData) => void;
}) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [pendingImport, setPendingImport] = useState<{
    data: PortfolioData;
    droppedItems: number;
    fileName: string;
  } | null>(null);
  const [message, setMessage] = useState("");

  const refreshBackups = () => setBackups(listBackups(localStorage));
  useEffect(() => {
    // Kjøres etter forelderens lagringseffekt, som skriver første backup.
    const timer = setTimeout(refreshBackups, 250);
    return () => clearTimeout(timer);
  }, [data]);

  const handleExport = () => {
    downloadFile(
      `minsparing-${new Date().toISOString().slice(0, 10)}.json`,
      exportPortfolioJson(data),
    );
    setMessage("Kopi lastet ned. Oppbevar den trygt.");
  };

  const handleFile = async (file: File) => {
    const result = parseImportedJson(await file.text());
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setPendingImport({
      data: result.data,
      droppedItems: result.droppedItems,
      fileName: file.name,
    });
    setMessage("");
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    onReplace(pendingImport.data);
    setPendingImport(null);
    setMessage(
      `Importerte ${pendingImport.data.holdings.length} beholdninger fra ${pendingImport.fileName}.`,
    );
    refreshBackups();
  };

  const handleRestore = (key: string) => {
    const restored = restoreBackup(localStorage, key);
    if (!restored) {
      setMessage("Kunne ikke lese denne sikkerhetskopien.");
      return;
    }
    onReplace(restored);
    setMessage("Sikkerhetskopi gjenopprettet.");
    refreshBackups();
  };

  const downloadCorrupt = () => {
    const [latest] = getCorruptPayloads(localStorage);
    if (latest) downloadFile("minsparing-raadata.json", latest.raw);
  };

  return (
    <section className="data-card safety-card" id="sikkerhet">
      <div className="card-title-row">
        <div>
          <h2>Sikkerhet</h2>
          <span>Dataene lagres kun på denne enheten</span>
        </div>
        <ShieldCheck size={16} />
      </div>
      {corruptKey ? (
        <div className="safety-alert">
          <FileWarning size={18} />
          <p>
            <b>Fant data som ikke kunne leses.</b>
            <span>
              Ingenting er slettet – last ned råkopien og send den til support,
              eller gjenopprett en sikkerhetskopi under.
            </span>
          </p>
          <button onClick={downloadCorrupt}>Last ned råkopi</button>
        </div>
      ) : null}
      <div className="safety-actions">
        <button onClick={handleExport} disabled={isDemo}>
          <DownloadCloud size={14} /> Last ned kopi
        </button>
        <button onClick={() => fileInput.current?.click()}>
          <UploadCloud size={14} /> Importer kopi
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />
      </div>
      {pendingImport ? (
        <div className="safety-alert">
          <FileWarning size={18} />
          <p>
            <b>
              Erstatte dagens portefølje med {pendingImport.data.holdings.length}{" "}
              beholdninger fra {pendingImport.fileName}?
            </b>
            <span>
              {pendingImport.droppedItems
                ? `${pendingImport.droppedItems} rader i filen kunne ikke leses og hoppes over. `
                : ""}
              Dagens data sikkerhetskopieres automatisk først.
            </span>
          </p>
          <button onClick={confirmImport}>Bekreft</button>
          <button className="ghost" onClick={() => setPendingImport(null)}>
            Avbryt
          </button>
        </div>
      ) : null}
      <div className="backup-list">
        <p className="backup-heading">
          <History size={13} /> Automatiske sikkerhetskopier
        </p>
        {backups.length ? (
          backups.slice(0, 5).map((backup) => (
            <div className="backup-row" key={backup.key}>
              <span>
                {backup.savedAt
                  ? backupDate.format(new Date(backup.savedAt))
                  : "Ukjent tidspunkt"}
                <small> · {backup.holdingsCount} beholdninger</small>
              </span>
              <button onClick={() => handleRestore(backup.key)}>
                Gjenopprett
              </button>
            </div>
          ))
        ) : (
          <small className="backup-empty">
            Opprettes automatisk når du gjør endringer.
          </small>
        )}
      </div>
      {message ? <small className="safety-message">{message}</small> : null}
    </section>
  );
}
