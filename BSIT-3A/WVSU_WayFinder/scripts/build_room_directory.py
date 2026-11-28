#!/usr/bin/env python3
"""Builds the campus room directory from the blueprint transcriptions.

Inputs
  data-intake/room-labels.csv        rooms transcribed from the 20 blueprints in blueprints/
  data-intake/room-labels-added.csv  rooms from NAB, Rizal Hall and College of Nursing
                                     (scripts/transcribe_added_blueprints.py)
  src/wf/data/campus.ts              building outlines, used to place each building on the map

Outputs
  supabase/seed/room_directory.sql   buildings, rooms, offices, floor plans, room positions and code prefixes
                                     for Supabase. Needs migrations 0001-0008. Safe to re-run (upserts).
  supabase/seed/floor-plans/         the floor-plan images the SQL points at. Upload this folder to the
                                     public 'floor-plans' storage bucket.
  src/wf/data/rooms.ts               the same directory bundled into the app (used offline or before Supabase is set up)

Run: python3 scripts/build_room_directory.py
"""
import csv
import json
import re
import shutil
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INTAKE = ROOT / "data-intake"
SEED = ROOT / "supabase" / "seed"
FLOOR_SRC = [INTAKE / "floor-plan-images", ROOT / "blueprints", Path.home() / "Downloads/WayFinder-Prototype/blueprints"]

# Every building the blueprints cover.
# db id -> (name, short name, WayFinder app id, map outline name, other names people use)
BUILDINGS = {
    "bldg-administration": ("Administration Building", "Admin", "administration", "Administration", ["Admin Building"]),
    "bldg-center-for-foreign-languages": ("Center for Foreign Languages", "CFL", "cfl", "Center for Foreign Languages", []),
    "bldg-cict-building": ("CICT Building", "CICT", "cict-building", "CICT Building", ["College of Information and Communications Technology", "ICT Building"]),
    "bldg-college-of-business-and-management": ("College of Business and Management", "CBM", "cbm", "College of Business and Management", []),
    "bldg-college-of-communication": ("College of Communication", "COC", "coc", "College of Communication", ["Mass Communication"]),
    "bldg-college-of-dentistry": ("College of Dentistry", "COD", "cod", "College of Dentistry", []),
    "bldg-college-of-medicine-roxas-hall": ("College of Medicine (Roxas Hall)", "Roxas Hall", "com-roxas", "College of Medicine (Roxas Hall)", ["COM", "Roxas Hall"]),
    "bldg-psfw-building-college-of-medicine-annex-1": ("PSFW Building / College of Medicine (Annex 1)", "COM Annex 1", "com-annex1", "PSFW Building / College of Medicine (Annex 1)", ["PSFW Building", "COM Annex Building 1"]),
    "bldg-college-of-medicine-annex-3": ("College of Medicine – Annex 3", "COM Annex 3", "com-annex3", "College of Medicine - Annex 3", ["COM Skills Building", "Skills Building Annex 3"]),
    "bldg-com-sdg-rooms": ("College of Medicine – SDG Rooms", "COM SDG Rooms", None, None, ["Small Group Discussion Rooms", "SDG Rooms"]),
    "bldg-coop-building": ("Coop Building (School Canteen)", "Coop", "coop", "Coop Building", ["Canteen", "Cooperative"]),
    "bldg-hometel": ("Hometel (Student Center)", "Hometel", "hometel", "Hometel", ["Student Center", "Students' Center"]),
    "bldg-quezon-hall": ("Quezon Hall", "QH", "quezon-hall", "Quezon Hall", []),
    "bldg-cop-building": ("COP Building (College of PESCAR)", "COP", "cop", "COP Building", ["College of PESCAR", "PESCAR", "EB Building"]),
    "bldg-college-of-law": ("College of Law", "COL", "col", None, ["Law"]),
    "bldg-research-building-1": ("Research Building 1", "Research Bldg 1", "rb1", "Research Building 1", []),
    "bldg-research-building-2": ("Research Building 2", "Research Bldg 2", "rb2", "Research Building 2", []),
    "bldg-new-academic-building": ("New Academic Building", "NAB", "nab", "New Academic Building", []),
    "bldg-rizal-hall": ("Rizal Hall", "RH", "rizal-hall", "Rizal Hall", []),
    "bldg-college-of-nursing": ("College of Nursing", "CON", "nursing", "College of Nursing", []),
}

# Which building each blueprint sheet belongs to (overrides the CSV's building column).
SHEET_BUILDING = {
    "admin building.png": "bldg-administration",
    "cfl.png": "bldg-center-for-foreign-languages",
    "college of information and communications technology.png": "bldg-cict-building",
    "college of business and management.png": "bldg-college-of-business-and-management",
    "college of communications.png": "bldg-college-of-communication",
    "college of dentistry.png": "bldg-college-of-dentistry",
    "roxas hall.png": "bldg-college-of-medicine-roxas-hall",
    "roxas hall 2.png": "bldg-college-of-medicine-roxas-hall",
    "annex 1.png": "bldg-psfw-building-college-of-medicine-annex-1",
    "annex 1_2.png": "bldg-psfw-building-college-of-medicine-annex-1",
    "college of medicine annex 3.png": "bldg-college-of-medicine-annex-3",
    "annex 3 part 2.png": "bldg-college-of-medicine-annex-3",
    "sdg rooms.png": "bldg-com-sdg-rooms",
    "coop.png": "bldg-coop-building",
    "hometel.png": "bldg-hometel",
    "quezon hall.png": "bldg-quezon-hall",
    # Same sheet as "cop building.png": EB 101-208, COP SC, Dance and Cultural Office.
    "college of pescar.png": "bldg-cop-building",
    "college of law.png": "bldg-college-of-law",
    "research building 1.png": "bldg-research-building-1",
    "research building 2.png": "bldg-research-building-2",
    "new academic building.png": "bldg-new-academic-building",
    "rizal hall.png": "bldg-rizal-hall",
    "college of nursing.png": "bldg-college-of-nursing",
    "college of nursing 2.png": "bldg-college-of-nursing",
    "college of nursing 3.png": "bldg-college-of-nursing",
}

# Map centroids with known coordinates (from the MapTiler dataset), used to fit the outline -> lng/lat transform.
ANCHORS = {
    "Administration": (122.561881, 10.714219), "Center for Foreign Languages": (122.56267, 10.715198),
    "CICT Building": (122.561602, 10.713152), "College of Business and Management": (122.563924, 10.712069),
    "College of Communication": (122.562264, 10.714763), "College of Dentistry": (122.563568, 10.712278),
    "Coop Building": (122.561084, 10.712793), "Hometel": (122.562861, 10.712854), "Quezon Hall": (122.562676, 10.71313),
}

TYPES = {"room": "room", "lab": "lab", "office": "office", "facility": "facility"}
SOURCE_NOTE = "blueprint transcription"


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower().replace("&", "and")).strip("-")


def q(v):
    if v is None or v == "":
        return "null"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def arr(xs):
    return "array[" + ", ".join(q(x) for x in xs) + "]::text[]" if xs else "null"


def solve3(A, b):
    """Least squares for 3 unknowns via normal equations (no numpy)."""
    M = [[sum(r[i] * r[j] for r in A) for j in range(3)] for i in range(3)]
    v = [sum(r[i] * y for r, y in zip(A, b)) for i in range(3)]
    for c in range(3):
        p = max(range(c, 3), key=lambda r: abs(M[r][c]))
        M[c], M[p], v[c], v[p] = M[p], M[c], v[p], v[c]
        for r in range(3):
            if r != c:
                f = M[r][c] / M[c][c]
                M[r] = [a - f * bb for a, bb in zip(M[r], M[c])]
                v[r] -= f * v[c]
    return [v[i] / M[i][i] for i in range(3)]


def building_coords():
    text = (ROOT / "src/wf/data/campus.ts").read_text()
    shapes = json.loads(re.search(r"CAMPUS: any = (\{.*\});?\s*$", text, re.S).group(1).rstrip(";"))["shapes"]
    centre = {s["name"]: (s["cx"], s["cy"]) for s in shapes if "cx" in s}
    pts = [(centre[n], ll) for n, ll in ANCHORS.items() if n in centre]
    A = [[x, y, 1.0] for (x, y), _ in pts]
    lng = solve3(A, [ll[0] for _, ll in pts])
    lat = solve3(A, [ll[1] for _, ll in pts])
    err = max(abs(sum(a * c for a, c in zip(r, lng)) - ll[0]) + abs(sum(a * c for a, c in zip(r, lat)) - ll[1]) for r, (_, ll) in zip(A, pts))
    out = {}
    for bid, (_, _, _, shape, _) in BUILDINGS.items():
        if shape in ANCHORS:
            out[bid] = ANCHORS[shape]
        elif shape in centre:
            x, y = centre[shape]
            out[bid] = (round(lng[0] * x + lng[1] * y + lng[2], 6), round(lat[0] * x + lat[1] * y + lat[2], 6))
    return out, err


def load_rows():
    rows = []
    for name in ("room-labels.csv", "room-labels-added.csv"):
        with (INTAKE / name).open(newline="") as f:
            rows += list(csv.DictReader(f))
    return rows


def main():
    rows = load_rows()
    coords, fit_err = building_coords()
    env = {}
    for envf in (ROOT / ".env", ROOT / ".env.local"):  # .env.local wins, as in Vite
      for line in envf.read_text().splitlines() if envf.exists() else []:
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"')
    base = env.get("VITE_SUPABASE_URL", "").rstrip("/")
    public = f"{base}/storage/v1/object/public/floor-plans/" if base else "floor-plans/"

    # ---- floor plans ----
    plans, plan_files = {}, {}
    for r in rows:
        bid = SHEET_BUILDING[r["blueprint_filename"]]
        r["_bid"] = bid
        r["_floor"] = int(r["floor"]) if r["floor"].isdigit() else None
        img = r["app_image"] or r["blueprint_filename"]
        file = img if img.endswith(".png") and "-" in img and " " not in img else slug(Path(img).stem) + ".png"
        if file != img:
            plan_files[file] = img
        pid = f"fp-{bid.removeprefix('bldg-')}-{r['_floor'] if r['_floor'] else 'plan'}"
        if pid in plans and plans[pid]["file"] != file:
            pid += "-" + slug(Path(file).stem)[-12:]
        plans.setdefault(pid, {"building": bid, "floor": r["_floor"], "file": file,
                               "label": f"Floor {r['_floor']}" if r["_floor"] else "Floor not printed on the plan"})
        r["_plan"] = pid

    # ---- room codes: must be unique across campus ----
    code_count = Counter(r["search_code"] for r in rows if r["search_code"])
    dup = {c for c, n in code_count.items() if n > 1}
    if dup:
        raise SystemExit(f"duplicate room codes: {sorted(dup)}")

    prefixes = defaultdict(set)
    for r in rows:
        if r["search_code"]:
            prefixes[re.match(r"[A-Z]+", r["search_code"]).group()].add(r["_bid"])

    # ---- SQL ----
    out = ["-- Campus room directory: every room and office transcribed from the WVSU blueprints.",
           "-- Generated by scripts/build_room_directory.py from data-intake/room-labels*.csv. Do not edit by hand.",
           f"-- {len(BUILDINGS)} buildings, {len(rows)} rooms and offices, {len(plans)} floor plans.",
           "-- Requires migrations 0001-0008. Safe to re-run: every insert upserts on its primary key.",
           "-- Rows the transcription flagged are still published; review_note says what to double-check.",
           "begin;", ""]
    out.append("-- Buildings")
    for bid, (name, short, _, _, aka) in BUILDINGS.items():
        lng, lat = coords.get(bid, (None, None))
        out.append("insert into public.places (id, kind, name, short_name, aka, lng, lat, status, source, verified_by, verified_at) values "
                   f"({q(bid)}, 'building', {q(name)}, {q(short)}, {arr(aka)}, {q(lng)}, {q(lat)}, 'verified', {q(SOURCE_NOTE + '; map outline centroid')}, {q(SOURCE_NOTE)}, now()) "
                   "on conflict (id) do update set kind = excluded.kind, name = excluded.name, short_name = excluded.short_name, aka = excluded.aka, "
                   "lng = coalesce(public.places.lng, excluded.lng), lat = coalesce(public.places.lat, excluded.lat), status = excluded.status, "
                   "source = coalesce(public.places.source, excluded.source), verified_by = excluded.verified_by, verified_at = excluded.verified_at;")
    out += ["", "-- Floor plans (image_url points into the public 'floor-plans' storage bucket; upload supabase/seed/floor-plans/)"]
    for pid, p in sorted(plans.items()):
        out.append("insert into public.floor_plans (id, building_id, floor, label, image_url, status) values "
                   f"({q(pid)}, {q(p['building'])}, {q(p['floor'])}, {q(p['label'])}, {q(public + p['file'])}, 'verified') "
                   "on conflict (id) do update set building_id = excluded.building_id, floor = excluded.floor, label = excluded.label, image_url = excluded.image_url, status = excluded.status;")
    codes = sorted(r["search_code"] for r in rows if r["search_code"])
    ids = [r["place_id"] for r in rows if r["search_code"]]
    out += ["", "-- room_code is unique: if an older row (another id) already holds one of these codes, free the code first.",
            f"update public.places set room_code = null where room_code in ({', '.join(q(c) for c in codes)}) and id not in ({', '.join(q(i) for i in ids)});"]
    out += ["", "-- Rooms and offices"]
    for r in rows:
        kind = "office" if r["kind"] == "office" else "room"
        src = f"blueprint {r['blueprint_filename']}"
        out.append("insert into public.places (id, kind, name, room_label, room_code, room_type, floor, parent_id, status, source, review_note, verified_by, verified_at) values "
                   f"({q(r['place_id'])}, {q(kind)}, {q(r['name'])}, {q(r['printed_label'])}, {q(r['search_code'])}, {q(TYPES[r['kind']])}, {q(r['_floor'])}, "
                   f"{q(r['_bid'])}, 'verified', {q(src)}, {q(r['review_note'])}, {q(SOURCE_NOTE)}, now()) "
                   "on conflict (id) do update set kind = excluded.kind, name = excluded.name, room_label = excluded.room_label, room_code = excluded.room_code, "
                   "room_type = excluded.room_type, floor = excluded.floor, parent_id = excluded.parent_id, status = excluded.status, source = excluded.source, "
                   "review_note = excluded.review_note, verified_by = excluded.verified_by, verified_at = excluded.verified_at;")
    out += ["", "-- Where each room sits on its floor plan (fractions of the image, 0-1)"]
    for r in rows:
        if r["shape"] != "rect":
            continue
        out.append("insert into public.floor_plan_rooms (id, floor_plan_id, place_id, label, shape, x, y, w, h, status) values "
                   f"({q('spot-' + r['place_id'])}, {q(r['_plan'])}, {q(r['place_id'])}, {q(r['printed_label'])}, 'rect', "
                   f"{float(r['x'])}, {float(r['y'])}, {float(r['width'])}, {float(r['height'])}, 'verified') "
                   "on conflict (id) do update set floor_plan_id = excluded.floor_plan_id, label = excluded.label, x = excluded.x, y = excluded.y, w = excluded.w, h = excluded.h, status = excluded.status;")
    out += ["", "-- Room-code prefixes (the letters before the number on a door)"]
    for p, bids in sorted(prefixes.items()):
        if len(bids) != 1:
            continue
        bid = next(iter(bids))
        out.append("insert into public.room_code_prefixes (prefix, building_id, map_name, status) values "
                   f"({q(p)}, {q(bid)}, {q(BUILDINGS[bid][3])}, 'verified') "
                   "on conflict (prefix) do update set building_id = excluded.building_id, map_name = excluded.map_name, status = excluded.status;")
    out += ["", "commit;", ""]
    SEED.mkdir(parents=True, exist_ok=True)
    (SEED / "room_directory.sql").write_text("\n".join(out))

    # ---- floor plan images for upload ----
    img_dir = SEED / "floor-plans"
    img_dir.mkdir(exist_ok=True)
    missing = []
    for p in plans.values():
        want = plan_files.get(p["file"], p["file"])
        src = next((d / want for d in FLOOR_SRC if (d / want).exists()), None)
        if src:
            shutil.copyfile(src, img_dir / p["file"])
        else:
            missing.append(want)

    # ---- bundled app data ----
    bundle_b = {bid: {"name": n, "short": s, "app": a, "aka": aka, "lng": coords.get(bid, (None, None))[0], "lat": coords.get(bid, (None, None))[1]}
                for bid, (n, s, a, _, aka) in BUILDINGS.items()}
    bundle_r = [{"id": r["place_id"], "b": r["_bid"], "name": r["name"], "label": r["printed_label"], "code": r["search_code"] or None,
                 "type": TYPES[r["kind"]], "floor": r["_floor"]} for r in rows]
    ts = ["// Generated by scripts/build_room_directory.py from data-intake/room-labels*.csv. Do not edit by hand.",
          "// The same rows are in supabase/seed/room_directory.sql; the app prefers the live Supabase copy when configured.",
          "export interface DirBuilding { name: string; short: string; app: string | null; aka: string[]; lng: number | null; lat: number | null }",
          "export interface DirRoom { id: string; b: string; name: string; label: string; code: string | null; type: \"room\" | \"lab\" | \"office\" | \"facility\"; floor: number | null }",
          f"export const DIR_BUILDINGS: Record<string, DirBuilding> = {json.dumps(bundle_b, ensure_ascii=False)};",
          f"export const DIR_ROOMS: DirRoom[] = {json.dumps(bundle_r, ensure_ascii=False)};", ""]
    (ROOT / "src/wf/data/rooms.ts").write_text("\n".join(ts))

    per = Counter(r["_bid"] for r in rows)
    print(f"{len(rows)} rooms/offices in {len(per)} buildings, {len(plans)} floor plans, {sum(1 for r in rows if r['shape'] == 'rect')} positioned")
    print(f"map fit residual (deg): {fit_err:.6f}; buildings without coordinates: {[b for b in BUILDINGS if b not in coords]}")
    for bid, n in sorted(per.items(), key=lambda kv: -kv[1]):
        print(f"  {n:4} {BUILDINGS[bid][0]}")
    if missing:
        print("floor plan images not found:", missing)


if __name__ == "__main__":
    main()
