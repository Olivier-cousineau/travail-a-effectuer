"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Script from "next/script";

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

function parseDateFromText(text: string): string {
  const iso = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const fr = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (fr) {
    const [, d, m, y] = fr;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return new Date().toISOString().slice(0, 10);
}

function parseLineToJob(line: string): Job | null {
  const cleanLine = line.replace(/\s+/g, " ").trim();
  if (!cleanLine) return null;

  const unitMatch = cleanLine.match(/(?:unite|unité|unit|#)?\s*([A-Z0-9-]{2,})/i);
  const unitNumber = unitMatch?.[1] ?? "Inconnu";

  const done = /\b(fait|done|ok|compl[eé]t[eé])\b/i.test(cleanLine);

  const date = parseDateFromText(cleanLine);

  const withoutUnit = cleanLine.replace(unitMatch?.[0] ?? "", "").trim();
  const workToDo = withoutUnit || cleanLine;

  if (workToDo.length < 3) return null;

  return {
    id: crypto.randomUUID(),
    unitNumber,
    workToDo,
    date,
    done,
  };
}

export default function Home() {
  const [form, setForm] = useState<JobForm>(defaultForm);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [editingJobId, setEditingJobId] = useState<string | null>(null);

  useEffect(() => {
    const storedJobs = localStorage.getItem(STORAGE_KEY);
    if (!storedJobs) return;

    try {
      const parsed = JSON.parse(storedJobs) as Job[];
      if (Array.isArray(parsed)) setJobs(parsed);
    } catch {
      setJobs([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  }, [jobs]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [photoFile]);

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

  function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setPhotoFile(file);
  }

  async function transcribePhoto() {
    if (!photoFile) return;

    setOcrLoading(true);
    setOcrText("");

    try {
      const tesseract = (window as Window & { Tesseract?: { recognize: (image: File, lang: string) => Promise<{ data: { text: string } }> } }).Tesseract;
      if (!tesseract) {
        throw new Error("Tesseract non chargé");
      }

      const result = await tesseract.recognize(photoFile, "fra+eng");
      const text = result.data.text || "";
      setOcrText(text);

      const parsedJobs = text
        .split(/\n+/)
        .map((line) => parseLineToJob(line))
        .filter((job): job is Job => job !== null);

      if (parsedJobs.length > 0) {
        setJobs((current) => [...parsedJobs, ...current]);
      }
    } catch {
      setOcrText("Erreur de transcription. Réessayez avec une photo plus claire.");
    } finally {
      setOcrLoading(false);
    }
  }

  function updateJob(jobId: string, field: keyof Omit<Job, "id">, value: string | boolean) {
    setJobs((currentJobs) =>
      currentJobs.map((job) => (job.id === jobId ? { ...job, [field]: value } : job)),
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
    <>
      <Script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js" strategy="afterInteractive" />
      <main className="mx-auto min-h-screen w-full max-w-5xl bg-slate-50 p-4 md:p-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Truck Job Tracker</h1>

        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="unitNumber" className="text-sm font-medium text-slate-700">Numéro d’unité</label>
            <input id="unitNumber" className="rounded-lg border border-slate-300 p-2" value={form.unitNumber} onChange={(event) => setForm((current) => ({ ...current, unitNumber: event.target.value }))} required />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="date" className="text-sm font-medium text-slate-700">Date</label>
            <input id="date" type="date" className="rounded-lg border border-slate-300 p-2" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} required />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor="workToDo" className="text-sm font-medium text-slate-700">Travail à faire</label>
            <textarea id="workToDo" className="min-h-24 rounded-lg border border-slate-300 p-2" value={form.workToDo} onChange={(event) => setForm((current) => ({ ...current, workToDo: event.target.value }))} required />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
            <input type="checkbox" checked={form.done} onChange={(event) => setForm((current) => ({ ...current, done: event.target.checked }))} />
            Fait
          </label>

          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 sm:col-span-2">Ajouter le travail</button>
        </form>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Importation de photo</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">
            Importer une photo
            <input type="file" accept="image/*" capture="environment" onChange={onPhotoChange} className="hidden" />
          </label>

          <button type="button" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={!photoFile || ocrLoading} onClick={transcribePhoto}>
            Transcrire la photo
          </button>

          <button type="button" onClick={() => setForm(defaultForm)} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
            Ajouter manuellement
          </button>
        </div>

        {photoPreview && <img src={photoPreview} alt="Aperçu" className="mt-4 max-h-80 rounded-lg border border-slate-200" />}
        {ocrLoading && <p className="mt-4 text-sm font-medium text-blue-700">Analyse de la photo en cours…</p>}

        <div className="mt-4 rounded-lg bg-slate-100 p-3">
          <h3 className="text-sm font-semibold text-slate-800">Texte détecté</h3>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-700">{ocrText || "Aucun texte détecté pour le moment."}</pre>
        </div>
      </section>

      <section className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-left text-sm text-slate-700">
              <th className="px-2 py-3">Numéro d’unité</th><th className="px-2 py-3">Travail à faire</th><th className="px-2 py-3">Date</th><th className="px-2 py-3">Statut</th><th className="px-2 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedJobs.map((job) => {
              const isEditing = editingJobId === job.id;
              return (
                <tr key={job.id} className="border-b border-slate-100 text-sm text-slate-800">
                  <td className="px-2 py-3">{isEditing ? <input className="w-full rounded border p-1" value={job.unitNumber} onChange={(e) => updateJob(job.id, "unitNumber", e.target.value)} /> : job.unitNumber}</td>
                  <td className="px-2 py-3">{isEditing ? <input className="w-full rounded border p-1" value={job.workToDo} onChange={(e) => updateJob(job.id, "workToDo", e.target.value)} /> : job.workToDo}</td>
                  <td className="px-2 py-3">{isEditing ? <input type="date" className="w-full rounded border p-1" value={job.date} onChange={(e) => updateJob(job.id, "date", e.target.value)} /> : job.date}</td>
                  <td className="px-2 py-3"><label className="flex items-center gap-2"><input type="checkbox" checked={job.done} onChange={() => updateJob(job.id, "done", !job.done)} />{job.done ? "Fait" : "À faire"}</label></td>
                  <td className="px-2 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditingJobId(isEditing ? null : job.id)} className="rounded-md bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700">{isEditing ? "Terminer" : "Modifier"}</button>
                      <button type="button" onClick={() => deleteJob(job.id)} className="rounded-md bg-red-600 px-3 py-1.5 text-white hover:bg-red-700">Supprimer</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {sortedJobs.length === 0 && <tr><td colSpan={5} className="px-2 py-6 text-center text-sm text-slate-500">Aucun travail enregistré.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
    </>
  );
}
