import type { ActiveRoom, AdaptiveSession, Audience, RoomMode } from "./types";

export const ADAPTIVE_MODES = ["classic", "date_night", "inner_circle", "icebreaker", "competitive"];

export function isAdaptiveRoom(room: ActiveRoom | null): boolean {
  return Boolean(room && ADAPTIVE_MODES.includes(room.mode));
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
    icebreaker: "Icebreaker"
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
