#!/usr/bin/env python3
"""Rooms read off the six blueprints that had no transcription yet (2026-11-28).

New Academic Building, Rizal Hall, COP Building and College of Nursing (3 sheets). Each room box is
recorded in pixels of the full blueprint image, as rendered at its native size, then normalised to
0-1 fractions. The floor plan for these rows is the whole sheet (`app_image` = the blueprint itself).

COP Building is the same sheet as "college of pescar.png" (same EB 101-208 rooms, COP SC, Dance and
Cultural Office). Its rooms are already in room-labels.csv, so this script only re-points those rows
at the COP Building and does not add them twice.

Writes data-intake/room-labels-added.csv. Run: python3 scripts/transcribe_added_blueprints.py
"""
import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data-intake" / "room-labels-added.csv"
FIELDS = ["printed_label", "search_code", "kind", "name", "place_id", "wayfinder_building_id", "building_match", "floor",
          "blueprint_filename", "app_image", "shape", "x", "y", "width", "height", "polygon_points", "confidence", "review_note"]

# (file, width, height, building id, slug)
SHEETS = {
    "nab": ("new academic building.png", 1231, 2000, "bldg-new-academic-building", "new-academic-building"),
    "rh": ("rizal hall.png", 1600, 2000, "bldg-rizal-hall", "rizal-hall"),
    "con1": ("college of nursing.png", 1600, 2000, "bldg-college-of-nursing", "college-of-nursing"),
    "con2": ("college of nursing 2.png", 1600, 2000, "bldg-college-of-nursing", "college-of-nursing"),
    "con3": ("college of nursing 3.png", 1600, 2000, "bldg-college-of-nursing", "college-of-nursing"),
}

# sheet, floor, printed label, kind, name, search code, (x0, y0, x1, y1) px, note
R = []
def add(sheet, floor, label, kind, box, name=None, code="", note=""):
    R.append((sheet, floor, label, kind, name or label, code, box, note))

# ---- New Academic Building (NAB): 3 floors, rooms around a central court ----
# Floor 1 (sheet prints no floor name; 2nd and 3rd are labelled below their plans)
for i, n in enumerate([109, 108, 107, 106, 105]):
    add("nab", 1, f"NAB {n}", "room", (392 + i * 87.5, 338, 392 + (i + 1) * 87.5, 414), code=f"NAB{n}")
for i, n in enumerate([110, 111, 112, 113]):
    add("nab", 1, f"NAB {n}", "room", (285, 414 + i * 88, 362, 414 + (i + 1) * 88), code=f"NAB{n}")
for i, n in enumerate([104, 103]):
    add("nab", 1, f"NAB {n}", "room", (857, 414 + i * 88, 934, 414 + (i + 1) * 88), code=f"NAB{n}")
add("nab", 1, "ILS FACULTY OFFICE (NAB 102)", "office", (857, 590, 934, 678), name="ILS Faculty Office", code="NAB102")
add("nab", 1, "EDUCATION STUDENT COUNCIL (NAB 101)", "office", (857, 678, 934, 766), name="Education Student Council", code="NAB101")
for i, n in enumerate([114, 115, 116, 117, 118]):
    add("nab", 1, f"NAB {n}", "room", (393 + i * 87, 766, 393 + (i + 1) * 87, 840), code=f"NAB{n}")
# Floor 2
for i, n in enumerate([209, 208, 207, 206, 205]):
    add("nab", 2, f"NAB {n}", "room", (379 + i * 92.5, 953, 379 + (i + 1) * 92.5, 1031), code=f"NAB{n}")
for i, n in enumerate([210, 211, 212, 213]):
    add("nab", 2, f"NAB {n}", "room", (272, 1015 + i * 81, 357, 1015 + (i + 1) * 81), code=f"NAB{n}")
for i, n in enumerate([204, 203, 202, 201]):
    add("nab", 2, f"NAB {n}", "room", (862, 1015 + i * 81, 948, 1015 + (i + 1) * 81), code=f"NAB{n}")
for i, n in enumerate([214, 215, 216, 217, 218]):
    add("nab", 2, f"NAB {n}", "room", (379 + i * 92.5, 1343, 379 + (i + 1) * 92.5, 1423), code=f"NAB{n}")
# Floor 3
for i, n in enumerate([309, 308, 307, 306, 305]):
    add("nab", 3, f"NAB {n}", "room", (376 + i * 95.5, 1510, 376 + (i + 1) * 95.5, 1573), code=f"NAB{n}")
for i, n in enumerate([310, 311, 312, 313]):
    add("nab", 3, f"NAB {n}", "room", (278, 1566 + i * 70, 356, 1566 + (i + 1) * 70), code=f"NAB{n}")
for i, n in enumerate([304, 303, 302, 301]):
    add("nab", 3, f"NAB {n}", "room", (874, 1566 + i * 70, 952, 1566 + (i + 1) * 70), code=f"NAB{n}")
add("nab", 3, "FUNCTION HALL", "facility", (376, 1845, 855, 1917), name="Function Hall")

# ---- Rizal Hall: ground and second floor ----
add("rh", 1, "DISSECTION ROOM", "lab", (108, 618, 258, 797), name="Dissection Room")
for i, n in enumerate([106, 105, 104, 103, 102, 101]):
    add("rh", 1, f"RH {n}", "room", (314 + i * 162.3, 618, 314 + (i + 1) * 162.3, 758), code=f"RH{n}")
add("rh", 1, "PHYSICAL SCIENCE DEPARTMENT", "office", (1345, 618, 1491, 729), name="Physical Science Department")
add("rh", 2, "RH 204", "room", (108, 978, 254, 1209), code="RH204")
add("rh", 2, "RH 203", "room", (310, 978, 502, 1118), code="RH203")
add("rh", 2, "CSL CHEMICAL SECTION", "lab", (502, 978, 698, 1118), name="Central Science Laboratory – Chemical Section")
add("rh", 2, "RH 202", "room", (698, 978, 893, 1118), code="RH202")
add("rh", 2, "CSL APPARATUS SECTION", "lab", (893, 978, 1087, 1118), name="Central Science Laboratory – Apparatus Section")
add("rh", 2, "RH 201", "room", (1087, 978, 1284, 1118), code="RH201")
add("rh", 2, "CENTRAL SCIENCE LABORATORY OFFICE", "office", (1342, 978, 1492, 1209), name="Central Science Laboratory Office")

# ---- College of Nursing: three sheets, one per floor ----
add("con1", 1, "CR", "facility", (381, 587, 477, 660))
add("con1", 1, "ROOM 101", "room", (278, 665, 477, 846), name="Room 101")
add("con1", 1, "ROOM 102", "room", (278, 851, 477, 1492), name="Room 102",
    note="one box printed ROOM 102 with FACULTY OFFICE twice inside it; the faculty offices are listed separately")
add("con1", 1, "FACULTY OFFICE", "office", (278, 851, 477, 1130), name="Faculty Office",
    note="printed inside the ROOM 102 box (upper); no wall drawn")
add("con1", 1, "FACULTY OFFICE", "office", (278, 1300, 477, 1492), name="Faculty Office",
    note="printed inside the ROOM 102 box (lower); no wall drawn")
add("con1", 1, "ROOM 105", "room", (558, 821, 1045, 1137), name="Room 105")
add("con1", 1, "MEZZANINE", "facility", (482, 1220, 705, 1492), name="Mezzanine")
add("con1", 1, "CR", "facility", (634, 1220, 705, 1334))
add("con1", 1, "CR", "facility", (886, 1220, 1000, 1332))
add("con1", 1, "DEAN'S OFFICE", "office", (886, 1336, 1000, 1492), name="Dean's Office")
add("con1", 1, "SECRETARY OFFICE", "office", (1004, 1220, 1119, 1356), name="Secretary Office",
    note="shares one box with ROOM 104 (no wall drawn between them)")
add("con1", 1, "ROOM 104", "room", (1004, 1356, 1119, 1492), name="Room 104",
    note="shares one box with SECRETARY OFFICE (no wall drawn between them)")
add("con1", 1, "CR", "facility", (1124, 821, 1249, 933))
add("con1", 1, "AMPHITHEATER", "room", (1124, 938, 1335, 1250), name="Amphitheater",
    note="shares one box with ROOM 103 (no wall drawn between them)")
add("con1", 1, "ROOM 103", "room", (1124, 1250, 1335, 1492), name="Room 103",
    note="shares one box with AMPHITHEATER (no wall drawn between them)")
add("con1", 1, "Lobby", "facility", (540, 1580, 1044, 1750), name="Lobby", note="open lobby by the stairs")

add("con2", 2, "CR", "facility", (381, 587, 477, 660))
add("con2", 2, "OPERATING ROOM", "lab", (278, 665, 477, 846), name="Operating Room")
add("con2", 2, "SKILLS LABORATORY", "lab", (278, 851, 358, 1218), name="Skills Laboratory", note="printed vertically")
add("con2", 2, "WARD 1", "lab", (358, 851, 477, 891), name="Ward 1")
add("con2", 2, "WARD 2", "lab", (358, 893, 477, 972), name="Ward 2")
add("con2", 2, "WARD 3", "lab", (358, 975, 477, 1054), name="Ward 3")
add("con2", 2, "WARD 4", "lab", (358, 1056, 477, 1135), name="Ward 4")
add("con2", 2, "ICU", "lab", (358, 1138, 477, 1218), name="ICU")
add("con2", 2, "ROOM 201", "room", (278, 1218, 477, 1492), name="Room 201")
add("con2", 2, "ROOM 202", "room", (482, 1220, 1117, 1492), name="Room 202")
add("con2", 2, "CR", "facility", (1124, 821, 1249, 933))
add("con2", 2, "ROOM 203", "room", (1124, 938, 1335, 1492), name="Room 203")

add("con3", 3, "CR", "facility", (381, 587, 477, 660))
add("con3", 3, "LEVEL IV ROOM 301", "room", (278, 665, 477, 1492), name="Room 301 (Level IV)")
add("con3", 3, "ROOM 302", "room", (482, 1220, 1117, 1492), name="Room 302")
add("con3", 3, "CR", "facility", (1124, 821, 1249, 933))
add("con3", 3, "ROOM 303", "room", (1124, 938, 1335, 1492), name="Room 303")


def slug(s):
    s = s.lower().replace("&", "and").replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def main():
    rows, seen = [], {}
    for sheet, floor, label, kind, name, code, (x0, y0, x1, y1), note in R:
        fname, W, H, bid, bslug = SHEETS[sheet]
        prefix = "office" if kind == "office" else "room"
        base = f"{prefix}-{bslug}-f{floor}-{slug(name)}"
        seen[base] = seen.get(base, 0) + 1
        pid = base if seen[base] == 1 else f"{base}-{seen[base]}"
        rows.append({
            "printed_label": label, "search_code": code, "kind": kind, "name": name, "place_id": pid,
            "wayfinder_building_id": bid, "building_match": "confirmed", "floor": floor, "blueprint_filename": fname,
            "app_image": fname, "shape": "rect",
            "x": round(x0 / W, 4), "y": round(y0 / H, 4), "width": round((x1 - x0) / W, 4), "height": round((y1 - y0) / H, 4),
            "polygon_points": "", "confidence": "needs review" if note else "legible", "review_note": note,
        })
    with OUT.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} rows to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
