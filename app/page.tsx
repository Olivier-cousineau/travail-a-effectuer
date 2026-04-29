"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type UnitJob = {
  id: string;
  text: string;
  done: boolean;
};

type UnitCard = {
  id: string;
  unit: string;
  jobs: UnitJob[];
  date: string;
  comments: string;
  completedAt?: string;
};

type FormState = {
  unit: string;
  jobsText: string;
  date: string;
  comments: string;
};

const ACTIVE_STORAGE_KEY = "truck-job-tracker:active-units";
const HISTORY_STORAGE_KEY = "truck-job-tracker:history-units";
const LEGACY_ACTIVE_STORAGE_KEY = "truck-job-tracker:active-jobs";
const LEGACY_HISTORY_STORAGE_KEY = "truck-job-tracker:history-by-unit";

const defaultDate = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): FormState => ({
  unit: "",
  jobsText: "",
  date: defaultDate(),
  comments: "",
});

function parseJobs(textareaValue: string): UnitJob[] {
  return textareaValue
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      id: crypto.randomUUID(),
      text: line,
      done: false,
    }));
}

function normalizeUnitCard(raw: Partial<UnitCard>): UnitCard | null {
  if (!raw || typeof raw !== "object") return null;

  const id = typeof raw.id === "string" ? raw.id : "";
  const unit = typeof raw.unit === "string" ? raw.unit : "";
  const date = typeof raw.date === "string" ? raw.date : "";
  if (!id || !unit || !date) return null;

  const jobs: UnitJob[] = Array.isArray(raw.jobs)
    ? raw.jobs
        .map((j) => {
          if (!j || typeof j !== "object") return null;
          const job = j as Partial<UnitJob>;
          if (typeof job.id !== "string" || typeof job.text !== "string") return null;
          return {
            id: job.id,
            text: job.text,
            done: job.done === true,
          };
        })
        .filter((job): job is UnitJob => Boolean(job))
    : [];

  if (jobs.length === 0) return null;

  return {
    id,
    unit,
    jobs,
    date,
    comments: typeof raw.comments === "string" ? raw.comments : "",
    completedAt: typeof raw.completedAt === "string" ? raw.completedAt : undefined,
  };
}

type LegacyJob = {
  id: string;
  unitNumber: string;
  workToDo: string;
  comments?: string;
  date: string;
  status?: "actif" | "archive";
};

function normalizeLegacyJob(raw: Partial<LegacyJob>): LegacyJob | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.id !== "string" || typeof raw.unitNumber !== "string" || typeof raw.workToDo !== "string" || typeof raw.date !== "string") {
    return null;
  }

  return {
    id: raw.id,
    unitNumber: raw.unitNumber,
    workToDo: raw.workToDo,
    comments: typeof raw.comments === "string" ? raw.comments : "",
    date: raw.date,
    status: raw.status === "archive" ? "archive" : "actif",
  };
}

function legacyJobToUnitCard(job: LegacyJob): UnitCard {
  return {
    id: job.id,
    unit: job.unitNumber,
    date: job.date,
    comments: job.comments ?? "",
    completedAt: job.status === "archive" ? new Date(`${job.date}T23:59:59.000Z`).toISOString() : undefined,
    jobs: [
      {
        id: `${job.id}-1`,
        text: job.workToDo,
        done: job.status === "archive",
      },
    ],
  };
}

export default function Home() {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [activeUnits, setActiveUnits] = useState<UnitCard[]>([]);
  const [historyUnits, setHistoryUnits] = useState<UnitCard[]>([]);
  const [selectedUnitHistory, setSelectedUnitHistory] = useState("");

  useEffect(() => {
    try {
      const savedActive = localStorage.getItem(ACTIVE_STORAGE_KEY);
      const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      const savedLegacyActive = localStorage.getItem(LEGACY_ACTIVE_STORAGE_KEY);
      const savedLegacyHistory = localStorage.getItem(LEGACY_HISTORY_STORAGE_KEY);

      if (savedActive) {
        const parsed = JSON.parse(savedActive) as Partial<UnitCard>[];
        if (Array.isArray(parsed)) {
          setActiveUnits(parsed.map(normalizeUnitCard).filter((u): u is UnitCard => Boolean(u)));
        }
      }

      if (savedHistory) {
        const parsed = JSON.parse(savedHistory) as Partial<UnitCard>[];
        if (Array.isArray(parsed)) {
          setHistoryUnits(parsed.map(normalizeUnitCard).filter((u): u is UnitCard => Boolean(u)));
        }
      }

      if (!savedActive && savedLegacyActive) {
        const parsedLegacyActive = JSON.parse(savedLegacyActive) as Partial<LegacyJob>[];
        if (Array.isArray(parsedLegacyActive)) {
          const migratedActive = parsedLegacyActive
            .map(normalizeLegacyJob)
            .filter((job): job is LegacyJob => Boolean(job))
            .map(legacyJobToUnitCard);
          setActiveUnits(migratedActive);
        }
      }

      if (!savedHistory && savedLegacyHistory) {
        const parsedLegacyHistory = JSON.parse(savedLegacyHistory) as Record<string, Partial<LegacyJob>[]>;
        if (parsedLegacyHistory && typeof parsedLegacyHistory === "object") {
          const migratedHistory = Object.values(parsedLegacyHistory)
            .flatMap((jobs) => (Array.isArray(jobs) ? jobs : []))
            .map(normalizeLegacyJob)
            .filter((job): job is LegacyJob => Boolean(job))
            .map(legacyJobToUnitCard)
            .map((card) => ({
              ...card,
              jobs: card.jobs.map((job) => ({ ...job, done: true })),
              completedAt: card.completedAt ?? new Date(`${card.date}T23:59:59.000Z`).toISOString(),
            }));
          setHistoryUnits(migratedHistory);
        }
      }
    } catch {
      setActiveUnits([]);
      setHistoryUnits([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(activeUnits));
  }, [activeUnits]);

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyUnits));
  }, [historyUnits]);

  function addUnitCard(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const unit = form.unit.trim();
    const comments = form.comments.trim();
    const jobs = parseJobs(form.jobsText);

    if (!unit || !form.date || jobs.length === 0) return;

    const card: UnitCard = {
      id: crypto.randomUUID(),
      unit,
      jobs,
      date: form.date,
      comments,
    };

    setActiveUnits((current) => [card, ...current]);
    setForm(emptyForm());
  }

  function toggleJobDone(unitId: string, jobId: string) {
    setActiveUnits((currentActive) => {
      let archivedCard: UnitCard | null = null;

      const nextActive = currentActive
        .map((card) => {
          if (card.id !== unitId) return card;

          const updatedJobs = card.jobs.map((job) => (job.id === jobId ? { ...job, done: true } : job));
          const allDone = updatedJobs.every((job) => job.done);

          if (allDone) {
            archivedCard = {
              ...card,
              jobs: updatedJobs,
              completedAt: new Date().toISOString(),
            };
            return null;
          }

          return {
            ...card,
            jobs: updatedJobs,
          };
        })
        .filter((card): card is UnitCard => Boolean(card));

      if (archivedCard) {
        setHistoryUnits((currentHistory) => [archivedCard as UnitCard, ...currentHistory]);
      }

      return nextActive;
    });
  }

  const activeSorted = useMemo(() => [...activeUnits].sort((a, b) => b.date.localeCompare(a.date)), [activeUnits]);

  const historyUnitNumbers = useMemo(
    () => Array.from(new Set(historyUnits.map((card) => card.unit))).sort((a, b) => a.localeCompare(b, "fr")),
    [historyUnits],
  );

  const visibleHistory = useMemo(() => {
    const sorted = [...historyUnits].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    if (!selectedUnitHistory) return sorted;
    return sorted.filter((card) => card.unit === selectedUnitHistory);
  }, [historyUnits, selectedUnitHistory]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl bg-slate-50 p-4 text-slate-900 md:p-6">
      <h1 className="mb-6 text-3xl font-bold">Truck Job Tracker</h1>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="mb-4 text-xl font-semibold">Ajouter une unité</h2>
        <form onSubmit={addUnitCard} className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={form.unit}
            onChange={(e) => setForm((c) => ({ ...c, unit: e.target.value }))}
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
            value={form.jobsText}
            onChange={(e) => setForm((c) => ({ ...c, jobsText: e.target.value }))}
            placeholder={"Travaux à faire (une ligne = un travail)\nChanger huile\nVérifier freins\nInspection générale"}
            className="min-h-28 rounded-lg border border-slate-300 p-2 leading-relaxed sm:col-span-2"
            rows={5}
            required
          />
          <textarea
            value={form.comments}
            onChange={(e) => setForm((c) => ({ ...c, comments: e.target.value }))}
            placeholder="Commentaires"
            className="min-h-24 rounded-lg border border-slate-300 p-2 leading-relaxed sm:col-span-2"
            rows={4}
          />
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700">
              Ajouter
            </button>
          </div>
        </form>
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="mb-4 text-xl font-semibold">Unités actives</h2>
        {activeSorted.length === 0 ? (
          <p className="text-slate-600">Aucune unité active.</p>
        ) : (
          <div className="space-y-4">
            {activeSorted.map((card) => {
              const total = card.jobs.length;
              const done = card.jobs.filter((j) => j.done).length;
              const remainingJobs = card.jobs.filter((j) => !j.done);

              return (
                <article key={card.id} className="rounded-xl border border-slate-200 p-4 shadow-sm transition-all duration-200 hover:shadow">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">Unité {card.unit}</h3>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">{done}/{total} travaux complétés</span>
                  </div>
                  <p className="mb-3 text-sm text-slate-600">Date: {card.date}</p>
                  {card.comments && <p className="mb-4 whitespace-pre-line text-sm text-slate-700">Commentaires: {card.comments}</p>}

                  <ul className="space-y-3">
                    {remainingJobs.map((job) => (
                      <li key={job.id} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <input
                          type="checkbox"
                          aria-label={`Marquer ${job.text} comme complété`}
                          checked={job.done}
                          onChange={() => toggleJobDone(card.id, job.id)}
                          className="mt-1 h-4 w-4"
                        />
                        <span className="leading-relaxed">{job.text}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">Historique verrouillé</h2>
          <select
            value={selectedUnitHistory}
            onChange={(e) => setSelectedUnitHistory(e.target.value)}
            className="rounded-lg border border-slate-300 p-2"
          >
            <option value="">Voir tout l’historique</option>
            {historyUnitNumbers.map((unit) => (
              <option key={unit} value={unit}>
                Voir historique d’une unité: {unit}
              </option>
            ))}
          </select>
        </div>

        {visibleHistory.length === 0 ? (
          <p className="text-slate-600">Aucun historique.</p>
        ) : (
          <div className="space-y-4">
            {visibleHistory.map((card) => (
              <article key={card.id} className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <h3 className="mb-2 font-semibold">Unité {card.unit}</h3>
                <p className="mb-2 text-sm text-slate-700">Date de création: {card.date}</p>
                {card.completedAt && (
                  <p className="mb-3 text-sm text-slate-700">Complété le: {new Date(card.completedAt).toLocaleString("fr-CA")}</p>
                )}
                {card.comments && <p className="mb-3 whitespace-pre-line text-sm">Commentaires: {card.comments}</p>}
                <ul className="space-y-2">
                  {card.jobs.map((job) => (
                    <li key={job.id} className="rounded border border-emerald-200 bg-white p-2 text-sm">
                      ✅ {job.text}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
