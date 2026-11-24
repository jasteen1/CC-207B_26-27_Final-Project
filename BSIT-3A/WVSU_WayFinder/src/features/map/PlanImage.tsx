import { useEffect, useRef } from "react";
import type { FloorPlan, RoomSpot } from "../../lib/types";

/**
 * A blueprint with an optional room highlight. The overlay lives in the same box as the image and
 * uses percentages of that box (the spot's 0-1 fractions), so it stays on the room at any zoom,
 * window size or phone orientation. Strokes don't scale; the marker is HTML so it stays round.
 */
export default function PlanImage({ plan, spot, alt, zoom = 1, scrollIntoView = false }: {
  plan: FloorPlan; spot?: RoomSpot; alt: string; zoom?: number; scrollIntoView?: boolean;
}) {
  const mark = useRef<HTMLSpanElement>(null);
  const pct = (n: number) => `${n * 100}%`;
  const box = spot && spot.shape !== "marker" ? bounds(spot) : undefined;

  useEffect(() => {
    if (scrollIntoView) mark.current?.scrollIntoView?.({ block: "center", inline: "center" });
  }, [scrollIntoView, zoom, spot?.id]);

  return (
    <div className="plan-image" style={{ width: `${zoom * 100}%` }} data-testid="plan-image">
      <img src={plan.imageUrl} alt={alt} draggable={false} width={plan.width} height={plan.height} />
      {spot && (
        <>
          {spot.shape !== "marker" && (
            <svg className="plan-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
              {spot.shape === "rect"
                ? <rect x={spot.x} y={spot.y} width={spot.w} height={spot.h} vectorEffect="non-scaling-stroke" />
                : <polygon points={(spot.points ?? []).map(([x, y]) => `${x},${y}`).join(" ")} vectorEffect="non-scaling-stroke" />}
            </svg>
          )}
          <span
            ref={mark}
            // A room touching the top of the image gets its tag inside the box, so it never covers
            // the text above the plan or gets clipped by the viewer.
            className={`plan-spot ${spot.shape === "marker" ? "plan-marker" : "plan-tag plan-tag-inside"}`}
            role="img"
            aria-label={`${spot.label} highlighted on the floor plan`}
            data-testid="room-highlight"
            data-spot={spot.id}
            style={spot.shape === "marker" ? { left: pct(spot.x), top: pct(spot.y) } : { left: pct(box!.cx), top: pct(box!.top) }}
          >
            {spot.shape === "marker" ? null : spot.label}
          </span>
        </>
      )}
    </div>
  );
}

function bounds(s: RoomSpot) {
  const pts = s.shape === "polygon" && s.points?.length ? s.points : [[s.x, s.y], [s.x + (s.w ?? 0), s.y + (s.h ?? 0)]];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, top: Math.min(...ys) };
}
