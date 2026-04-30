"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type JobStatus = "actif" | "archive";
type PepResult = "conforme" | "a-corriger";

type Job = { id: string; unitNumber: string; workToDo: string; comments: string; date: string; status: JobStatus };
type OilChangeEntry = { id: string; unitNumber: string; date: string; mileage: string; oilType: string; filterChanged: "oui" | "non"; comments: string };
type PepEntry = { id: string; unitNumber: string; date: string; mileage: string; result: PepResult; workRequired: string; comments: string };

type HistoryByUnit = Record<string, Job[]>;
type OilHistoryByUnit = Record<string, OilChangeEntry[]>;
type PepHistoryByUnit = Record<string, PepEntry[]>;

type JobFormState = { unitNumber: string; workToDo: string; comments: string; date: string };
type OilFormState = { unitNumber: string; date: string; mileage: string; oilType: string; filterChanged: "oui" | "non"; comments: string };
type PepFormState = { unitNumber: string; date: string; mileage: string; result: PepResult; workRequired: string; comments: string };

type ScanResult = {
  jobHistory: HistoryByUnit;
  oilHistory: OilHistoryByUnit;
  pepHistory: PepHistoryByUnit;
  totalRecovered: number;
  restoredUnits: string[];
  matchedKeys: string[];
};

const ACTIVE_STORAGE_KEY = "truck-job-tracker:active-jobs";
const JOB_HISTORY_STORAGE_KEY = "truck-job-tracker:job-history-by-unit";
const LEGACY_HISTORY_STORAGE_KEY = "truck-job-tracker:history-by-unit";
const OIL_HISTORY_STORAGE_KEY = "truck-job-tracker:oil-history-by-unit";
const PEP_HISTORY_STORAGE_KEY = "truck-job-tracker:pep-history-by-unit";
const APP_PREFIX = "truck-job-tracker";

const defaultDate = () => new Date().toISOString().slice(0, 10);
const emptyJobForm = (): JobFormState => ({ unitNumber: "", workToDo: "", comments: "", date: defaultDate() });
const emptyOilForm = (): OilFormState => ({ unitNumber: "", date: defaultDate(), mileage: "", oilType: "", filterChanged: "oui", comments: "" });
const emptyPepForm = (): PepFormState => ({ unitNumber: "", date: defaultDate(), mileage: "", result: "conforme", workRequired: "", comments: "" });

const oldKeyHints = ["truckjobs", "jobs", "completedjobs", "history", "vehiclehistory", "oilchanges", "pepinspections", "inspection", "truck-job-tracker"];

function normalizeJob(raw: Partial<Job>): Job | null {
  const id = typeof raw.id === "string" ? raw.id : crypto.randomUUID();
  const unitNumber = typeof raw.unitNumber === "string" ? raw.unitNumber.trim() : "";
  const workToDo = typeof raw.workToDo === "string" ? raw.workToDo : "";
  const date = typeof raw.date === "string" ? raw.date : "";
  if (!unitNumber || !workToDo || !date) return null;
  return { id, unitNumber, workToDo, comments: typeof raw.comments === "string" ? raw.comments : "", date, status: raw.status === "archive" ? "archive" : "actif" };
}

function normalizeObject<T>(value: unknown): Record<string, T[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, T[]>;
}

export default function Home() {
  const [jobForm, setJobForm] = useState<JobFormState>(emptyJobForm());
  const [oilForm, setOilForm] = useState<OilFormState>(emptyOilForm());
  const [pepForm, setPepForm] = useState<PepFormState>(emptyPepForm());
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [historyByUnit, setHistoryByUnit] = useState<HistoryByUnit>({});
  const [oilHistoryByUnit, setOilHistoryByUnit] = useState<OilHistoryByUnit>({});
  const [pepHistoryByUnit, setPepHistoryByUnit] = useState<PepHistoryByUnit>({});
  const [selectedUnitHistory, setSelectedUnitHistory] = useState<string>("");
  const [diagRows, setDiagRows] = useState<Array<{ key: string; raw: string }>>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [migrationMessage, setMigrationMessage] = useState<string>("");

  useEffect(() => {
    try {
      const savedActive = localStorage.getItem(ACTIVE_STORAGE_KEY);
      const savedHistory = localStorage.getItem(JOB_HISTORY_STORAGE_KEY);
      const legacyHistory = localStorage.getItem(LEGACY_HISTORY_STORAGE_KEY);
      const savedOilHistory = localStorage.getItem(OIL_HISTORY_STORAGE_KEY);
      const savedPepHistory = localStorage.getItem(PEP_HISTORY_STORAGE_KEY);
      if (savedActive) setActiveJobs((JSON.parse(savedActive) as Partial<Job>[]).map(normalizeJob).filter(Boolean).map((x) => ({ ...(x as Job), status: "actif" })));
      const historySource = savedHistory ?? legacyHistory;
      if (historySource) {
        const parsed = normalizeObject<Partial<Job>>(JSON.parse(historySource));
        const next: HistoryByUnit = {};
        Object.entries(parsed).forEach(([unit, jobs]) => {
          if (!Array.isArray(jobs)) return;
          next[unit] = jobs.map(normalizeJob).filter((job): job is Job => Boolean(job)).map((job) => ({ ...job, status: "archive" }));
        });
        setHistoryByUnit(next);
        if (!savedHistory && legacyHistory) localStorage.setItem(JOB_HISTORY_STORAGE_KEY, JSON.stringify(next));
      }
      if (savedOilHistory) setOilHistoryByUnit(JSON.parse(savedOilHistory) as OilHistoryByUnit);
      if (savedPepHistory) setPepHistoryByUnit(JSON.parse(savedPepHistory) as PepHistoryByUnit);
    } catch {
      setActiveJobs([]); setHistoryByUnit({}); setOilHistoryByUnit({}); setPepHistoryByUnit({});
    }
  }, []);

  useEffect(() => localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(activeJobs)), [activeJobs]);
  useEffect(() => localStorage.setItem(JOB_HISTORY_STORAGE_KEY, JSON.stringify(historyByUnit)), [historyByUnit]);
  useEffect(() => localStorage.setItem(OIL_HISTORY_STORAGE_KEY, JSON.stringify(oilHistoryByUnit)), [oilHistoryByUnit]);
  useEffect(() => localStorage.setItem(PEP_HISTORY_STORAGE_KEY, JSON.stringify(pepHistoryByUnit)), [pepHistoryByUnit]);

  function refreshDiagnostics() {
    const rows: Array<{ key: string; raw: string }> = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      rows.push({ key, raw: localStorage.getItem(key) ?? "" });
    }
    setDiagRows(rows.sort((a, b) => a.key.localeCompare(b.key, "fr")));
  }

  function scanLegacyData() {
    const matchedKeys: string[] = [];
    const recoveredJobs: HistoryByUnit = {};
    const recoveredOil: OilHistoryByUnit = {};
    const recoveredPep: PepHistoryByUnit = {};
    const pushJob = (unit: string, raw: Partial<Job>) => {
      const job = normalizeJob({ ...raw, unitNumber: raw.unitNumber ?? unit, status: "archive" });
      if (!job) return;
      recoveredJobs[job.unitNumber] = [job, ...(recoveredJobs[job.unitNumber] ?? [])];
    };
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const lowered = key.toLowerCase();
      if (!oldKeyHints.some((hint) => lowered.includes(hint))) continue;
      matchedKeys.push(key);
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          for (const item of parsed as Array<Record<string, unknown>>) {
            const unit = String(item.unitNumber ?? item.unit ?? "").trim();
            if (!unit) continue;
            const kind = lowered;
            if (kind.includes("oil")) {
              const entry: OilChangeEntry = { id: String(item.id ?? crypto.randomUUID()), unitNumber: unit, date: String(item.date ?? ""), mileage: String(item.mileage ?? ""), oilType: String(item.oilType ?? item.type ?? ""), filterChanged: item.filterChanged === "non" ? "non" : "oui", comments: String(item.comments ?? "") };
              if (entry.date && entry.mileage && entry.oilType) recoveredOil[unit] = [entry, ...(recoveredOil[unit] ?? [])];
            } else if (kind.includes("pep") || kind.includes("inspection")) {
              const entry: PepEntry = { id: String(item.id ?? crypto.randomUUID()), unitNumber: unit, date: String(item.date ?? ""), mileage: String(item.mileage ?? ""), result: item.result === "a-corriger" ? "a-corriger" : "conforme", workRequired: String(item.workRequired ?? item.workToDo ?? ""), comments: String(item.comments ?? "") };
              if (entry.date && entry.mileage && entry.workRequired) recoveredPep[unit] = [entry, ...(recoveredPep[unit] ?? [])];
            } else {
              pushJob(unit, { id: String(item.id ?? crypto.randomUUID()), unitNumber: unit, workToDo: String(item.workToDo ?? item.work ?? item.title ?? ""), comments: String(item.comments ?? ""), date: String(item.date ?? ""), status: "archive" });
            }
          }
        } else if (parsed && typeof parsed === "object") {
          const record = parsed as Record<string, unknown>;
          Object.entries(record).forEach(([unit, entries]) => {
            if (!Array.isArray(entries)) return;
            entries.forEach((entry) => {
              pushJob(unit, entry as Partial<Job>);
            });
          });
        }
      } catch {
        // ignore invalid JSON keys
      }
    }
    const restoredUnits = [...new Set([...Object.keys(recoveredJobs), ...Object.keys(recoveredOil), ...Object.keys(recoveredPep)])].sort((a, b) => a.localeCompare(b, "fr"));
    const totalRecovered = Object.values(recoveredJobs).flat().length + Object.values(recoveredOil).flat().length + Object.values(recoveredPep).flat().length;
    setScanResult({ jobHistory: recoveredJobs, oilHistory: recoveredOil, pepHistory: recoveredPep, totalRecovered, restoredUnits, matchedKeys });
    setMigrationMessage("");
  }

  function makeBackupKey() {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `truckJobTracker_backup_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function exportBackup() {
    const all: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key) all[key] = localStorage.getItem(key);
    }
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `truck-job-tracker-localStorage-${defaultDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(e: FormEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Record<string, string | null>;
        Object.entries(parsed).forEach(([key, value]) => {
          if (typeof value === "string") localStorage.setItem(key, value);
        });
        refreshDiagnostics();
        setMigrationMessage("Sauvegarde importée. Rechargez la page pour relire les états.");
      } catch {
        setMigrationMessage("Import JSON invalide.");
      }
    };
    reader.readAsText(file);
  }

  function reimportScanResult() {
    if (!scanResult || scanResult.totalRecovered === 0) return;
    const snapshot: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(APP_PREFIX) || oldKeyHints.some((hint) => key.toLowerCase().includes(hint))) snapshot[key] = localStorage.getItem(key);
    }
    localStorage.setItem(makeBackupKey(), JSON.stringify(snapshot));

    setHistoryByUnit((curr) => ({ ...curr, ...Object.fromEntries(Object.entries(scanResult.jobHistory).map(([u, v]) => [u, [...v, ...(curr[u] ?? [])]])) }));
    setOilHistoryByUnit((curr) => ({ ...curr, ...Object.fromEntries(Object.entries(scanResult.oilHistory).map(([u, v]) => [u, [...v, ...(curr[u] ?? [])]])) }));
    setPepHistoryByUnit((curr) => ({ ...curr, ...Object.fromEntries(Object.entries(scanResult.pepHistory).map(([u, v]) => [u, [...v, ...(curr[u] ?? [])]])) }));

    setMigrationMessage(`${scanResult.totalRecovered} éléments retrouvés et ajoutés à l’historique. Unités restaurées: ${scanResult.restoredUnits.join(", ") || "aucune"}.`);
  }

  const sortedActiveJobs = useMemo(() => [...activeJobs].sort((a, b) => b.date.localeCompare(a.date)), [activeJobs]);
  const sortedUnits = useMemo(() => [...new Set<string>([...Object.keys(historyByUnit), ...Object.keys(oilHistoryByUnit), ...Object.keys(pepHistoryByUnit)])].sort((a, b) => a.localeCompare(b, "fr")), [historyByUnit, oilHistoryByUnit, pepHistoryByUnit]);

  return <main className="mx-auto min-h-screen w-full max-w-6xl bg-slate-50 p-4 text-slate-900 md:p-6"><h1 className="mb-6 text-3xl font-bold">Truck Job Tracker</h1>
    <section className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm md:p-6"><h2 className="mb-3 text-xl font-semibold">Diagnostic localStorage (temporaire)</h2><div className="mb-3 flex flex-wrap gap-2"><button onClick={refreshDiagnostics} className="rounded-lg bg-slate-700 px-3 py-2 text-white">Afficher clés localStorage</button><button onClick={scanLegacyData} className="rounded-lg bg-amber-600 px-3 py-2 text-white">Scanner les anciennes données</button><button onClick={reimportScanResult} className="rounded-lg bg-green-700 px-3 py-2 text-white">Réimporter l’historique trouvé</button><button onClick={exportBackup} className="rounded-lg bg-blue-700 px-3 py-2 text-white">Exporter sauvegarde JSON</button><label className="rounded-lg bg-indigo-700 px-3 py-2 text-white cursor-pointer">Importer sauvegarde JSON<input type="file" accept="application/json" className="hidden" onInput={importBackup} /></label></div>{migrationMessage && <p className="mb-3 font-semibold text-green-800">{migrationMessage}</p>}{scanResult && <p className="mb-3 text-sm text-slate-700">Clés détectées: {scanResult.matchedKeys.join(", ") || "aucune"}.</p>}<div className="max-h-64 overflow-auto rounded border border-slate-300 bg-white p-2 text-xs">{diagRows.length === 0 ? <p>Aucune donnée affichée.</p> : diagRows.map((row) => <pre key={row.key} className="mb-2 whitespace-pre-wrap"><strong>{row.key}</strong>{"\n"}{row.raw}</pre>)}</div></section>
  </main>;
}
