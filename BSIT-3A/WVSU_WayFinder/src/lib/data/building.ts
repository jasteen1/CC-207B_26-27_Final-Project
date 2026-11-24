import type { BuildingDetails, FloorPlan, Place } from "../types";

/** Same shape for live and demo: offices and rooms inside the building, and every floor we know of. */
export function assembleBuilding(input: {
  place: Place; description?: string; photoUrl?: string; children: Place[]; floorPlans: FloorPlan[]; featureIds: number[];
}): BuildingDetails {
  const { place, children, floorPlans } = input;
  const byName = (a: Place, b: Place) => (a.roomCode ?? a.name).localeCompare(b.roomCode ?? b.name);
  const floors = new Set<number>();
  for (const c of children) if (c.floor !== undefined) floors.add(c.floor);
  for (const f of floorPlans) floors.add(f.floor);
  return {
    place,
    description: input.description?.trim() || undefined,
    photoUrl: input.photoUrl?.trim() || undefined,
    offices: children.filter((c) => c.kind === "office").sort(byName),
    rooms: children.filter((c) => c.kind === "room").sort(byName),
    floors: [...floors].sort((a, b) => a - b),
    floorPlans: [...floorPlans].sort((a, b) => a.floor - b.floor),
    featureIds: [...new Set(input.featureIds)].sort((a, b) => a - b),
  };
}
