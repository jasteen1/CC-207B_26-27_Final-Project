import { useEffect, useState } from "react";
import type { FloorPlan, RoomSpot } from "../../lib/types";
import PlanImage from "./PlanImage";

const MIN = 1, MAX = 4, STEP = 0.5;

/**
 * Approved floor plan (e.g. a Canva blueprint export) with zoom controls. Scroll or drag to pan.
 * With `highlight`, opens on the blueprint that room is marked on and keeps it highlighted at every zoom.
 */
export default function FloorPlanViewer({ plans, building, onClose, highlight }: { plans: FloorPlan[]; building: string; onClose: () => void; highlight?: RoomSpot }) {
  const [index, setIndex] = useState(() => Math.max(0, highlight ? plans.findIndex((p) => p.id === highlight.floorPlanId) : 0));
  const [zoom, setZoom] = useState(1);
  const plan = plans[index];
  useEffect(() => setZoom(1), [index]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!plan) return null;
  const title = plan.label ?? `${building} floor ${plan.floor}`;
  const spot = highlight?.floorPlanId === plan.id ? highlight : undefined;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet plan-viewer" role="dialog" aria-modal="true" aria-label={`Floor plan: ${title}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="link-btn" onClick={onClose}>Close</button>
        </div>
        {plans.length > 1 && (
          <div className="chips" role="tablist" aria-label="Floor">
            {plans.map((p, i) => (
              <button key={p.id} role="tab" aria-selected={i === index} className={`chip${i === index ? " on" : ""}`} onClick={() => setIndex(i)}>Floor {p.floor}</button>
            ))}
          </div>
        )}
        <div className="plan-stage">
          <PlanImage plan={plan} spot={spot} alt={title} zoom={zoom} scrollIntoView={!!spot} />
        </div>
        <div className="plan-zoom" aria-label="Zoom">
          <button className="btn ghost" aria-label="Zoom out" disabled={zoom <= MIN} onClick={() => setZoom((z) => Math.max(MIN, z - STEP))}>−</button>
          <span className="small" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button className="btn ghost" aria-label="Zoom in" disabled={zoom >= MAX} onClick={() => setZoom((z) => Math.min(MAX, z + STEP))}>+</button>
          <button className="btn ghost" onClick={() => setZoom(1)} disabled={zoom === 1}>Reset</button>
        </div>
      </div>
    </div>
  );
}
