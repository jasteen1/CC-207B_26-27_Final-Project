# WVSU WayFinder

Campus wayfinding for WVSU Main Campus (CIT 210 – Web Systems and Technologies).
Two clients share one Supabase project and the same place IDs:

- **Web app** (React + Vite + TypeScript) in this folder: the CIT 210 submission.
- **Mobile app** (Flutter) in [`mobile/`](mobile/README.md).

## Features

| # | Feature | Where |
|---|---------|-------|
| 1 | **My Schedule**: timetable image upload, weekly classes (add/edit/delete), next class on Home (Asia/Manila) with room code, professor and *Find room*, reminders | `src/features/schedule`, `src/lib/schedule` |
| 2 | **Student Processes**: searchable guides with Before You Start, required documents, ordered steps, saved progress, *Show office on map* | `src/features/processes` |
| 3 | **AI Guide**: English / Tagalog / Hiligaynon, answers grounded in published records with links; labeled directory/process search when the AI is unavailable | `src/features/guide`, `supabase/functions/ai-guide` |
| 4 | **Campus Map**: MapLibre + MapTiler, verified buildings/entrances/floor plans, walking routes and time over verified walkways | `src/features/map`, `src/lib/routing` |
| 5 | **My Location**: *Use my location* (accuracy shown) or *Choose starting point*; the destination is kept when the start changes | `src/lib/location.ts`, `src/features/map` |
| 6 | **Directory**: category filters, faculty search and details from `public.faculty_directory` (published + verified only) | `src/features/directory` |

## Design (2026-11-28 redesign)

Both apps follow the WayFinder design in `~/Downloads/WayFinder-SVGs` (exported from the clickable prototype in `~/Downloads/WayFinder-Prototype/site`).

- **Web:** `src/App.tsx` routes to the redesigned screens in `src/wf/`. The prototype stylesheet is `src/wf/app.css`, and its data is in `src/wf/data/`. Logos, building photos, blueprints and floor plans are in `public/wf/`.
- **Mobile:** `lib/main.dart` runs `lib/wf/` (`WFApp`). It uses the same routes, `assets/wf/wayfinder.json` (generated from the prototype data), and the Signika and Fira Sans fonts.
- **Content:** screens use the prototype's sample student, schedule and campus records. Sign-in, the timetable scan and Ask WayFinder answers are simulated.
- **Previous UI:** the old screens (`src/LegacyApp.tsx` and `src/features/`, `mobile/lib/app.dart` and `mobile/lib/screens/`) and the live Supabase/AI Guide data layer are kept and still tested, but no longer routed.

## Data rules

- **Live mode:** live data is used when Supabase is configured. Students only see published, verified rows. A failed request shows an error with **Retry**; it never substitutes demo data.
- **Demo mode:** labeled demo fixtures (`src/data/demo/*.json`) are used only when Supabase is not configured. They are invented placeholders, not WVSU information.
- **Unconfirmed locations:**
  - A room code that doesn't match a verified place is kept as typed and shown as *Room location unconfirmed*.
  - Teachers without a verified office link show *Office location unconfirmed*.
- **Private schedules:** schedules and timetable images are stored on the student's own device only. Cloud sync needs Supabase Auth plus `supabase/migrations/0003_schedule.sql`, and isn't wired yet.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL, publishable key and MapTiler key
npm run dev                  # http://localhost:5173
```

Leave `.env.local` empty to run on the labeled demo data. Never commit `.env.local`.

### Supabase

1. Apply `supabase/migrations/0001`–`0005` in order:
   - `0001` places
   - `0002` faculty
   - `0003` private schedules
   - `0004` processes
   - `0005` entrances, walkways and floor plans
2. Deploy the AI Guide:
   - `supabase functions deploy ai-guide`
   - `supabase secrets set ANTHROPIC_API_KEY=...`
   The provider key stays server-side.

## How to test

```bash
npm test          # Vitest: unit, component and flow tests, plus migration/RLS tests in PGlite
npm run build     # type-check + production build
```

- **Web tests:** they never read `.env.local`. Tests that need live behavior stub the environment and `fetch`.
- **Database tests:** `supabase/tests` runs the SQL migrations in an in-process Postgres (PGlite) with stand-ins for Supabase's `auth` and `storage` schemas. That proves the SQL and access rules, not that anything is applied to a live project.
- **Mobile tests:** see [`mobile/README.md`](mobile/README.md).

## Still needed for a live demo

- Apply migrations 0003–0005.
- Publish verified places with coordinates, entrances, walkways and floor plans.
- Add an office-link column to `faculty_directory` if teachers should get *Show on map*.
- Add a MapTiler key.
- Deploy `ai-guide`.
- Have a native speaker review the Tagalog and Hiligaynon text.
- Add background push reminders, which need a service worker, VAPID keys and a scheduler.
