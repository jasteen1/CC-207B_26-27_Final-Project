# Building photos: contributor guide

How to collect a front-view photo of each campus building, match it to the building's ID, and get it
onto the building card in the WayFinder web and mobile apps.

## How the card picks a photo

- Tapping a building on the Campus Map opens its card. The card shows a photo only when the building is
  linked to a **verified** row in `public.places` (through `building_features`) and that row's
  `photo_url` is set.
- `photo_url` must be a **full public URL** (`https://…`). The Flutter app cannot load a relative path.
- If `photo_url` is empty or the image fails to load, the card shows **"Building photo coming soon"**
  and everything else still works.

Code: `src/features/map/BuildingCard.tsx` (web) and `mobile/lib/widgets/building_card.dart` (Flutter).

## 1. Collect the originals

Ask each teammate for their photo of the buildings they covered:

- **Front view** of the main entrance, landscape, in daylight, with the whole facade in frame.
- **Original file**, not a chat-app copy. Messenger and WhatsApp compress photos, so send through
  Google Drive or a file link instead.
- No close-up faces or readable plate numbers.

Save every original in **`data-intake/building-photos/`** inside the WayFinder folder. Git ignores this
folder, so originals never get committed. Keep extra shots you don't use in
`data-intake/building-photos/_extras/`.

Track progress in `data-intake/campus-photo-inventory.csv`: fill in `photo_taken` (who took it and when)
and `notes_from_campus_walk`.

## 2. Match each photo to its building ID

**File name = the building's exact `places.id`**, lowercase, with `.jpg`. For example, use
`bldg-quezon-hall.jpg`.

1. Find the building's row in `campus-photo-inventory.csv` by `map_name_exact`.
2. Its `proposed_wayfinder_building_id` (e.g. `bldg-quezon-hall`) is the likely ID. **Confirm it** in
   Supabase (Table Editor → `places`, `kind = building`) before you rename the file. If they differ,
   use the ID from `places`.
3. Rename your chosen photo to that ID.

Watch out for these two columns:

- `place_id` in the inventory is the **map polygon number** (it goes in `building_features.feature_id`).
  It is **not** `places.id`.
- `suggested_photo_filename` (e.g. `p10_quezon-hall_01.jpg`) is an older suggestion. Don't use it. Name
  files by `places.id` instead.

Then make a **display copy** for the app. The card crops photos to 16:9, so crop to 16:9 yourself,
resize to about 1600 px wide, and save as JPG under 500 KB with the same file name.

## 3. Publish the photo (later step: needs Supabase access)

These steps change the live project. Do them only once the team agrees to publish.

1. **Bucket (once):** in Supabase → Storage, create a **public** bucket named `building-photos`.
2. **Upload** the display copy, e.g. `bldg-quezon-hall.jpg`.
3. **Copy its public URL:** click the file, then *Get URL*. It looks like
   `https://<project-ref>.supabase.co/storage/v1/object/public/building-photos/bldg-quezon-hall.jpg`.
   Open it in a private browser window to confirm it loads without signing in.
4. **Save it on the building row** (SQL Editor):

   ```sql
   update public.places
      set photo_url = 'https://<project-ref>.supabase.co/storage/v1/object/public/building-photos/bldg-quezon-hall.jpg'
    where id = 'bldg-quezon-hall';
   ```

   Make sure it says `1 row` updated. If you get 0, the ID is wrong.

The photo only appears once the building's `places` row and its `building_features` link are both
`verified` (see the README's *Tappable buildings* section).

## 4. Run the apps

Web (from `BSIT-3A/WVSU_WayFinder`):

```bash
npm install
cp .env.example .env.local   # add the Supabase URL, publishable key and MapTiler key for live data
npm run dev                  # http://localhost:5173 → Campus Map
npm test                     # automated tests
```

Flutter (from `BSIT-3A/WVSU_WayFinder/mobile`):

```bash
cp env.example.json env.json # same public values
flutter run --dart-define-from-file=env.json
flutter test
```

With the Supabase values blank, both apps run on labeled **demo** data. Never commit `.env.local` or
`env.json`. The tappable building outlines come from MapTiler, so **you always need the MapTiler key**
(`VITE_MAPTILER_KEY` on web, `MAPTILER_KEY` in `env.json`), even in demo mode. Ask the team for it.

## 5. Test the card: a building with a photo, and one without

### In live mode, after publishing

Open Campus Map in **both** the web app and the Flutter app:

| Tap | Expect |
|---|---|
| A building you just published (e.g. Quezon Hall) | The photo shows at the top of the card, and the alt text/label reads "Photo of Quezon Hall". The name, details and buttons work. |
| A building with no `photo_url` | The striped "Building photo coming soon" placeholder shows. The card still opens, *Details* works, and *Close* works. |

### In demo mode, before anything is published

To preview a photo locally, add it to the demo fixture **temporarily**. Set the MapTiler key and leave
the Supabase values blank.

1. In `src/data/demo/places.json`, find `"id": "bldg-demo-library"` and add
   `"photoUrl": "<the public https URL of your display copy>"`. For Flutter, make the same edit in
   `mobile/assets/demo/places.json`, which must stay an exact copy.
2. Web: `npm run dev`, then go to Campus Map and tap **Library**. The photo shows.
   Flutter: `flutter run`, then go to Map and tap **Library**. The photo shows.
3. Tap **Rizal Hall** (no linked record). It shows "Building photo coming soon" and still opens normally.
4. Optional: change the URL to a broken one. The card falls back to the placeholder instead of
   breaking.
5. **Undo the fixture edit** before committing:

   ```bash
   git checkout -- src/data/demo/places.json mobile/assets/demo/places.json
   ```

   Demo fixtures are labeled placeholders, so a real photo must never be committed into them.

## Checklist per building

- [ ] Original saved in `data-intake/building-photos/` as `<places.id>.jpg`
- [ ] ID confirmed in Supabase `places`
- [ ] 16:9 display copy, ~1600 px wide, under 500 KB
- [ ] `photo_taken` filled in `campus-photo-inventory.csv`
- [ ] *(Publishing)* Uploaded to `building-photos`, public URL opens, and `photo_url` updated 1 row
- [ ] Card checked on web and Flutter, plus one building without a photo
