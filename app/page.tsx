"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type JobStatus = "actif" | "archive";
type PepResult = "conforme" | "a-corriger";

type Job = {
  id: string;
  unitNumber: string;
  workToDo: string;
  comments: string;
  date: string;
  status: JobStatus;
};

type OilChangeEntry = {
  id: string;
  unitNumber: string;
  date: string;
  mileage: string;
  oilType: string;
  filterChanged: "oui" | "non";
  comments: string;
};

type PepEntry = {
  id: string;
  unitNumber: string;
  date: string;
  mileage: string;
  result: PepResult;
  workRequired: string;
  comments: string;
};

type HistoryByUnit = Record<string, Job[]>;
type OilHistoryByUnit = Record<string, OilChangeEntry[]>;
type PepHistoryByUnit = Record<string, PepEntry[]>;

type JobFormState = {
  unitNumber: string;
  workToDo: string;
  comments: string;
  date: string;
};

type OilFormState = {
  unitNumber: string;
  date: string;
  mileage: string;
  oilType: string;
  filterChanged: "oui" | "non";
  comments: string;
};

type PepFormState = {
  unitNumber: string;
  date: string;
  mileage: string;
  result: PepResult;
  workRequired: string;
  comments: string;
};

const ACTIVE_STORAGE_KEY = "truck-job-tracker:active-jobs";
const JOB_HISTORY_STORAGE_KEY = "truck-job-tracker:job-history-by-unit";
const LEGACY_HISTORY_STORAGE_KEY = "truck-job-tracker:history-by-unit";
const OIL_HISTORY_STORAGE_KEY = "truck-job-tracker:oil-history-by-unit";
const PEP_HISTORY_STORAGE_KEY = "truck-job-tracker:pep-history-by-unit";

const defaultDate = () => new Date().toISOString().slice(0, 10);
const emptyJobForm = (): JobFormState => ({ unitNumber: "", workToDo: "", comments: "", date: defaultDate() });
const emptyOilForm = (): OilFormState => ({ unitNumber: "", date: defaultDate(), mileage: "", oilType: "", filterChanged: "oui", comments: "" });
const emptyPepForm = (): PepFormState => ({ unitNumber: "", date: defaultDate(), mileage: "", result: "conforme", workRequired: "", comments: "" });


const createUniqueId = () => `${Date.now()}-${Math.random()}`;

function dedupeJobsById(jobs: Job[]): Job[] {
  return jobs.filter((job, index, self) => index === self.findIndex((j) => j.id === job.id));
}

function dedupeHistoryByUnit(history: HistoryByUnit): HistoryByUnit {
  const next: HistoryByUnit = {};
  Object.entries(history).forEach(([unit, jobs]) => {
    next[unit] = dedupeJobsById(jobs);
  });
  return next;
}

function normalizeJob(raw: Partial<Job>): Job | null {
  const id = typeof raw.id === "string" ? raw.id : "";
  const unitNumber = typeof raw.unitNumber === "string" ? raw.unitNumber : "";
  const workToDo = typeof raw.workToDo === "string" ? raw.workToDo : "";
  const date = typeof raw.date === "string" ? raw.date : "";
  if (!id || !unitNumber || !workToDo || !date) return null;
  return { id, unitNumber, workToDo, comments: typeof raw.comments === "string" ? raw.comments : "", date, status: raw.status === "archive" ? "archive" : "actif" };
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

  useEffect(() => {
    try {
      const savedActive = localStorage.getItem(ACTIVE_STORAGE_KEY);
      const savedHistory = localStorage.getItem(JOB_HISTORY_STORAGE_KEY);
      const legacyHistory = localStorage.getItem(LEGACY_HISTORY_STORAGE_KEY);
      const savedOilHistory = localStorage.getItem(OIL_HISTORY_STORAGE_KEY);
      const savedPepHistory = localStorage.getItem(PEP_HISTORY_STORAGE_KEY);

      if (savedActive) {
        const parsedActive = JSON.parse(savedActive) as Partial<Job>[];
        if (Array.isArray(parsedActive)) {
          setActiveJobs(parsedActive.map(normalizeJob).filter((job): job is Job => Boolean(job)).map((job) => ({ ...job, status: "actif" })));
        }
      }

      const historySource = savedHistory ?? legacyHistory;

      if (historySource) {
        const parsed = JSON.parse(historySource) as Record<string, Partial<Job>[]>;
        const next: HistoryByUnit = {};
        Object.entries(parsed ?? {}).forEach(([unit, jobs]) => {
          if (!Array.isArray(jobs)) return;
          next[unit] = jobs.map(normalizeJob).filter((job): job is Job => Boolean(job)).map((job) => ({ ...job, status: "archive" }));
        });
        const cleanedHistory = dedupeHistoryByUnit(next);
        setHistoryByUnit(cleanedHistory);
        localStorage.setItem(JOB_HISTORY_STORAGE_KEY, JSON.stringify(cleanedHistory));

      }

      if (savedOilHistory) setOilHistoryByUnit(JSON.parse(savedOilHistory) as OilHistoryByUnit);
      if (savedPepHistory) setPepHistoryByUnit(JSON.parse(savedPepHistory) as PepHistoryByUnit);
    } catch {
      setActiveJobs([]);
      setHistoryByUnit({});
      setOilHistoryByUnit({});
      setPepHistoryByUnit({});
    }
  }, []);

  useEffect(() => localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(activeJobs)), [activeJobs]);
  useEffect(() => localStorage.setItem(JOB_HISTORY_STORAGE_KEY, JSON.stringify(historyByUnit)), [historyByUnit]);
  useEffect(() => localStorage.setItem(OIL_HISTORY_STORAGE_KEY, JSON.stringify(oilHistoryByUnit)), [oilHistoryByUnit]);
  useEffect(() => localStorage.setItem(PEP_HISTORY_STORAGE_KEY, JSON.stringify(pepHistoryByUnit)), [pepHistoryByUnit]);

  function addJob(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const unitNumber = jobForm.unitNumber.trim();
    const workToDo = jobForm.workToDo.trim();
    if (!unitNumber || !workToDo || !jobForm.date) return;
    setActiveJobs((c) => [{ id: createUniqueId(), unitNumber, workToDo, comments: jobForm.comments.trim(), date: jobForm.date, status: "actif" }, ...c]);
    setJobForm(emptyJobForm());
  }

  function markJobAsDone(jobId: string) {
    console.log("[markJobAsDone] called for job", jobId);
    setActiveJobs((currentActive) => {
      const job = currentActive.find((j) => j.id === jobId);
      if (!job) return currentActive;

      const archivedJob: Job = { ...job, status: "archive" };
      setHistoryByUnit((h) => {
        const unitHistory = h[archivedJob.unitNumber] ?? [];
        const alreadyExists = unitHistory.some((entry) => entry.id === archivedJob.id);
        if (alreadyExists) {
          console.log("[markJobAsDone] duplicate blocked for job", archivedJob.id);
          return h;
        }

        return { ...h, [archivedJob.unitNumber]: [archivedJob, ...unitHistory] };
      });

      return currentActive.filter((j) => j.id !== jobId);
    });
  }

  function addOilChange(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: OilChangeEntry = { id: crypto.randomUUID(), unitNumber: oilForm.unitNumber.trim(), date: oilForm.date, mileage: oilForm.mileage.trim(), oilType: oilForm.oilType.trim(), filterChanged: oilForm.filterChanged, comments: oilForm.comments.trim() };
    if (!next.unitNumber || !next.date || !next.mileage || !next.oilType) return;
    setOilHistoryByUnit((h) => ({ ...h, [next.unitNumber]: [next, ...(h[next.unitNumber] ?? [])] }));
    setOilForm(emptyOilForm());
  }

  function addPep(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: PepEntry = { id: crypto.randomUUID(), unitNumber: pepForm.unitNumber.trim(), date: pepForm.date, mileage: pepForm.mileage.trim(), result: pepForm.result, workRequired: pepForm.workRequired.trim(), comments: pepForm.comments.trim() };
    if (!next.unitNumber || !next.date || !next.mileage || !next.workRequired) return;
    setPepHistoryByUnit((h) => ({ ...h, [next.unitNumber]: [next, ...(h[next.unitNumber] ?? [])] }));
    setPepForm(emptyPepForm());
  }

  const sortedActiveJobs = useMemo(() => [...activeJobs].sort((a, b) => b.date.localeCompare(a.date)), [activeJobs]);
  const sortedUnits = useMemo(() => {
    const set = new Set<string>([...Object.keys(historyByUnit), ...Object.keys(oilHistoryByUnit), ...Object.keys(pepHistoryByUnit)]);
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  }, [historyByUnit, oilHistoryByUnit, pepHistoryByUnit]);

  return <main className="mx-auto min-h-screen w-full max-w-6xl bg-slate-50 p-4 text-slate-900 md:p-6">{/* UI omitted for brevity in dev */}
    <h1 className="mb-6 text-3xl font-bold">Truck Job Tracker</h1>
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6"><h2 className="mb-4 text-xl font-semibold">Travaux à effectuer</h2><form onSubmit={addJob} className="grid gap-3 sm:grid-cols-2"><input type="text" value={jobForm.unitNumber} onChange={(e)=>setJobForm((c)=>({...c,unitNumber:e.target.value}))} placeholder="Numéro d’unité" className="rounded-lg border border-slate-300 p-2" required/><input type="date" value={jobForm.date} onChange={(e)=>setJobForm((c)=>({...c,date:e.target.value}))} className="rounded-lg border border-slate-300 p-2" required/><textarea value={jobForm.workToDo} onChange={(e)=>setJobForm((c)=>({...c,workToDo:e.target.value}))} placeholder="Travaux à effectuer" className="min-h-24 rounded-lg border border-slate-300 p-2 sm:col-span-2" required/><textarea value={jobForm.comments} onChange={(e)=>setJobForm((c)=>({...c,comments:e.target.value}))} placeholder="Commentaires" className="min-h-20 rounded-lg border border-slate-300 p-2 sm:col-span-2"/><button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white sm:col-span-2">Ajouter</button></form></section>

    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6"><h2 className="mb-4 text-xl font-semibold">Changement d’huile</h2><form onSubmit={addOilChange} className="grid gap-3 sm:grid-cols-2"><input type="text" value={oilForm.unitNumber} onChange={(e)=>setOilForm((c)=>({...c,unitNumber:e.target.value}))} placeholder="Numéro d’unité" className="rounded-lg border border-slate-300 p-2" required/><input type="date" value={oilForm.date} onChange={(e)=>setOilForm((c)=>({...c,date:e.target.value}))} className="rounded-lg border border-slate-300 p-2" required/><input type="text" value={oilForm.mileage} onChange={(e)=>setOilForm((c)=>({...c,mileage:e.target.value}))} placeholder="Kilométrage" className="rounded-lg border border-slate-300 p-2" required/><input type="text" value={oilForm.oilType} onChange={(e)=>setOilForm((c)=>({...c,oilType:e.target.value}))} placeholder="Type d’huile" className="rounded-lg border border-slate-300 p-2" required/><select value={oilForm.filterChanged} onChange={(e)=>setOilForm((c)=>({...c,filterChanged:e.target.value as "oui"|"non"}))} className="rounded-lg border border-slate-300 p-2"><option value="oui">Filtre changé : oui</option><option value="non">Filtre changé : non</option></select><textarea value={oilForm.comments} onChange={(e)=>setOilForm((c)=>({...c,comments:e.target.value}))} placeholder="Commentaires" className="min-h-20 rounded-lg border border-slate-300 p-2 sm:col-span-2"/><button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white sm:col-span-2">Ajouter</button></form></section>

    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6"><h2 className="mb-4 text-xl font-semibold">PEP / inspection préventive</h2><form onSubmit={addPep} className="grid gap-3 sm:grid-cols-2"><input type="text" value={pepForm.unitNumber} onChange={(e)=>setPepForm((c)=>({...c,unitNumber:e.target.value}))} placeholder="Numéro d’unité" className="rounded-lg border border-slate-300 p-2" required/><input type="date" value={pepForm.date} onChange={(e)=>setPepForm((c)=>({...c,date:e.target.value}))} className="rounded-lg border border-slate-300 p-2" required/><input type="text" value={pepForm.mileage} onChange={(e)=>setPepForm((c)=>({...c,mileage:e.target.value}))} placeholder="Kilométrage" className="rounded-lg border border-slate-300 p-2" required/><select value={pepForm.result} onChange={(e)=>setPepForm((c)=>({...c,result:e.target.value as PepResult}))} className="rounded-lg border border-slate-300 p-2"><option value="conforme">Conforme</option><option value="a-corriger">À corriger</option></select><textarea value={pepForm.workRequired} onChange={(e)=>setPepForm((c)=>({...c,workRequired:e.target.value}))} placeholder="Travaux à faire" className="min-h-20 rounded-lg border border-slate-300 p-2 sm:col-span-2" required/><textarea value={pepForm.comments} onChange={(e)=>setPepForm((c)=>({...c,comments:e.target.value}))} placeholder="Commentaires" className="min-h-20 rounded-lg border border-slate-300 p-2 sm:col-span-2"/><button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white sm:col-span-2">Ajouter</button></form></section>

    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6"><h2 className="mb-4 text-xl font-semibold">Travaux actifs</h2>{sortedActiveJobs.length===0?<p className="text-slate-600">Aucun travail actif.</p>:<table className="w-full text-left"><thead><tr><th className="p-2">Unité</th><th className="p-2">Travail</th><th className="p-2">Date</th><th className="p-2">Fait</th></tr></thead><tbody>{sortedActiveJobs.map((j)=><tr key={j.id} className="border-t"><td className="p-2">{j.unitNumber}</td><td className="p-2 whitespace-pre-line">{j.workToDo}</td><td className="p-2">{j.date}</td><td className="p-2"><input type="checkbox" onChange={()=>markJobAsDone(j.id)} aria-label="Marquer comme fait"/></td></tr>)}</tbody></table>}</section>

    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6"><div className="mb-4 flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">Historique par unité (verrouillé)</h2><select value={selectedUnitHistory} onChange={(e)=>setSelectedUnitHistory(e.target.value)} className="rounded-lg border border-slate-300 p-2"><option value="">Voir historique d’une unité</option>{sortedUnits.map((u)=><option key={u} value={u}>Unité {u}</option>)}</select><button type="button" onClick={()=>setHistoryByUnit((h)=>dedupeHistoryByUnit(h))} className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">Nettoyer les doublons</button></div>{sortedUnits.length===0?<p className="text-slate-600">Aucun historique pour le moment.</p>:<div className="space-y-5">{(selectedUnitHistory?[selectedUnitHistory]:sortedUnits).map((unit)=><div key={unit} className="rounded-lg border border-slate-200 p-3"><h3 className="mb-3 font-semibold">Unité {unit}</h3><div className="space-y-4"><div><h4 className="font-semibold">Travaux effectués</h4>{(historyByUnit[unit]??[]).length===0?<p className="text-sm text-slate-600">Aucune entrée.</p>:<ul className="list-disc pl-6">{(historyByUnit[unit]??[]).map((j)=><li key={j.id}>{j.date} — {j.workToDo}</li>)}</ul>}</div><div><h4 className="font-semibold">Changements d’huile</h4>{(oilHistoryByUnit[unit]??[]).length===0?<p className="text-sm text-slate-600">Aucune entrée.</p>:<ul className="list-disc pl-6">{(oilHistoryByUnit[unit]??[]).map((o)=><li key={o.id}>{o.date} — {o.mileage} km — {o.oilType} — Filtre: {o.filterChanged}</li>)}</ul>}</div><div><h4 className="font-semibold">PEP / inspections</h4>{(pepHistoryByUnit[unit]??[]).length===0?<p className="text-sm text-slate-600">Aucune entrée.</p>:<ul className="list-disc pl-6">{(pepHistoryByUnit[unit]??[]).map((p)=><li key={p.id}>{p.date} — {p.result} — {p.workRequired}</li>)}</ul>}</div></div></div>)}</div>}</section>
  </main>;
}
