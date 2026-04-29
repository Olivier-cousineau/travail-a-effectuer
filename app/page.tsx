"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type JobStatus = "actif" | "archive";

type Job = {
  id: string;
  unitNumber: string;
  workToDo: string;
  comments: string;
  date: string;
  status: JobStatus;
};

type HistoryByUnit = Record<string, Job[]>;

type FormState = {
  unitNumber: string;
  workToDo: string;
  comments: string;
  date: string;
};

const ACTIVE_STORAGE_KEY = "truck-job-tracker:active-jobs";
const HISTORY_STORAGE_KEY = "truck-job-tracker:history-by-unit";

const defaultDate = () => new Date().toISOString().slice(0, 10);

function normalizeJob(raw: Partial<Job>): Job | null {
  const id = typeof raw.id === "string" ? raw.id : "";
  const unitNumber = typeof raw.unitNumber === "string" ? raw.unitNumber : "";
  const workToDo = typeof raw.workToDo === "string" ? raw.workToDo : "";
  const date = typeof raw.date === "string" ? raw.date : "";

  if (!id || !unitNumber || !workToDo || !date) return null;

  return {
    id,
    unitNumber,
    workToDo,
    comments: typeof raw.comments === "string" ? raw.comments : "",
    date,
    status: raw.status === "archive" ? "archive" : "actif",
  };
}

export default function Home() {
  const [form, setForm] = useState<FormState>({
    unitNumber: "",
    workToDo: "",
    comments: "",
    date: defaultDate(),
  });
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [historyByUnit, setHistoryByUnit] = useState<HistoryByUnit>({});
  const [selectedUnitHistory, setSelectedUnitHistory] = useState<string>("");

  useEffect(() => {
    try {
      const savedActive = localStorage.getItem(ACTIVE_STORAGE_KEY);
      const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);

      if (savedActive) {
        const parsedActive = JSON.parse(savedActive) as Partial<Job>[];
        if (Array.isArray(parsedActive)) {
          setActiveJobs(parsedActive.map(normalizeJob).filter((job): job is Job => Boolean(job)).map((job) => ({ ...job, status: "actif" })));
        }
      }

      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory) as Record<string, Partial<Job>[]>;
        if (parsedHistory && typeof parsedHistory === "object") {
          const nextHistory: HistoryByUnit = {};
          Object.entries(parsedHistory).forEach(([unit, jobs]) => {
            if (!Array.isArray(jobs)) return;
            nextHistory[unit] = jobs
              .map(normalizeJob)
              .filter((job): job is Job => Boolean(job))
              .map((job) => ({ ...job, status: "archive" }));
          });
          setHistoryByUnit(nextHistory);
        }
      }
    } catch {
      setActiveJobs([]);
      setHistoryByUnit({});
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(activeJobs));
  }, [activeJobs]);

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyByUnit));
  }, [historyByUnit]);

  function addJob(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const newJob: Job = {
      id: crypto.randomUUID(),
      unitNumber: form.unitNumber.trim(),
      workToDo: form.workToDo.trim(),
      comments: form.comments.trim(),
      date: form.date,
      status: "actif",
    };

    if (!newJob.unitNumber || !newJob.workToDo || !newJob.date) return;

    setActiveJobs((current) => [newJob, ...current]);
    setForm({ unitNumber: "", workToDo: "", comments: "", date: defaultDate() });
  }

  function markJobAsDone(jobId: string) {
    setActiveJobs((currentActive) => {
      const job = currentActive.find((j) => j.id === jobId);
      if (!job) return currentActive;

      const archivedJob: Job = { ...job, status: "archive" };

      setHistoryByUnit((currentHistory) => {
        const unit = archivedJob.unitNumber;
        const existing = currentHistory[unit] ?? [];
        return {
          ...currentHistory,
          [unit]: [archivedJob, ...existing],
        };
      });

      return currentActive.filter((j) => j.id !== jobId);
    });
  }

  function deleteActiveJob(jobId: string) {
    setActiveJobs((current) => current.filter((j) => j.id !== jobId));
  }

  const sortedActiveJobs = useMemo(() => [...activeJobs].sort((a, b) => b.date.localeCompare(a.date)), [activeJobs]);
  const sortedUnits = useMemo(() => Object.keys(historyByUnit).sort((a, b) => a.localeCompare(b, "fr")), [historyByUnit]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl bg-slate-50 p-4 text-slate-900 md:p-6">
      <h1 className="mb-6 text-3xl font-bold">Truck Job Tracker</h1>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="mb-4 text-xl font-semibold">Ajouter un travail</h2>
        <form onSubmit={addJob} className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={form.unitNumber}
            onChange={(e) => setForm((c) => ({ ...c, unitNumber: e.target.value }))}
            placeholder="Numéro d’unité (ex: 1111)"
            className="rounded-lg border border-slate-300 p-2"
            required
          />
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))}
            className="rounded-lg border border-slate-300 p-2"
            required
          />
          <textarea
            value={form.workToDo}
            onChange={(e) => setForm((c) => ({ ...c, workToDo: e.target.value }))}
            placeholder={'Travail à faire\n- Changer huile\n- Vérifier freins\n- Inspection générale'}
            className="min-h-28 rounded-lg border border-slate-300 p-2 leading-relaxed sm:col-span-2"
            rows={5}
            required
          />
          <textarea
            value={form.comments}
            onChange={(e) => setForm((c) => ({ ...c, comments: e.target.value }))}
            placeholder="Commentaires (facultatif)"
            className="min-h-24 rounded-lg border border-slate-300 p-2 leading-relaxed sm:col-span-2"
            rows={5}
          />
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white sm:col-span-2">
            Ajouter
          </button>
        </form>
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="mb-4 text-xl font-semibold">Travaux actifs</h2>
        {sortedActiveJobs.length === 0 ? (
          <p className="text-slate-600">Aucun travail actif.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="p-2">Numéro d’unité</th>
                  <th className="p-2">Travail</th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Commentaires</th>
                  <th className="p-2">Statut</th>
                  <th className="p-2">Fait</th>
                  <th className="p-2">Supprimer</th>
                </tr>
              </thead>
              <tbody>
                {sortedActiveJobs.map((job) => (
                  <tr key={job.id} className="border-b border-slate-100 align-top">
                    <td className="p-2 font-medium">{job.unitNumber}</td>
                    <td className="whitespace-pre-line p-2 leading-relaxed">{job.workToDo}</td>
                    <td className="p-2">{job.date}</td>
                    <td className="whitespace-pre-line p-2 leading-relaxed">{job.comments || "—"}</td>
                    <td className="p-2">
                      <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">Actif</span>
                    </td>
                    <td className="p-2">
                      <input type="checkbox" aria-label={`Marquer ${job.workToDo} comme fait`} onChange={() => markJobAsDone(job.id)} />
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => deleteActiveJob(job.id)}
                        className="rounded-md bg-red-600 px-3 py-1 text-sm font-semibold text-white"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">Historique par unité (verrouillé)</h2>
          <select
            value={selectedUnitHistory}
            onChange={(e) => setSelectedUnitHistory(e.target.value)}
            className="rounded-lg border border-slate-300 p-2"
          >
            <option value="">Voir historique d’une unité</option>
            {sortedUnits.map((unit) => (
              <option key={unit} value={unit}>
                Unité {unit}
              </option>
            ))}
          </select>
        </div>

        {sortedUnits.length === 0 ? (
          <p className="text-slate-600">Aucun historique pour le moment.</p>
        ) : (
          <div className="space-y-4">
            {(selectedUnitHistory ? [selectedUnitHistory] : sortedUnits).map((unit) => (
              <div key={unit} className="rounded-lg border border-slate-200 p-3">
                <h3 className="mb-3 font-semibold">Unité {unit}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="p-2">Numéro d’unité</th>
                        <th className="p-2">Travail</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">Commentaires</th>
                        <th className="p-2">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(historyByUnit[unit] ?? []).map((job) => (
                        <tr key={job.id} className="border-b border-slate-100 align-top">
                          <td className="p-2 font-medium">{job.unitNumber}</td>
                          <td className="whitespace-pre-line p-2 leading-relaxed">{job.workToDo}</td>
                          <td className="p-2">{job.date}</td>
                          <td className="whitespace-pre-line p-2 leading-relaxed">{job.comments || "—"}</td>
                          <td className="p-2">
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Archivé</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
