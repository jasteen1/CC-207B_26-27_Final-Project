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

1. Apply `supabase/migrations/0001`–`0006` in order, then `0007` once it has been reviewed:
   - `0001` places
   - `0002` faculty
   - `0003` private schedules
   - `0004` processes
   - `0005` entrances, walkways and floor plans
   - `0006` building cards: links map polygons to places, plus `description` and `photo_url`
   - `0007` room labels and room positions on blueprints (**not applied yet**: review it first)
2. Deploy the AI Guide:
   - `supabase functions deploy ai-guide`
   - `supabase secrets set ANTHROPIC_API_KEY=...`
   The provider key stays server-side.

### Tappable buildings (Campus Map)

Tapping a building drawn in our MapTiler "Wayfinder" dataset opens its place card. The card always
shows the dataset name (`name:en`, else `name`). Extra details appear only from a **verified** record:

- **Link a polygon to a place:** insert into `building_features (feature_id, place_id, status)`. Use the
  polygon's `place_id` property from the dataset as `feature_id` and the shared place ID as `place_id`,
  with `status = 'verified'`. A building drawn as two polygons gets two rows pointing at one place.
- **Description and photo:** set `places.description` and `places.photo_url` (a public image URL).
  Without a photo, the card shows "Building photo coming soon". To collect and add photos, see
  [`BUILDING_PHOTOS_GUIDE.md`](BUILDING_PHOTOS_GUIDE.md).
- **Offices, rooms, floors:** come from verified `places` rows whose `parent_id` is the building.
- **Floor plan:** export the approved Canva blueprint as PNG, upload it to a public bucket, and add a
  verified `floor_plans` row for the building and floor. The card then shows *View floor plan*.

## How to test

```bash
npm test          # Vitest: unit, component and flow tests, plus migration/RLS tests in PGlite
npm run build     # type-check + production build
```

- **Web tests:** they never read `.env.local`. Tests that need live behavior stub the environment and `fetch`.
- **Database tests:** `supabase/tests` runs the SQL migrations in an in-process Postgres (PGlite) with stand-ins for Supabase's `auth` and `storage` schemas. That proves the SQL and access rules, not that anything is applied to a live project.
- **Mobile tests:** see [`mobile/README.md`](mobile/README.md).

## Still needed for a live demo

- Apply migrations 0003–0006.
- Link building polygons to verified places (`building_features`).
- Publish verified places with coordinates, entrances, walkways and floor plans.
- Add an office-link column to `faculty_directory` if teachers should get *Show on map*.
- Add a MapTiler key.
- Deploy `ai-guide`.
- Have a native speaker review the Tagalog and Hiligaynon text.
- Add background push reminders, which need a service worker, VAPID keys and a scheduler.
