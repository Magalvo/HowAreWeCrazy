import type { ActiveRoom, AdaptiveSession, Audience, RoomMode } from "./types";

export const ADAPTIVE_MODES = ["classic", "date_night", "inner_circle", "icebreaker", "competitive"];

/**
 * Modes where every player holds a seat, mirroring the server's seated families.
 *
 * This one predicate decides three things at once: that requests carry a participant
 * token rather than the host token, that the event stream is subscribed to per player,
 * and that the room opens on its own screen. A mode missing from here authenticates as
 * the host and is refused.
 */
export const SEATED_MODES = [...ADAPTIVE_MODES, "caption"];

export function isSeatedRoom(room: ActiveRoom | null): boolean {
  return Boolean(room && SEATED_MODES.includes(room.mode));
}

// `competitive` is the name Inner Circle shipped under first. Rooms created back then
// still report it, so every reader normalizes before matching on the mode.
export function normalizeExperience(mode?: string): RoomMode {
  return mode === "competitive" ? "inner_circle" : (mode as RoomMode) || "conversation";
}

export function experienceLabel(mode?: string): string {
  return {
    classic: "Classic",
    date_night: "A Table 4 Two",
    inner_circle: "Inner Circle",
    competitive: "Inner Circle",
    icebreaker: "Icebreaker",
    caption: "Caption Clash"
  }[mode || ""] || "Conversation";
}

export function audienceLabel(audience: Audience): string {
  return { couple: "two people", friends: "friends", group: "a group" }[audience];
}

export function pairNames(playerNames: string) {
  const names = playerNames
    .split(/[+,&/]/)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 2);
  return [names[0] || "Partner 1", names[1] || "Partner 2"];
}

export function localAdaptiveViewerId(session: AdaptiveSession) {
  return session.currentResponderId || session.activePlayerId || session.players[0]?.id || "";
}
