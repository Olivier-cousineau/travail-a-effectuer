"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type JobStatus = "Not done" | "In progress" | "Done";

type Job = {
  id: string;
  created_at: string;
  truck_number: string;
  job_description: string;
  status: JobStatus;
  completion_date: string | null;
  employee_name: string;
  comments: string;
  photo_data_url: string;
};

const defaultForm = {
  truck_number: "",
  job_description: "",
  status: "Not done" as JobStatus,
  completion_date: "",
  employee_name: "",
  comments: "",
};

const apiUrl = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_URL || "";

async function apiRequest<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!apiUrl) throw new Error("NEXT_PUBLIC_GOOGLE_SHEETS_API_URL is missing");

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "Unknown API error");
  return data as T;
}

export default function Home() {
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const [truckFilter, setTruckFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  async function fetchJobs() {
    const data = await apiRequest<{ ok: true; jobs: Job[] }>("listJobs");
    setJobs(data.jobs ?? []);
  }

  useEffect(() => {
    fetchJobs().catch((err) => alert(err.message));
  }, []);

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (!photoDataUrl) throw new Error("Please take/upload a notebook photo first");

      const completion_date = form.status === "Done" ? form.completion_date || new Date().toISOString().slice(0, 10) : "";

      await apiRequest("createJob", {
        truck_number: form.truck_number,
        job_description: form.job_description,
        status: form.status,
        completion_date,
        employee_name: form.employee_name,
        comments: form.comments,
        photo_data_url: photoDataUrl,
      });

      setForm(defaultForm);
      await fetchJobs();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function extractFromPhoto() {
    try {
      if (!photoDataUrl) throw new Error("Please upload a notebook photo first");
      setExtracting(true);
      const data = await apiRequest<{
        ok: true;
        extracted: Partial<Pick<Job, "truck_number" | "job_description" | "employee_name" | "comments">> & { raw_text?: string };
      }>("extractFromPhoto", { photo_data_url: photoDataUrl });

      setForm((prev) => ({
        ...prev,
        truck_number: data.extracted.truck_number || prev.truck_number,
        job_description: data.extracted.job_description || prev.job_description,
        employee_name: data.extracted.employee_name || prev.employee_name,
        comments: data.extracted.comments || prev.comments,
      }));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setExtracting(false);
    }
  }

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (truckFilter && !job.truck_number.toLowerCase().includes(truckFilter.toLowerCase())) return false;
      if (statusFilter && job.status !== statusFilter) return false;
      if (dateFilter && !job.created_at.startsWith(dateFilter)) return false;
      return true;
    });
  }, [jobs, truckFilter, statusFilter, dateFilter]);

  async function markDone(job: Job) {
    const today = new Date().toISOString().slice(0, 10);
    await apiRequest("markDone", { id: job.id, completion_date: today });
    await fetchJobs();
  }

  function exportCsv() {
    const headers = ["created_at", "truck_number", "job_description", "status", "completion_date", "employee_name", "comments"];
    const rows = filteredJobs.map((j) => headers.map((h) => `"${String((j as never as Record<string, string | null>)[h] ?? "").replaceAll('"', '""')}"`).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jobs-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-6">
      <h1 className="mb-4 text-2xl font-bold">Municipal Truck Job Tracker (Google Sheets)</h1>

      <section className="mb-6 rounded-lg bg-white p-4 shadow">
        <h2 className="mb-3 text-lg font-semibold">Add job from notebook photo</h2>
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
          <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="md:col-span-2" required={!photoDataUrl} />
          <button type="button" onClick={extractFromPhoto} className="rounded bg-indigo-600 p-2 text-white md:col-span-2" disabled={extracting || !photoDataUrl}>
            {extracting ? "Analyzing photo..." : "Auto-fill from photo"}
          </button>
          <input className="rounded border p-2" placeholder="Truck number" value={form.truck_number} onChange={(e) => setForm({ ...form, truck_number: e.target.value })} required />
          <input className="rounded border p-2" placeholder="Employee name" value={form.employee_name} onChange={(e) => setForm({ ...form, employee_name: e.target.value })} required />
          <textarea className="rounded border p-2 md:col-span-2" placeholder="Job description" value={form.job_description} onChange={(e) => setForm({ ...form, job_description: e.target.value })} required />
          <select className="rounded border p-2" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as JobStatus })}>
            <option>Not done</option>
            <option>In progress</option>
            <option>Done</option>
          </select>
          <input className="rounded border p-2" type="date" value={form.completion_date} onChange={(e) => setForm({ ...form, completion_date: e.target.value })} />
          <textarea className="rounded border p-2 md:col-span-2" placeholder="Comments" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} />
          <button className="rounded bg-blue-600 p-2 font-medium text-white md:col-span-2" disabled={loading}>{loading ? "Saving..." : "Save job entry"}</button>
        </form>
      </section>

      <section className="rounded-lg bg-white p-4 shadow">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">Dashboard</h2>
          <button onClick={exportCsv} className="rounded bg-emerald-600 px-3 py-2 text-white">Export CSV/Excel</button>
        </div>

        <div className="mb-4 grid gap-2 md:grid-cols-3">
          <input className="rounded border p-2" placeholder="Filter by truck" value={truckFilter} onChange={(e) => setTruckFilter(e.target.value)} />
          <select className="rounded border p-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option>Not done</option>
            <option>In progress</option>
            <option>Done</option>
          </select>
          <input className="rounded border p-2" type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div>

        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <article key={job.id} className="rounded border p-3">
              <p className="text-sm text-slate-600">Created: {new Date(job.created_at).toLocaleString()}</p>
              <p><strong>Truck:</strong> {job.truck_number} | <strong>Status:</strong> {job.status}</p>
              <p><strong>Employee:</strong> {job.employee_name}</p>
              <p><strong>Description:</strong> {job.job_description}</p>
              <p><strong>Completion date:</strong> {job.completion_date || "-"}</p>
              <p><strong>Comments:</strong> {job.comments || "-"}</p>
              <details>
                <summary className="cursor-pointer text-blue-600">View notebook photo</summary>
                <img src={job.photo_data_url} alt="Notebook" className="mt-2 w-full rounded border" />
              </details>
              {job.status !== "Done" && (
                <button className="mt-2 rounded bg-green-600 px-2 py-1 text-white" onClick={() => markDone(job)}>
                  Mark done
                </button>
              )}
            </article>
          ))}
          {!filteredJobs.length && <p>No jobs yet.</p>}
        </div>
      </section>
    </main>
  );
}
