/** "cb 203", "CB-203", " cb203 " -> "CB203" */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Letters followed by digits (optionally one trailing letter), e.g. CB203, GYM1, LAB2A. */
export function looksLikeRoomCode(input: string): boolean {
  return /^[A-Z]{1,5}\d{1,4}[A-Z]?$/.test(normalizeRoomCode(input));
}

/** "ICT 201", "ICT-201", "ict201" -> { code: "ICT201", prefix: "ICT", number: "201" }. null if not a room code. */
export function parseRoomCode(input: string): { code: string; prefix: string; number: string } | null {
  const code = normalizeRoomCode(input);
  const m = /^([A-Z]{1,5})(\d{1,4}[A-Z]?)$/.exec(code);
  return m ? { code, prefix: m[1], number: m[2] } : null;
}

/** What students see for a room: the label printed on the door, else the code, else the name. */
export const roomDisplay = (p: { roomLabel?: string; roomCode?: string; name: string }) => p.roomLabel ?? p.roomCode ?? p.name;
