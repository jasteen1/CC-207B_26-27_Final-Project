import { useMemo, useState } from "react";
import { roomDisplay } from "../../lib/search";
import type { PlaceView } from "../../lib/types";
import type { Building } from "./buildings";

/**
 * Choose a starting building, room or office record, or any building drawn on the campus map
 * (indoors, poor GPS, or no permission). A map building is picked as `map:<polygon id>`.
 */
export default function StartPicker({ places, mapBuildings = [], onPick, onClose }: { places: PlaceView[]; mapBuildings?: Building[]; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const mapped = useMemo(() => {
    const recordNames = new Set(places.filter((v) => v.place.kind === "building").map((v) => v.place.name.trim().toLowerCase()));
    return mapBuildings
      .filter((b) => !recordNames.has(b.name.toLowerCase()) && b.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [mapBuildings, places, needle]);
  const usable = useMemo(
    () => places.filter((v) => v.place.kind === "building" || v.place.kind === "room" || v.place.kind === "office")
      .filter((v) => (v.place.lng !== undefined || v.parent?.lng !== undefined) || v.place.kind === "building")
      .filter((v) => `${v.place.name} ${v.place.roomCode ?? ""} ${v.place.roomLabel ?? ""} ${v.parent?.name ?? ""}`.toLowerCase().includes(needle)),
    [places, needle],
  );
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Choose starting point" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Choose starting point</h2>
          <button className="link-btn" onClick={onClose}>Close</button>
        </div>
        <input className="sheet-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Building, room code or office" aria-label="Filter starting points" autoFocus />
        {usable.length === 0 && mapped.length === 0 && <p className="muted">No building or room with a recorded location is available yet.</p>}
        <ul className="pick-list">
          {usable.map((v) => (
            <li key={v.place.id}>
              <button onClick={() => onPick(v.place.id)}>
                <strong>{v.place.roomCode ? roomDisplay(v.place) : v.place.name}</strong>
                <span className="muted small">{v.place.roomCode ? v.place.name : v.place.kind}{v.parent ? ` · ${v.parent.name}` : ""}</span>
              </button>
            </li>
          ))}
        </ul>
        {mapped.length > 0 && (
          <>
            <h3 className="sub-label">On the campus map</h3>
            <ul className="pick-list" aria-label="Buildings on the campus map">
              {mapped.map((b) => (
                <li key={b.key}>
                  <button onClick={() => onPick(b.key)}>
                    <strong>{b.name}</strong>
                    <span className="muted small">campus map</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
