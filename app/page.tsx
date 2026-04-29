"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";

type Job = { id: string; unitNumber: string; workToDo: string; date: string; done: boolean };
type JobForm = Omit<Job, "id">;
type DraftJob = Job;

const STORAGE_KEY = "truck-job-tracker:jobs";
const defaultDate = () => new Date().toISOString().slice(0, 10);
const defaultForm: JobForm = { unitNumber: "", workToDo: "", date: defaultDate(), done: false };

function parseDateFromText(text: string): string {
  const iso = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const fr = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (fr) return `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
  return defaultDate();
}

function parseLineToDraft(line: string): DraftJob | null {
  const cleanLine = line.replace(/\s+/g, " ").trim();
  if (!cleanLine || cleanLine.length < 3) return null;
  const unitMatch = cleanLine.match(/(?:unite|unité|unit|#)?\s*([A-Z0-9-]{2,})/i);
  return {
    id: crypto.randomUUID(),
    unitNumber: unitMatch?.[1] ?? "Inconnu",
    workToDo: cleanLine.replace(unitMatch?.[0] ?? "", "").trim() || cleanLine,
    date: parseDateFromText(cleanLine),
    done: /\b(fait|done|ok|compl[eé]t[eé])\b/i.test(cleanLine),
  };
}

export default function Home() {
  const [form, setForm] = useState<JobForm>(defaultForm);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [processedPreview, setProcessedPreview] = useState("");
  const [threshold, setThreshold] = useState(150);
  const [rotation, setRotation] = useState(0);
  const [conversionError, setConversionError] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [reviewRows, setReviewRows] = useState<DraftJob[]>([]);
  const [quickEntry, setQuickEntry] = useState("");
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [autoConvertTrigger, setAutoConvertTrigger] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return;
    try {
      const parsed = JSON.parse(s) as Job[];
      if (Array.isArray(parsed)) setJobs(parsed);
    } catch {
      setJobs([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  }, [jobs]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setJobs((cur) => [
      {
        id: crypto.randomUUID(),
        ...form,
        unitNumber: form.unitNumber.trim(),
        workToDo: form.workToDo.trim(),
      },
      ...cur,
    ]);
    setForm(defaultForm);
  }

  function onPhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    setProcessedPreview("");
    setReviewRows([]);
    setOcrText("");
    setConversionError("");
    setRotation(0);

    if (!file) {
      setPhotoPreview("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhotoPreview(reader.result);
        setAutoConvertTrigger((n) => n + 1);
      } else {
        setConversionError("Impossible de lire le fichier image.");
      }
    };
    reader.onerror = () => {
      setConversionError("Erreur de lecture du fichier via FileReader.");
    };
    reader.readAsDataURL(file);
  }

  async function processImage() {
    if (!photoPreview || !canvasRef.current) return;
    setIsConverting(true);
    setConversionError("");

    try {
      const img = new Image();
      img.src = photoPreview;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Chargement de l'image impossible."));
      });

      const smallImage = img.width < 1400 || img.height < 1400;
      const baseScale = smallImage ? 2 : 1;
      const drawWidth = Math.max(1, Math.floor(img.width * baseScale));
      const drawHeight = Math.max(1, Math.floor(img.height * baseScale));

      const rotated = Math.abs(rotation) % 180 !== 0;
      const c = canvasRef.current;
      c.width = rotated ? drawHeight : drawWidth;
      c.height = rotated ? drawWidth : drawHeight;

      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Contexte canvas indisponible dans ce navigateur.");

      ctx.save();
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();

      const imageData = ctx.getImageData(0, 0, c.width, c.height);
      const data = imageData.data;
      const contrastFactor = 1.8;

      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const contrasted = (gray - 128) * contrastFactor + 128;
        const bw = contrasted >= threshold ? 255 : 0;
        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
      }

      ctx.putImageData(imageData, 0, 0);
      setProcessedPreview(c.toDataURL("image/png"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue pendant la conversion.";
      setConversionError(`Échec de la conversion: ${message}`);
      setProcessedPreview("");
    } finally {
      setIsConverting(false);
    }
  }

  useEffect(() => {
    if (!photoPreview) return;
    void processImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold, rotation, autoConvertTrigger]);

  async function transcribePhoto() {
    if (!processedPreview) return;
    setOcrLoading(true);
    setOcrText("");

    try {
      const tesseract = (window as Window & {
        Tesseract?: {
          recognize: (
            image: string | File,
            lang: string,
            options?: unknown,
          ) => Promise<{ data: { text: string } }>;
        };
      }).Tesseract;

      if (!tesseract) throw new Error("Tesseract non chargé.");

      const result = await tesseract.recognize(processedPreview, "fra+eng", { tessedit_pageseg_mode: "6" });
      const text = result.data.text || "";
      setOcrText(text);
      setReviewRows(text.split(/\n+/).map(parseLineToDraft).filter((j): j is DraftJob => j !== null));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur OCR inconnue.";
      setOcrText(`Erreur OCR: ${message}`);
    } finally {
      setOcrLoading(false);
    }
  }

  const applyQuickEntry = () => setReviewRows(quickEntry.split(/\n+/).map(parseLineToDraft).filter((j): j is DraftJob => j !== null));
  const addVerifiedRows = () =>
    setJobs((cur) => [...reviewRows.filter((r) => r.workToDo.trim().length > 2).map((r) => ({ ...r, id: crypto.randomUUID() })), ...cur]);
  const updateJob = (id: string, field: keyof JobForm, value: string | boolean) => setJobs((cur) => cur.map((j) => (j.id === id ? { ...j, [field]: value } : j)));
  const deleteJob = (id: string) => setJobs((cur) => cur.filter((j) => j.id !== id));
  const sortedJobs = useMemo(() => [...jobs].sort((a, b) => b.date.localeCompare(a.date)), [jobs]);

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js" strategy="afterInteractive" />
      <main className="mx-auto min-h-screen w-full max-w-5xl bg-slate-50 p-4 md:p-6">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <h1 className="mb-4 text-2xl font-bold text-slate-900">Truck Job Tracker</h1>
          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
            <input className="rounded-lg border p-2" value={form.unitNumber} onChange={(e) => setForm((c) => ({ ...c, unitNumber: e.target.value }))} placeholder="Numéro d’unité" required />
            <input type="date" className="rounded-lg border p-2" value={form.date} onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))} required />
            <textarea className="min-h-24 rounded-lg border p-2 sm:col-span-2" value={form.workToDo} onChange={(e) => setForm((c) => ({ ...c, workToDo: e.target.value }))} placeholder="Travail à faire" required />
            <label className="sm:col-span-2"><input type="checkbox" checked={form.done} onChange={(e) => setForm((c) => ({ ...c, done: e.target.checked }))} /> Fait</label>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white sm:col-span-2">Ajouter le travail</button>
          </form>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <h2 className="mb-3 text-lg font-semibold">Importation de photo</h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
              Importer une photo
              <input type="file" accept="image/*" capture="environment" onChange={onPhotoChange} className="hidden" />
            </label>
            <button type="button" onClick={processImage} disabled={!photoPreview || isConverting} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              Convertir la photo
            </button>
            <button
              type="button"
              onClick={() => setRotation((r) => r - 90)}
              disabled={!photoPreview}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              Rotation gauche
            </button>
            <button
              type="button"
              onClick={() => setRotation((r) => r + 90)}
              disabled={!photoPreview}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              Rotation droite
            </button>
            <a
              href={processedPreview || "#"}
              download="photo-convertie.png"
              className={`rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white ${!processedPreview ? "pointer-events-none opacity-60" : ""}`}
            >
              Télécharger l’image convertie
            </a>
            <button type="button" onClick={transcribePhoto} disabled={!processedPreview || ocrLoading} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              Transcrire l’image convertie
            </button>
          </div>

          {photoPreview && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold">Image originale</p>
                <img src={photoPreview} alt="Original" className="max-h-80 rounded-lg border" />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Image convertie</p>
                {processedPreview ? (
                  <img src={processedPreview} alt="Image convertie" className="max-h-80 rounded-lg border" />
                ) : (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-slate-500">Aucune conversion disponible.</p>
                )}
              </div>
            </div>
          )}

          {photoPreview && (
            <div className="mt-4">
              <label className="block text-sm font-medium">
                Seuil noir/blanc: {threshold}
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="mt-2 w-full"
                />
              </label>
            </div>
          )}

          {conversionError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{conversionError}</p>}
          {ocrLoading && <p className="mt-4 text-sm font-medium text-blue-700">Analyse OCR en cours…</p>}
          <canvas ref={canvasRef} className="hidden" />

          <div className="mt-4 rounded-lg bg-slate-100 p-3">
            <h3 className="text-sm font-semibold">Texte OCR brut</h3>
            <pre className="mt-2 whitespace-pre-wrap text-xs">{ocrText || "Aucun texte détecté."}</pre>
          </div>

          <div className="mt-4 rounded-lg border p-3">
            <h3 className="font-semibold">Saisie rapide</h3>
            <textarea value={quickEntry} onChange={(e) => setQuickEntry(e.target.value)} className="mt-2 min-h-24 w-full rounded border p-2 text-sm" placeholder="Collez/corrigez le texte brut ici, ligne par ligne." />
            <button type="button" onClick={applyQuickEntry} className="mt-2 rounded bg-slate-700 px-3 py-1.5 text-white">Convertir en lignes</button>
          </div>

          <div className="mt-4 rounded-lg border p-3">
            <h3 className="font-semibold">Vérification avant ajout</h3>
            <div className="mt-2 space-y-3">
              {reviewRows.map((row) => (
                <div key={row.id} className="grid gap-2 rounded border p-2 sm:grid-cols-4">
                  <input value={row.unitNumber} onChange={(e) => setReviewRows((cur) => cur.map((r) => (r.id === row.id ? { ...r, unitNumber: e.target.value } : r)))} className="rounded border p-1" placeholder="Numéro d’unité" />
                  <input value={row.workToDo} onChange={(e) => setReviewRows((cur) => cur.map((r) => (r.id === row.id ? { ...r, workToDo: e.target.value } : r)))} className="rounded border p-1 sm:col-span-2" placeholder="Travail" />
                  <input type="date" value={row.date} onChange={(e) => setReviewRows((cur) => cur.map((r) => (r.id === row.id ? { ...r, date: e.target.value } : r)))} className="rounded border p-1" />
                  <label><input type="checkbox" checked={row.done} onChange={() => setReviewRows((cur) => cur.map((r) => (r.id === row.id ? { ...r, done: !r.done } : r)))} /> Fait</label>
                </div>
              ))}
              {reviewRows.length === 0 && <p className="text-sm text-slate-500">Aucune ligne à vérifier.</p>}
            </div>
            <button type="button" onClick={addVerifiedRows} className="mt-3 rounded bg-blue-600 px-4 py-2 text-white">Ajouter les lignes vérifiées</button>
          </div>
        </section>

        <section className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b text-left text-sm">
                <th className="px-2 py-3">Unité</th>
                <th className="px-2 py-3">Travail</th>
                <th className="px-2 py-3">Date</th>
                <th className="px-2 py-3">Statut</th>
                <th className="px-2 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedJobs.map((job) => {
                const isEditing = editingJobId === job.id;
                return (
                  <tr key={job.id} className="border-b text-sm">
                    <td className="px-2 py-3">{isEditing ? <input className="w-full rounded border p-1" value={job.unitNumber} onChange={(e) => updateJob(job.id, "unitNumber", e.target.value)} /> : job.unitNumber}</td>
                    <td className="px-2 py-3">{isEditing ? <input className="w-full rounded border p-1" value={job.workToDo} onChange={(e) => updateJob(job.id, "workToDo", e.target.value)} /> : job.workToDo}</td>
                    <td className="px-2 py-3">{isEditing ? <input type="date" className="w-full rounded border p-1" value={job.date} onChange={(e) => updateJob(job.id, "date", e.target.value)} /> : job.date}</td>
                    <td className="px-2 py-3"><label><input type="checkbox" checked={job.done} onChange={() => updateJob(job.id, "done", !job.done)} /> {job.done ? "Fait" : "À faire"}</label></td>
                    <td className="px-2 py-3"><button type="button" onClick={() => setEditingJobId(isEditing ? null : job.id)} className="mr-2 rounded bg-indigo-600 px-3 py-1 text-white">{isEditing ? "Terminer" : "Modifier"}</button><button type="button" onClick={() => deleteJob(job.id)} className="rounded bg-red-600 px-3 py-1 text-white">Supprimer</button></td>
                  </tr>
                );
              })}
              {sortedJobs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-sm text-slate-500">Aucun travail enregistré.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
