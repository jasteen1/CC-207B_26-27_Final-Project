# Campus room directory seed

This seed puts 424 rooms and offices from 20 buildings into Supabase. They come from 25 blueprint sheets, and every row is `status = 'verified'`.

## Load it

1. Apply migrations `0006`, `0007` and `0008`. They're in `supabase/migrations/`. Run `supabase db push`, or paste each file into the SQL editor.
2. Run `room_directory.sql` in the SQL editor. You can run it again safely; every row upserts.
3. Upload everything in `floor-plans/` to a **public** storage bucket named `floor-plans`. `floor_plans.image_url` points there.

## Fetch it from the app

```
GET {SUPABASE_URL}/rest/v1/room_directory?select=*&room_code=eq.NAB201
GET {SUPABASE_URL}/rest/v1/room_directory?select=*&building_id=eq.bldg-rizal-hall&order=floor
GET {SUPABASE_URL}/rest/v1/room_directory?select=*&name=ilike.*dean*
```

`room_directory` is a read-only view, and RLS limits it to verified rows. Each row has:
- the room's name, its label as printed on the door, and its normalized `room_code` (for example `ICT302`)
- its type (`room`, `lab`, `office` or `facility`) and its floor
- its building's name, short name, other names, and lng/lat
- when the room has been positioned, its floor-plan image URL and box (`x`, `y`, `w`, `h` as 0–1 fractions)

The web app's Directory has a **Rooms** tab. It reads this view when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. Otherwise it falls back to the bundled copy in `src/wf/data/rooms.ts`.

## Change the data

Edit `data-intake/room-labels.csv` or `data-intake/room-labels-added.csv`, then run:

```
python3 scripts/build_room_directory.py
npx vitest run supabase/tests
```

The build regenerates the SQL, the images and the bundled app copy. Rows with a `review_note` are published, but the transcription flagged something to double-check: a typo kept as printed, a generic "OFFICE", or a box with no wall drawn.
