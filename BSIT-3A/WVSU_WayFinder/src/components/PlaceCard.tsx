import { Link } from "react-router-dom";
import { roomDisplay } from "../lib/search";
import type { PlaceView } from "../lib/types";
import { PinIcon } from "./Icons";

export function DataBadge({ status }: { status: string }) {
  if (status === "verified") return <span className="badge verified">Verified</span>;
  if (status === "demo") return <span className="badge demo">Demo</span>;
  return <span className="badge unverified">Unverified</span>;
}

/** Room code, building and floor, shown only when we actually have them. */
export function PlaceFacts({ view }: { view: PlaceView }) {
  const { place, parent } = view;
  const rows: [string, string][] = [];
  if (place.roomCode) rows.push(["Room", roomDisplay(place)]);
  if (parent) rows.push(["Building", parent.name]);
  else if (place.kind === "building") rows.push(["Building", place.name]);
  if (place.floor !== undefined) rows.push(["Floor", String(place.floor)]);
  return (
    <dl className="facts">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function PlaceCard({ view }: { view: PlaceView }) {
  const { place } = view;
  return (
    <article className="card place-card">
      <div className="card-head">
        <span className="kind">{place.kind}</span>
        <DataBadge status={place.status} />
      </div>
      <h2 className="place-name">{place.name}</h2>
      <PlaceFacts view={view} />
      <div className="actions">
        <Link className="btn primary" to={`/directory/${place.id}`}>View details</Link>
        <Link className="btn ghost" to={`/map?to=${place.id}`}>
          <PinIcon /> Show on Map
        </Link>
      </div>
    </article>
  );
}
