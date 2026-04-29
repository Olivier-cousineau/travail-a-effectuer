"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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
  photo_url: string;
  photo_path: string;
};

const defaultForm = {
  truck_number: "",
  job_description: "",
  status: "Not done" as JobStatus,
  completion_date: "",
  employee_name: "",
  comments: "",
};

export default function Home() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoPath, setPhotoPath] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);

  const [truckFilter, setTruckFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  async function fetchJobs() {
    const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (error) {
      alert(error.message);
      return;
    }
    setJobs((data ?? []) as Job[]);
  }

  useEffect(() => {
    fetchJobs();
  }, []);

  async function uploadPhoto() {
    if (!photo) return { publicUrl: photoUrl, path: photoPath };
    const fileName = `${Date.now()}-${photo.name}`;
    const path = `notebook-photos/${fileName}`;
    const { error } = await supabase.storage.from("job-photos").upload(path, photo);
    if (error) throw error;
    const { data } = supabase.storage.from("job-photos").getPublicUrl(path);
    setPhotoUrl(data.publicUrl);
    setPhotoPath(path);
    return { publicUrl: data.publicUrl, path };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      let currentPhotoUrl = photoUrl;
      let currentPhotoPath = photoPath;
      if (!currentPhotoUrl) {
        const uploaded = await uploadPhoto();
        currentPhotoUrl = uploaded?.publicUrl ?? "";
        currentPhotoPath = uploaded?.path ?? "";
      }
      const finalCompletionDate = form.status === "Done" ? form.completion_date || new Date().toISOString().slice(0, 10) : null;
      const { error } = await supabase.from("jobs").insert({
        truck_number: form.truck_number,
        job_description: form.job_description,
        status: form.status,
        completion_date: finalCompletionDate,
        employee_name: form.employee_name,
        comments: form.comments,
        photo_url: currentPhotoUrl,
        photo_path: currentPhotoPath,
      });
      if (error) throw error;
      setForm(defaultForm);
      await fetchJobs();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    setPhoto(e.target.files?.[0] ?? null);
    setPhotoUrl("");
    setPhotoPath("");
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
    const { error } = await supabase.from("jobs").update({ status: "Done", completion_date: today }).eq("id", job.id);
    if (error) return alert(error.message);
    await fetchJobs();
  }

  function exportCsv() {
    const headers = ["created_at", "truck_number", "job_description", "status", "completion_date", "employee_name", "comments", "photo_url"];
    const rows = filteredJobs.map((j) => headers.map((h) => `"${String((j as any)[h] ?? "").replaceAll('"', '""')}"`).join(","));
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
      <h1 className="mb-4 text-2xl font-bold">Municipal Truck Job Tracker</h1>
      <section className="mb-6 rounded-lg bg-white p-4 shadow">
        <h2 className="mb-3 text-lg font-semibold">Add job from notebook photo</h2>
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
          <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="md:col-span-2" required={!photoUrl} />
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
          <button className="rounded bg-blue-600 p-2 font-medium text-white md:col-span-2" disabled={loading}>
            {loading ? "Saving..." : "Save job entry"}
          </button>
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
            <option>Not done</option><option>In progress</option><option>Done</option>
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
              <a className="text-blue-600 underline" href={job.photo_url} target="_blank">Open notebook photo</a>
              {job.status !== "Done" && <button className="ml-4 rounded bg-green-600 px-2 py-1 text-white" onClick={() => markDone(job)}>Mark done</button>}
            </article>
          ))}
          {!filteredJobs.length && <p>No jobs yet.</p>}
        </div>
      </section>
    </main>
  );
}
