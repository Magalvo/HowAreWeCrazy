import {
  adaptiveView,
  addAdaptiveLobbyPlayer,
  canHostSkipAdaptive,
  createAdaptiveMatch,
  isAdaptiveMode,
  normalizeAdaptiveMode,
  performAdaptiveAction,
  setAdaptivePresence
} from "../adaptive-engine.js";
import {
  addCaptionLobbyPlayer,
  canHostSkipCaptionRound,
  CAPTION_MODE,
  captionView,
  createCaptionMatch,
  performCaptionAction,
  setCaptionPresence
} from "../caption-engine.js";

/**
 * Modes where every player holds a seat: each gets their own access token, their own view
 * of the room, and is tracked as present or gone.
 *
 * The room store handles these identically, so each engine is described here once rather
 * than branched on everywhere. Conversation rooms are the exception and stay outside this
 * list: they share one deck that the host alone drives, with no per-player state at all.
 */
const SEATED_FAMILIES = [
  {
    name: "adaptive",
    handles: isAdaptiveMode,
    create: ({ mode, participants, random, promptFilters, dateVariant }) =>
      createAdaptiveMatch({ mode, participants, random, promptFilters, dateVariant }),
    addPlayer: (session, participant) => addAdaptiveLobbyPlayer(session, participant),
    setPresence: (session, playerId, connected) => setAdaptivePresence(session, playerId, connected),
    // The adaptive engine decides a skip is allowed from a flag on the payload; the
    // caption engine works it out itself. Both are asked the same way from here.
    act: (session, actorId, action, payload, random) => performAdaptiveAction(session, actorId, action, {
      ...payload,
      canSkip: action === "skip_stalled_turn" && canHostSkipAdaptive(session, actorId)
    }, random),
    view: (session, viewerId) => adaptiveView(session, viewerId, {
      canSkip: canHostSkipAdaptive(session, viewerId)
    })
  },
  {
    name: "caption",
    handles: (mode) => mode === CAPTION_MODE,
    create: ({ participants, random }) => createCaptionMatch({ participants, random }),
    addPlayer: (session, participant) => addCaptionLobbyPlayer(session, participant),
    setPresence: (session, playerId, connected, random) =>
      setCaptionPresence(session, playerId, connected, random),
    act: (session, actorId, action, payload, random) =>
      performCaptionAction(session, actorId, action, payload, random),
    view: (session, viewerId) => captionView(session, viewerId, {
      canSkip: canHostSkipCaptionRound(session, viewerId)
    })
  }
];

export function normalizeRoomMode(mode) {
  return normalizeAdaptiveMode(mode);
}

export function seatedFamilyFor(mode) {
  return SEATED_FAMILIES.find((family) => family.handles(mode)) || null;
}

export function isKnownRoomMode(mode) {
  return mode === "conversation" || Boolean(seatedFamilyFor(mode));
}
