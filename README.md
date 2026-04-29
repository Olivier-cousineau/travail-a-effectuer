# Municipal Truck Job Tracker

Next.js + Tailwind + Supabase app for municipal truck job tracking from notebook photos.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env vars:
   ```bash
   cp .env.example .env.local
   ```
3. Fill Supabase keys in `.env.local`.
4. Run SQL from `supabase.sql` in Supabase SQL editor.
5. Start app:
   ```bash
   npm run dev
   ```

## Features
- Mobile-friendly form to take/upload notebook photos.
- Multiple job entries linked to uploaded photo.
- Auto-created date (`created_at`) in database.
- Dashboard filtering by truck, status, date.
- Mark job as done button.
- CSV export (Excel-compatible).
