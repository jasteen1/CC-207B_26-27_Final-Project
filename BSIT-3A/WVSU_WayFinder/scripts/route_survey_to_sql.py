#!/usr/bin/env python3
"""Turns a filled route survey CSV (data-intake/route-survey-*.csv) into reviewable draft SQL.

    python3 -I scripts/route_survey_to_sql.py <survey.csv> [--out supabase/drafts/route_<name>.sql]

Writes walk_nodes, walk_edges (consecutive points, ID independent of direction so shared segments are
reused), the destination building's entrance and, for a Main Gate start, the gate landmark + its entrance.
Everything is 'unverified'; ON CONFLICT DO NOTHING everywhere. Prints problems instead of guessing.
"""
import csv, math, os, re, sys

def dist(a, b):
    R = 6371000
    dl, dg = math.radians(b[0] - a[0]), math.radians(b[1] - a[1])
    s = math.sin(dl / 2) ** 2 + math.cos(math.radians(a[0])) * math.cos(math.radians(b[0])) * math.sin(dg / 2) ** 2
    return 2 * R * math.asin(math.sqrt(s))

q = lambda v: "null" if v is None else "'" + str(v).replace("'", "''") + "'"

def main():
    src = sys.argv[1]
    out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else os.path.join(os.path.dirname(__file__), "..", "supabase", "drafts",
        "route_" + re.sub(r"^route-survey-|\.csv$", "", os.path.basename(src)).replace("-", "_") + ".sql")
    rows = sorted(csv.DictReader(open(src)), key=lambda r: int(r["seq"]))
    problems, pts = [], []
    for r in rows:
        where = f"row seq {r['seq']}"
        if not r["point_id"] or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", r["point_id"]): problems.append(f"{where}: point_id missing or not lower-case-with-dashes")
        try: lat, lng = float(r["lat"]), float(r["lng"])
        except ValueError: problems.append(f"{where}: lat/lng missing"); continue
        if not (10.70 < lat < 10.73 and 122.55 < lng < 122.58): problems.append(f"{where}: {lat},{lng} is not on WVSU Main Campus (lat/lng swapped?)")
        try:
            if float(r["gps_accuracy_m"]) > 10: problems.append(f"{where}: accuracy {r['gps_accuracy_m']} m is worse than 10 m; re-take")
        except ValueError: problems.append(f"{where}: gps_accuracy_m missing")
        pts.append({**r, "ll": (lat, lng)})
    if rows and rows[0]["role"] != "start": problems.append("first row must be role=start")
    if rows and rows[-1]["role"] != "entrance": problems.append("last row must be role=entrance")
    for a, b in zip(pts, pts[1:]):
        d = dist(a["ll"], b["ll"])
        if d > 150: problems.append(f"{a['point_id']} → {b['point_id']}: {d:.0f} m apart; add a junction in between")
    if problems:
        print("Not converted. Fix these in the survey:\n- " + "\n- ".join(problems)); sys.exit(1)

    sql = ["-- DRAFT walking route from " + os.path.basename(src) + ". NOT APPLIED. Review, then publish with your approval.",
           "-- Requires migrations 0005-0007 and the QH 1 pilot (for the Quezon Hall building record). All rows 'unverified'.", "begin;"]
    start, end = pts[0], pts[-1]
    for p in pts:
        sql.append(f"insert into public.walk_nodes (id, lng, lat, status) values ({q('n-' + p['point_id'])}, {p['ll'][1]:.6f}, {p['ll'][0]:.6f}, 'unverified') on conflict (id) do nothing;")
    for a, b in zip(pts, pts[1:]):
        x, y = sorted([a["point_id"], b["point_id"]])
        sql.append(f"insert into public.walk_edges (id, from_node, to_node, length_m, status) values ({q(f'w-{x}--{y}')}, {q('n-' + a['point_id'])}, {q('n-' + b['point_id'])}, {dist(a['ll'], b['ll']):.1f}, 'unverified') on conflict (id) do nothing;")
    # Destination entrance on the building the pilot created/reused (looked up by name, never guessed).
    sql.append(f"""insert into public.entrances (id, building_id, name, lng, lat, node_id, status)
select {q('ent-' + end['point_id'])}, b.id, {q(end['name'] or 'Main entrance')}, {end['ll'][1]:.6f}, {end['ll'][0]:.6f}, {q('n-' + end['point_id'])}, 'unverified'
  from public.places b where b.kind = 'building' and lower(trim(b.name)) = 'quezon hall' order by (b.status = 'verified') desc limit 1
on conflict (id) do nothing;""")
    if "gate" in start["point_id"]:
        sql += [f"insert into public.places (id, kind, name, lng, lat, status, source) values ('landmark-entrance-main-gate', 'landmark', 'Entrance (Main Gate)', {start['ll'][1]:.6f}, {start['ll'][0]:.6f}, 'unverified', 'route survey') on conflict (id) do nothing;",
                "insert into public.building_features (feature_id, place_id, status) values (41, 'landmark-entrance-main-gate', 'unverified') on conflict (feature_id) do nothing;",
                f"insert into public.entrances (id, building_id, name, lng, lat, node_id, status) values ({q('ent-' + start['point_id'])}, 'landmark-entrance-main-gate', {q(start['name'] or 'Main Gate')}, {start['ll'][1]:.6f}, {start['ll'][0]:.6f}, {q('n-' + start['point_id'])}, 'unverified') on conflict (id) do nothing;"]
    sql += ["commit;", "", "-- Publish ONLY after approval (makes exactly this route visible):",
            "-- update public.walk_nodes set status = 'verified' where id in (" + ", ".join(q('n-' + p['point_id']) for p in pts) + ") and status <> 'verified';",
            "-- update public.walk_edges set status = 'verified' where id in (" + ", ".join(q('w-' + '--'.join(sorted([a['point_id'], b['point_id']]))) for a, b in zip(pts, pts[1:])) + ") and status <> 'verified';",
            "-- update public.entrances set status = 'verified' where id in (" + ", ".join(q('ent-' + p['point_id']) for p in (start, end)) + ") and status <> 'verified';",
            "-- update public.places set status = 'verified', verified_by = '<reviewer>', verified_at = now() where id = 'landmark-entrance-main-gate' and status <> 'verified';",
            "-- update public.building_features set status = 'verified' where feature_id = 41 and status <> 'verified';"]
    open(out, "w").write("\n".join(sql) + "\n")
    total = sum(dist(a["ll"], b["ll"]) for a, b in zip(pts, pts[1:]))
    print(f"Wrote {os.path.relpath(out)}: {len(pts)} points, {len(pts) - 1} segments, {total:.0f} m.")

if __name__ == "__main__":
    main()
