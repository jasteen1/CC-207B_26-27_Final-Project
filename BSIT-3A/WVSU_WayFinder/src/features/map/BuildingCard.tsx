import { useEffect, useRef, useState, type ReactNode } from "react";
import { BuildingIcon, RouteIcon } from "../../components/Icons";
import { DataBadge } from "../../components/PlaceCard";
import type { Async } from "../../lib/usePlaces";
import type { BuildingDetails, FloorPlan } from "../../lib/types";
import FloorPlanViewer from "./FloorPlanViewer";

/**
 * The building's photo. Until a real photo exists (places.photo_url), shows a labeled placeholder.
 * To add photos later, set `photo_url` on the verified place record; nothing in the UI changes.
 */
export function BuildingPhoto({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (src && !failed) return <img className="bcard-photo" src={src} alt={`Photo of ${name}`} onError={() => setFailed(true)} />;
  return (
    <div className="bcard-photo placeholder" role="img" aria-label="Building photo coming soon">
      <BuildingIcon />
      <span>Building photo coming soon</span>
    </div>
  );
}

interface Props {
  /** The map dataset's building name, shown immediately (before any record loads). */
  name: string;
  details: Async<BuildingDetails | null>;
  variant: "sheet" | "side";
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
  onClose: () => void;
  onDirections: (placeId: string) => void;
}

/** Google Maps-style place card: a bottom sheet on phones, a side card on desktop. */
export default function BuildingCard({ name, details, variant, expanded, onExpandedChange, onClose, onDirections }: Props) {
  const [plan, setPlan] = useState<FloorPlan[] | null>(null);
  const info = details.state === "done" ? details.result.data : null;
  const isSheet = variant === "sheet";
  const showBody = !isSheet || expanded;

  // Drag the handle up to expand, down to collapse (or close when already collapsed).
  const drag = useRef<number | null>(null);
  const handle = (
    <button
      className="bcard-handle"
      aria-label={expanded ? "Collapse details" : "Expand details"}
      aria-expanded={expanded}
      onClick={() => onExpandedChange(!expanded)}
      onPointerDown={(e) => { drag.current = e.clientY; }}
      onPointerUp={(e) => {
        const start = drag.current;
        drag.current = null;
        if (start === null) return;
        const dy = e.clientY - start;
        if (Math.abs(dy) < 24) return; // a tap: onClick toggles
        e.preventDefault();
        if (dy < 0) onExpandedChange(true);
        else if (expanded) onExpandedChange(false);
        else onClose();
      }}
    ><span /></button>
  );

  const linked = info?.place;
  const directions = (
    <button className="btn primary" disabled={!linked} onClick={() => linked && onDirections(linked.id)}>
      <RouteIcon /> Directions
    </button>
  );

  return (
    <aside className={`bcard ${variant}${expanded ? " expanded" : ""}`} aria-label={`${name} details`} data-testid="building-card">
      {isSheet && handle}
      <div className="bcard-head">
        <div className="bcard-title">
          <h2>{name}</h2>
          <p className="muted small">
            WVSU Main Campus {linked && <DataBadge status={linked.status} />}
          </p>
        </div>
        <button className="bcard-close" aria-label="Close" onClick={onClose}>×</button>
      </div>

      <div className="bcard-actions">
        {directions}
        {isSheet && !expanded && <button className="btn ghost" onClick={() => onExpandedChange(true)}>Details</button>}
      </div>
      {details.state === "done" && !linked && <p className="muted small bcard-note">Directions open once this building has a verified record.</p>}

      {showBody && (
        <div className="bcard-body">
          <BuildingPhoto src={info?.photoUrl} name={name} />
          <Details details={details} onViewPlan={setPlan} />
        </div>
      )}

      {plan && <FloorPlanViewer plans={plan} building={name} onClose={() => setPlan(null)} />}
    </aside>
  );
}

function Details({ details, onViewPlan }: { details: Async<BuildingDetails | null>; onViewPlan: (p: FloorPlan[]) => void }) {
  if (details.state === "loading") return <p className="muted small">Loading building details…</p>;
  if (details.state === "error") {
    return (
      <div className="notice warn" role="alert">
        <p style={{ margin: "0 0 8px" }}>Couldn’t load building details.</p>
        <button className="btn ghost" onClick={details.reload}>Retry</button>
      </div>
    );
  }
  const d = details.result.data;
  const hasAny = d && (d.description || d.offices.length || d.rooms.length || d.floors.length || d.floorPlans.length);
  if (!d || !hasAny) return <p className="tbc">Building details coming soon.</p>;
  return (
    <div className="bcard-details">
      {d.description && <p className="bcard-desc">{d.description}</p>}
      {d.floors.length > 0 && <Fact label={d.floors.length === 1 ? "Floor" : "Floors"}>{d.floors.join(", ")}</Fact>}
      {d.offices.length > 0 && (
        <Fact label="Offices">
          <ul className="bcard-list">{d.offices.map((o) => <li key={o.id}>{o.name}{o.floor !== undefined && <span className="muted"> · Floor {o.floor}</span>}</li>)}</ul>
        </Fact>
      )}
      {d.rooms.length > 0 && (
        <Fact label="Rooms">
          <ul className="bcard-chips">{d.rooms.map((r) => <li key={r.id} title={r.name}>{r.roomCode ?? r.name}</li>)}</ul>
        </Fact>
      )}
      {d.floorPlans.length > 0 && <button className="btn ghost wide" onClick={() => onViewPlan(d.floorPlans)}>View floor plan</button>}
    </div>
  );
}

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="bcard-fact"><h3>{label}</h3><div>{children}</div></div>
);
