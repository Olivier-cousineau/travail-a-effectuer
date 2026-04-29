create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  truck_number text not null,
  job_description text not null,
  status text not null check (status in ('Not done', 'In progress', 'Done')),
  completion_date date,
  employee_name text not null,
  comments text,
  photo_url text not null,
  photo_path text not null
);

alter table public.jobs enable row level security;

create policy "Allow all for demo"
on public.jobs
for all
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', true)
on conflict (id) do nothing;
