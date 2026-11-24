import { Link, useSearchParams } from "react-router-dom";
import SearchBar from "../../components/SearchBar";
import PlaceCard from "../../components/PlaceCard";
import LoadError from "../../components/LoadError";
import Notice from "../../components/Notice";
import { PinIcon } from "../../components/Icons";
import { searchPlaces } from "../../lib/data";
import { resolveSearch, type SearchHit } from "../../lib/campus/resolve";
import { useAsync } from "../../lib/usePlaces";
import { campusBuildingsOnce } from "../map/buildings";

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const res = useAsync(q, () => searchPlaces(q));
  // Building polygons from the live MapTiler dataset: names and room-code prefixes point at them.
  const map = useAsync("campus-buildings", async () => ({ data: await campusBuildingsOnce(), mode: "live" as const }));
  const mapBuildings = map.state === "done" ? map.result.data : [];

  const hits = res.state === "done" && map.state !== "loading" ? resolveSearch(q, res.result.data, mapBuildings) : [];

  return (
    <section>
      <h1 className="page-title">Search</h1>
      {/* key remounts the bar so it always shows exactly what the student typed */}
      <SearchBar key={q} initial={q} autoFocus={!q} />

      {!q.trim() && <p className="muted">Type a room code like ICT 201, or an office or building name.</p>}
      {q.trim() && (res.state === "loading" || map.state === "loading") && <p className="muted" role="status">Searching…</p>}

      {q.trim() && res.state === "error" && <LoadError what="search results" onRetry={res.reload} />}

      {res.state === "done" && map.state !== "loading" && (
        <>
          {res.result.notice && <Notice>{res.result.notice}</Notice>}
          {q.trim() && hits.length === 0 && (
            <div className="card empty" role="status">
              <h2>No match for “{q}”</h2>
              <p className="muted">
                We don’t have {res.result.mode === "live" ? "a verified place" : "a demo record"} or a mapped building with that code or name.
                Check the spelling, or try another search above.
              </p>
            </div>
          )}
          {hits.map((h) => <Hit key={hitKey(h)} hit={h} />)}
        </>
      )}
    </section>
  );
}

const hitKey = (h: SearchHit) => (h.kind === "place" ? h.view.place.id : h.kind === "mapped" ? `m:${h.building.key}` : `p:${h.code}`);

function Hit({ hit }: { hit: SearchHit }) {
  if (hit.kind === "place") return <PlaceCard view={hit.view} />;
  if (hit.kind === "prefix" || hit.kind === "prefix-unmapped") {
    return (
      <article className="card place-card" aria-label={`Room code ${hit.label}`}>
        <div className="card-head"><span className="kind">Room code</span><span className="badge unverified">Not confirmed</span></div>
        <h2 className="place-name">{hit.label}</h2>
        <p className="tbc" role="status">{hit.message}</p>
        {hit.kind === "prefix" && hit.building && (
          <div className="actions">
            <Link className="btn ghost" to={`/map?to=${encodeURIComponent(hit.building.key)}&code=${encodeURIComponent(hit.code)}`}>
              <PinIcon /> Show {hit.buildingName} on Map
            </Link>
          </div>
        )}
      </article>
    );
  }
  return (
    <article className="card place-card" aria-label={hit.building.name}>
      <div className="card-head"><span className="kind">Campus map</span></div>
      <h2 className="place-name">{hit.building.name}</h2>
      {hit.note && <p className="muted small">{hit.note}</p>}
      <div className="actions">
        <Link className="btn ghost" to={`/map?to=${encodeURIComponent(hit.building.key)}`}><PinIcon /> Show on Map</Link>
      </div>
    </article>
  );
}
