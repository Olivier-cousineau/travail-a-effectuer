"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Job = {
  id: string;
  unitNumber: string;
  workToDo: string;
  date: string;
  done: boolean;
};

type JobForm = {
  unitNumber: string;
  workToDo: string;
  date: string;
  done: boolean;
};

const STORAGE_KEY = "truck-job-tracker:jobs";

const defaultForm: JobForm = {
  unitNumber: "",
  workToDo: "",
  date: new Date().toISOString().slice(0, 10),
  done: false,
};

export default function Home() {
  const [form, setForm] = useState<JobForm>(defaultForm);
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    const storedJobs = localStorage.getItem(STORAGE_KEY);
    if (!storedJobs) return;

    try {
      const parsed = JSON.parse(storedJobs) as Job[];
      if (Array.isArray(parsed)) {
        setJobs(parsed);
      }
    } catch {
      setJobs([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  }, [jobs]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const newJob: Job = {
      id: crypto.randomUUID(),
      unitNumber: form.unitNumber.trim(),
      workToDo: form.workToDo.trim(),
      date: form.date,
      done: form.done,
    };

    setJobs((currentJobs) => [newJob, ...currentJobs]);
    setForm(defaultForm);
  }

  function toggleDone(jobId: string) {
    setJobs((currentJobs) =>
      currentJobs.map((job) => (job.id === jobId ? { ...job, done: !job.done } : job)),
    );
  }

  function deleteJob(jobId: string) {
    setJobs((currentJobs) => currentJobs.filter((job) => job.id !== jobId));
  }

  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => b.date.localeCompare(a.date)),
    [jobs],
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl bg-slate-50 p-4 md:p-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Truck Job Tracker</h1>

        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="unitNumber" className="text-sm font-medium text-slate-700">
              Numéro d’unité
            </label>
            <input
              id="unitNumber"
              className="rounded-lg border border-slate-300 p-2"
              value={form.unitNumber}
              onChange={(event) => setForm((current) => ({ ...current, unitNumber: event.target.value }))}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="date" className="text-sm font-medium text-slate-700">
              Date
            </label>
            <input
              id="date"
              type="date"
              className="rounded-lg border border-slate-300 p-2"
              value={form.date}
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              required
            />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor="workToDo" className="text-sm font-medium text-slate-700">
              Travail à faire
            </label>
            <textarea
              id="workToDo"
              className="min-h-24 rounded-lg border border-slate-300 p-2"
              value={form.workToDo}
              onChange={(event) => setForm((current) => ({ ...current, workToDo: event.target.value }))}
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.done}
              onChange={(event) => setForm((current) => ({ ...current, done: event.target.checked }))}
            />
            Fait
          </label>

          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 sm:col-span-2"
          >
            Ajouter le travail
          </button>
        </form>
      </section>

      <section className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-left text-sm text-slate-700">
              <th className="px-2 py-3">Numéro d’unité</th>
              <th className="px-2 py-3">Travail à faire</th>
              <th className="px-2 py-3">Date</th>
              <th className="px-2 py-3">Statut</th>
              <th className="px-2 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedJobs.map((job) => (
              <tr key={job.id} className="border-b border-slate-100 text-sm text-slate-800">
                <td className="px-2 py-3">{job.unitNumber}</td>
                <td className="px-2 py-3">{job.workToDo}</td>
                <td className="px-2 py-3">{job.date}</td>
                <td className="px-2 py-3">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={job.done} onChange={() => toggleDone(job.id)} />
                    {job.done ? "Fait" : "À faire"}
                  </label>
                </td>
                <td className="px-2 py-3">
                  <button
                    type="button"
                    onClick={() => deleteJob(job.id)}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-white hover:bg-red-700"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
            {sortedJobs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-6 text-center text-sm text-slate-500">
                  Aucun travail enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
