"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Job = {
  id: string;
  unitNumber: string;
  workToDo: string;
  date: string;
};

type HistoryByUnit = Record<string, Job[]>;

type FormState = {
  unitNumber: string;
  workToDo: string;
  date: string;
};

const ACTIVE_STORAGE_KEY = "truck-job-tracker:active-jobs";
const HISTORY_STORAGE_KEY = "truck-job-tracker:history-by-unit";

const defaultDate = () => new Date().toISOString().slice(0, 10);

export default function Home() {
  const [form, setForm] = useState<FormState>({
    unitNumber: "",
    workToDo: "",
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
        const parsedActive = JSON.parse(savedActive) as Job[];
        if (Array.isArray(parsedActive)) setActiveJobs(parsedActive);
      }

      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory) as HistoryByUnit;
        if (parsedHistory && typeof parsedHistory === "object") setHistoryByUnit(parsedHistory);
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
      date: form.date,
    };

    if (!newJob.unitNumber || !newJob.workToDo || !newJob.date) return;

    setActiveJobs((current) => [newJob, ...current]);
    setForm({ unitNumber: "", workToDo: "", date: defaultDate() });
  }

  function markJobAsDone(jobId: string) {
    setActiveJobs((currentActive) => {
      const job = currentActive.find((j) => j.id === jobId);
      if (!job) return currentActive;

      setHistoryByUnit((currentHistory) => {
        const unit = job.unitNumber;
        const existing = currentHistory[unit] ?? [];
        return {
          ...currentHistory,
          [unit]: [job, ...existing],
        };
      });

      return currentActive.filter((j) => j.id !== jobId);
    });
  }

  function deleteActiveJob(jobId: string) {
    setActiveJobs((current) => current.filter((j) => j.id !== jobId));
  }

  function clearUnitHistory(unit: string) {
    setHistoryByUnit((current) => {
      const next = { ...current };
      delete next[unit];
      return next;
    });

    if (selectedUnitHistory === unit) setSelectedUnitHistory("");
  }

  const sortedActiveJobs = useMemo(() => [...activeJobs].sort((a, b) => b.date.localeCompare(a.date)), [activeJobs]);
  const sortedUnits = useMemo(() => Object.keys(historyByUnit).sort((a, b) => a.localeCompare(b, "fr")), [historyByUnit]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl bg-slate-50 p-4 text-slate-900 md:p-6">
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
          <input
            type="text"
            value={form.workToDo}
            onChange={(e) => setForm((c) => ({ ...c, workToDo: e.target.value }))}
            placeholder="Travail à faire"
            className="rounded-lg border border-slate-300 p-2 sm:col-span-2"
            required
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
                  <th className="p-2">Fait</th>
                  <th className="p-2">Supprimer</th>
                </tr>
              </thead>
              <tbody>
                {sortedActiveJobs.map((job) => (
                  <tr key={job.id} className="border-b border-slate-100">
                    <td className="p-2 font-medium">{job.unitNumber}</td>
                    <td className="p-2">{job.workToDo}</td>
                    <td className="p-2">{job.date}</td>
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
          <h2 className="text-xl font-semibold">Historique par unité</h2>
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
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-semibold">Unité {unit}</h3>
                  <button
                    type="button"
                    onClick={() => clearUnitHistory(unit)}
                    className="rounded-md bg-slate-800 px-3 py-1 text-sm font-semibold text-white"
                  >
                    Supprimer historique d’une unité
                  </button>
                </div>
                <ul className="list-disc space-y-1 pl-5">
                  {(historyByUnit[unit] ?? []).map((job) => (
                    <li key={job.id}>
                      {job.workToDo} ({job.date})
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
