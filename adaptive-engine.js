import { DATE_ACTIVITY_REWARDS, DATE_QUESTION_REWARDS } from "./data/date-rewards.js";
import { LEVELS, PROMPTS, promptById } from "./data/prompts.js";

export const LEVEL_POINTS = {
  curiosity: 1,
  connection: 3,
  reflection: 5
};

export const ADAPTIVE_MODES = ["date_night", "inner_circle", "icebreaker"];

const MODE_AUDIENCE = {
  date_night: "couple",
  inner_circle: "friends",
  icebreaker: "group"
};

function fail(message) {
  throw new Error(message);
}

function copy(value) {
  return structuredClone(value);
}

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(random() * (index + 1));
    [result[index], result[nextIndex]] = [result[nextIndex], result[index]];
  }
  return result;
}

export function normalizeAdaptiveMode(mode) {
  return mode === "competitive" ? "inner_circle" : mode;
}

export function isAdaptiveMode(mode) {
  return ADAPTIVE_MODES.includes(normalizeAdaptiveMode(mode));
}

function levelIdsForMode(mode) {
  return mode === "icebreaker" ? ["curiosity", "connection"] : LEVELS.map((level) => level.id);
}

function normalizePromptFilters(mode, promptFilters) {
  const hasFilters = Boolean(promptFilters) &&
    (Boolean(promptFilters.includeSpicy) || Boolean(promptFilters.tags?.length));
  if (mode !== "date_night" && hasFilters) {
    fail("Custom themes are only available for A Table 4 Two.");
  }
  if (mode !== "date_night") {
    return { tags: [], includeSpicy: false };
  }
  const tags = Array.isArray(promptFilters?.tags)
    ? [...new Set(promptFilters.tags.map((tag) => String(tag).trim()).filter(Boolean))]
    : [];
  return {
    tags,
    includeSpicy: Boolean(promptFilters?.includeSpicy)
  };
}

function eligiblePromptsForMode(mode, promptFilters = { tags: [], includeSpicy: false }) {
  const audience = MODE_AUDIENCE[mode];
  const levelIds = levelIdsForMode(mode);
  return PROMPTS.filter((prompt) =>
    prompt.audiences.includes(audience) &&
    levelIds.includes(prompt.level) &&
    (!prompt.experiences || prompt.experiences.includes(mode)) &&
    (!prompt.isSpicy || promptFilters.includeSpicy) &&
    (mode !== "date_night" || promptFilters.tags.length === 0 ||
      prompt.tags?.some((tag) => promptFilters.tags.includes(tag)))
  );
}

function player(match, playerId) {
  return match.players.find((item) => item.id === playerId);
}

function requirePlayer(match, playerId) {
  const actor = player(match, playerId);
  if (!actor) {
    fail("Participant access is required for this room.");
  }
  return actor;
}

function requireHost(match, actorId) {
  if (requirePlayer(match, actorId).role !== "host") {
    fail("Only the host can do that.");
  }
}

function requirePlaying(match) {
  if (match.status !== "playing") {
    fail("This experience is not currently playing.");
  }
}

function requireActive(match, actorId) {
  if (match.activePlayerId !== actorId) {
    fail("Only the active player can do that.");
  }
}

function takePrompt(next, levelId) {
  if (!levelIdsForMode(next.mode).includes(levelId)) {
    fail("That level is not available in this experience.");
  }
  const promptId = next.decksByLevel[levelId]?.shift();
  if (!promptId) {
    fail("No prompts remain at that level.");
  }
  next.usedPromptIds.push(promptId);
  return {
    levelId,
    basePoints: LEVEL_POINTS[levelId],
    promptId,
    doubled: false,
    excludedTargetId: null,
    claimant: false
  };
}

function allDecksEmpty(match) {
  return levelIdsForMode(match.mode).every((levelId) => match.decksByLevel[levelId].length === 0);
}

function clearChallenge(next) {
  next.currentChallenge = null;
  next.targetPlayerId = null;
}

function rotate(next) {
  clearChallenge(next);
  const currentIndex = next.turnOrder.indexOf(next.activePlayerId);
  next.activePlayerId = next.turnOrder[(currentIndex + 1) % next.turnOrder.length];
  next.currentResponderId = next.mode === "date_night" ? next.activePlayerId : null;
  next.turnNumber += 1;
  next.phase = "choose_level";
}

function finishGentle(next) {
  next.status = "finished";
  next.phase = "finished";
  next.endReason = "deck_exhausted";
  clearChallenge(next);
}

function discardChallenge(next) {
  if (next.currentChallenge) {
    next.discardedPromptIds.push(next.currentChallenge.promptId);
  }
}

function rotateOrExhaust(next) {
  rotate(next);
  if (allDecksEmpty(next)) {
    if (next.mode === "inner_circle") {
      finishInnerByScore(next);
    } else {
      finishGentle(next);
    }
  }
}

function finishInnerByScore(next) {
  const highestScore = Math.max(...next.players.map((item) => item.score));
  next.winnerIds = next.players.filter((item) => item.score === highestScore).map((item) => item.id);
  next.status = "finished";
  next.phase = "finished";
  next.endReason = "deck_exhausted";
  clearChallenge(next);
}

function finishInnerForTarget(next) {
  const winners = next.players.filter((item) => item.score >= next.scoreTarget);
  if (winners.length === 0) {
    return false;
  }
  next.winnerIds = [winners[0].id];
  next.status = "finished";
  next.phase = "finished";
  next.endReason = "score_target";
  clearChallenge(next);
  return true;
}

function dateMilestoneMet(match) {
  return match.connectionScore >= match.scoreTarget &&
    levelIdsForMode(match.mode).every((levelId) => match.completedByLevel[levelId] >= 2);
}

function connectedAlternativeIds(match) {
  return match.players
    .filter((item) => item.connected && item.id !== match.activePlayerId)
    .map((item) => item.id);
}

function availableInnerTargetIds(match) {
  const excludedTargetId = match.currentChallenge?.excludedTargetId;
  const alternatives = connectedAlternativeIds(match).filter((id) => id !== excludedTargetId);
  const available = alternatives.filter((id) => !match.cooldownTargetIds.includes(id));
  if (available.length > 0) {
    return { ids: available, resetCycle: false };
  }
  return { ids: alternatives, resetCycle: alternatives.length > 0 };
}

function selectIcebreakerTarget(next, random) {
  const alternatives = connectedAlternativeIds(next);
  let available = alternatives.filter((id) => !next.rouletteCycleTargetIds.includes(id));
  if (available.length === 0) {
    next.rouletteCycleTargetIds = [];
    available = alternatives;
  }
  if (available.length === 0) {
    fail("No connected responder is available to spin.");
  }
  const selected = shuffle(available, random)[0];
  next.rouletteCycleTargetIds.push(selected);
  return selected;
}

export function createAdaptiveMatch({ mode, participants, random = Math.random, promptFilters }) {
  const normalizedMode = normalizeAdaptiveMode(mode);
  if (!isAdaptiveMode(normalizedMode)) {
    fail("Unknown adaptive experience.");
  }
  const normalizedFilters = normalizePromptFilters(normalizedMode, promptFilters);
  const eligiblePrompts = eligiblePromptsForMode(normalizedMode, normalizedFilters);
  const decksByLevel = Object.fromEntries(levelIdsForMode(normalizedMode).map((levelId) => [
    levelId,
    shuffle(eligiblePrompts
      .filter((prompt) => prompt.level === levelId)
      .map((prompt) => prompt.id), random)
  ]));
  if (normalizedMode === "date_night" &&
    Object.values(decksByLevel).some((deck) => deck.length < 2)) {
    fail("Choose more themes; A Table 4 Two needs at least 2 prompts in every level.");
  }
  const players = participants.map((participant) => ({
    ...participant,
    connected: true,
    ...(normalizedMode === "inner_circle"
      ? { score: 0, bailoutAvailable: true, doubleDownAvailable: true }
      : {})
  }));
  return {
    mode: normalizedMode,
    status: "lobby",
    phase: null,
    players,
    turnOrder: players.map((participant) => participant.id),
    activePlayerId: null,
    targetPlayerId: null,
    currentResponderId: null,
    turnNumber: 0,
    scoreTarget: normalizedMode === "date_night" ? 20 : normalizedMode === "icebreaker" ? 15 : 21,
    decksByLevel,
    usedPromptIds: [],
    discardedPromptIds: [],
    currentChallenge: null,
    endReason: null,
    ...(normalizedMode === "date_night"
      ? {
          promptFilters: normalizedFilters,
          connectionScore: 0,
          completedByLevel: { curiosity: 0, connection: 0, reflection: 0 },
          endingChoice: null,
          revealedReward: null
        }
      : {}),
    ...(normalizedMode === "inner_circle" ? { winnerIds: [], cooldownTargetIds: [] } : {}),
    ...(normalizedMode === "icebreaker" ? { groupScore: 0, rouletteCycleTargetIds: [] } : {})
  };
}

export function addAdaptiveLobbyPlayer(match, participant) {
  if (match.status !== "lobby") {
    fail("This experience has already started.");
  }
  const maxPlayers = match.mode === "date_night" ? 2 : 6;
  if (match.players.length >= maxPlayers) {
    fail("This experience room is full.");
  }
  const next = copy(match);
  next.players.push({
    ...participant,
    connected: true,
    ...(match.mode === "inner_circle" ? { score: 0, bailoutAvailable: true, doubleDownAvailable: true } : {})
  });
  next.turnOrder.push(participant.id);
  return next;
}

export function setAdaptivePresence(match, playerId, connected) {
  const next = copy(match);
  const participant = player(next, playerId);
  if (participant) {
    participant.connected = connected;
  }
  return next;
}

function startExperience(next, actorId) {
  requireHost(next, actorId);
  if (next.status !== "lobby") {
    fail("This experience has already started.");
  }
  if (next.mode === "date_night" && next.players.length !== 2) {
    fail("A Table 4 Two starts with exactly two participants.");
  }
  if (next.mode !== "date_night" && (next.players.length < 3 || next.players.length > 6)) {
    fail("This experience starts with 3 to 6 participants.");
  }
  next.status = "playing";
  next.phase = "choose_level";
  next.activePlayerId = next.turnOrder[0];
  next.currentResponderId = next.mode === "date_night" ? next.activePlayerId : null;
  next.turnNumber = 1;
}

function chooseLevel(next, actorId, payload) {
  requirePlaying(next);
  requireActive(next, actorId);
  if (next.phase !== "choose_level") {
    fail("A level cannot be chosen right now.");
  }
  next.currentChallenge = takePrompt(next, payload.levelId);
  if (next.mode === "inner_circle") {
    const actor = player(next, actorId);
    if (payload.doubleDown) {
      if (!actor.doubleDownAvailable) {
        fail("Double Down has already been used.");
      }
      next.currentChallenge.doubled = true;
      actor.doubleDownAvailable = false;
    }
    next.phase = "preview_card";
    return;
  }
  if (next.mode === "icebreaker") {
    next.phase = "spin_target";
    return;
  }
  next.targetPlayerId = actorId;
  next.phase = "await_response";
}

function resolveDateAction(next, actorId, action) {
  if (action === "complete" || action === "pass") {
    requirePlaying(next);
    if (next.phase !== "await_response" || next.currentResponderId !== actorId) {
      fail("Only the current responder can do that.");
    }
    if (action === "complete") {
      next.connectionScore += next.currentChallenge.basePoints;
      next.completedByLevel[next.currentChallenge.levelId] += 1;
      if (dateMilestoneMet(next)) {
        clearChallenge(next);
        next.phase = "choose_ending";
        return;
      }
    } else {
      discardChallenge(next);
    }
    rotateOrExhaust(next);
    return;
  }
  fail("That action is unavailable in A Table 4 Two.");
}

function resolveInnerAction(next, actorId, action, payload) {
  if (action === "target_player") {
    requirePlaying(next);
    requireActive(next, actorId);
    if (!["preview_card", "replacement_preview"].includes(next.phase)) {
      fail("A target cannot be chosen right now.");
    }
    const target = player(next, payload.targetPlayerId);
    if (!target || target.id === actorId || !target.connected) {
      fail("Choose another connected participant.");
    }
    if (next.currentChallenge.excludedTargetId === target.id) {
      fail("Choose a different player for the replacement prompt.");
    }
    const eligible = availableInnerTargetIds(next);
    if (!eligible.ids.includes(target.id)) {
      fail("That player is cooling down.");
    }
    if (eligible.resetCycle) {
      next.cooldownTargetIds = [];
    }
    next.targetPlayerId = target.id;
    next.cooldownTargetIds.push(target.id);
    next.phase = "await_response";
    return;
  }
  if (action === "complete") {
    requirePlaying(next);
    if (next.phase !== "await_response") {
      fail("There is no response to complete.");
    }
    const challenge = next.currentChallenge;
    const responderId = challenge.claimant ? next.activePlayerId : next.targetPlayerId;
    if (responderId !== actorId) {
      fail("Only the responder can complete this prompt.");
    }
    const responder = player(next, responderId);
    responder.score += challenge.claimant ? challenge.basePoints :
      challenge.doubled ? challenge.basePoints * 2 : challenge.basePoints;
    if (!challenge.claimant && challenge.doubled) {
      const active = player(next, next.activePlayerId);
      active.score = Math.max(0, active.score - challenge.basePoints);
    }
    if (!finishInnerForTarget(next)) {
      rotateOrExhaust(next);
    }
    return;
  }
  if (action === "pass") {
    requirePlaying(next);
    if (next.phase !== "await_response" || next.currentChallenge.claimant || next.targetPlayerId !== actorId) {
      fail("Only the targeted responder can pass.");
    }
    next.phase = "await_claim";
    return;
  }
  if (action === "bailout") {
    requirePlaying(next);
    const actor = player(next, actorId);
    if (next.phase !== "await_response" || next.currentChallenge.claimant || next.targetPlayerId !== actorId) {
      fail("Only the targeted responder can use Bailout.");
    }
    if (!actor.bailoutAvailable) {
      fail("Bailout has already been used.");
    }
    actor.bailoutAvailable = false;
    discardChallenge(next);
    const active = player(next, next.activePlayerId);
    if (next.currentChallenge.doubled) {
      active.doubleDownAvailable = true;
    }
    const levelId = next.currentChallenge.levelId;
    const excludedTargetId = actorId;
    if (next.decksByLevel[levelId].length === 0) {
      rotateOrExhaust(next);
      return;
    }
    next.currentChallenge = takePrompt(next, levelId);
    next.currentChallenge.excludedTargetId = excludedTargetId;
    next.targetPlayerId = null;
    next.phase = "replacement_preview";
    return;
  }
  if (action === "claim") {
    requirePlaying(next);
    requireActive(next, actorId);
    if (next.phase !== "await_claim") {
      fail("There is no passed prompt to claim.");
    }
    next.currentChallenge.claimant = true;
    next.phase = "await_response";
    return;
  }
  if (action === "discard") {
    requirePlaying(next);
    requireActive(next, actorId);
    if (next.phase !== "await_claim") {
      fail("There is no passed prompt to discard.");
    }
    discardChallenge(next);
    rotateOrExhaust(next);
    return;
  }
  fail("That action is unavailable in Inner Circle.");
}

function resolveIcebreakerAction(next, actorId, action, random) {
  if (action === "spin_target") {
    requirePlaying(next);
    requireActive(next, actorId);
    if (next.phase !== "spin_target") {
      fail("There is no target to spin right now.");
    }
    next.targetPlayerId = selectIcebreakerTarget(next, random);
    next.phase = "await_response";
    return;
  }
  if (action === "complete" || action === "pass") {
    requirePlaying(next);
    if (next.phase !== "await_response" || next.targetPlayerId !== actorId) {
      fail("Only the selected responder can do that.");
    }
    if (action === "complete") {
      next.groupScore += next.currentChallenge.basePoints;
      if (next.groupScore >= next.scoreTarget) {
        next.status = "finished";
        next.phase = "finished";
        next.endReason = "score_target";
        clearChallenge(next);
        return;
      }
    } else {
      discardChallenge(next);
    }
    rotateOrExhaust(next);
    return;
  }
  fail("That action is unavailable in Icebreaker.");
}

function skipStalledTurn(next, actorId, payload) {
  requireHost(next, actorId);
  requirePlaying(next);
  if (!payload.canSkip) {
    fail("There is no stalled turn to skip.");
  }
  if (next.currentChallenge) {
    discardChallenge(next);
    if (next.mode === "inner_circle" && next.currentChallenge.doubled) {
      player(next, next.activePlayerId).doubleDownAvailable = true;
    }
  }
  rotateOrExhaust(next);
}

export function performAdaptiveAction(match, actorId, action, payload = {}, random = Math.random) {
  requirePlayer(match, actorId);
  const next = copy(match);
  if (action === "start_match") {
    startExperience(next, actorId);
    return next;
  }
  if (action === "choose_level") {
    chooseLevel(next, actorId, payload);
    return next;
  }
  if (action === "skip_stalled_turn") {
    skipStalledTurn(next, actorId, payload);
    return next;
  }
  if (next.mode === "date_night") {
    if (action === "choose_ending") {
      requirePlaying(next);
      if (next.phase !== "choose_ending") {
        fail("There is no ending to choose right now.");
      }
      if (!["activity", "question"].includes(payload.endingType)) {
        fail("Choose a supported ending.");
      }
      const rewards = payload.endingType === "activity" ? DATE_ACTIVITY_REWARDS : DATE_QUESTION_REWARDS;
      next.endingChoice = payload.endingType;
      next.revealedReward = copy(shuffle(rewards, random)[0]);
      next.status = "finished";
      next.phase = "finished";
      next.endReason = "milestone";
      return next;
    }
    resolveDateAction(next, actorId, action);
    return next;
  }
  if (next.mode === "inner_circle") {
    resolveInnerAction(next, actorId, action, payload);
    return next;
  }
  resolveIcebreakerAction(next, actorId, action, random);
  return next;
}

function actionsFor(match, viewerId, canSkip) {
  const actor = player(match, viewerId);
  if (!actor) {
    return [];
  }
  const actions = [];
  if (match.status === "lobby" && actor.role === "host") {
    const mayStart = match.mode === "date_night" ? match.players.length === 2 : match.players.length >= 3;
    if (mayStart) {
      actions.push("start_match");
    }
    return actions;
  }
  if (match.status !== "playing") {
    return actions;
  }
  if (canSkip && actor.role === "host") {
    actions.push("skip_stalled_turn");
  }
  if (match.mode === "date_night") {
    if (match.phase === "choose_level" && viewerId === match.activePlayerId) actions.push("choose_level");
    if (match.phase === "await_response" && viewerId === match.currentResponderId) actions.push("complete", "pass");
    if (match.phase === "choose_ending") actions.push("choose_ending");
    return actions;
  }
  if (match.mode === "icebreaker") {
    if (match.phase === "choose_level" && viewerId === match.activePlayerId) actions.push("choose_level");
    if (match.phase === "spin_target" && viewerId === match.activePlayerId) actions.push("spin_target");
    if (match.phase === "await_response" && viewerId === match.targetPlayerId) actions.push("complete", "pass");
    return actions;
  }
  if (match.phase === "choose_level" && viewerId === match.activePlayerId) actions.push("choose_level");
  if (["preview_card", "replacement_preview"].includes(match.phase) && viewerId === match.activePlayerId) {
    actions.push("target_player");
  }
  if (match.phase === "await_response") {
    if (match.currentChallenge.claimant && viewerId === match.activePlayerId) {
      actions.push("complete");
    } else if (!match.currentChallenge.claimant && viewerId === match.targetPlayerId) {
      actions.push("complete", "pass");
      if (actor.bailoutAvailable) actions.push("bailout");
    }
  }
  if (match.phase === "await_claim" && viewerId === match.activePlayerId) actions.push("claim", "discard");
  return actions;
}

function promptIsVisible(match, viewerId) {
  if (!match.currentChallenge) return false;
  if (match.mode === "date_night") return match.phase === "await_response";
  if (match.mode === "icebreaker") return match.phase === "await_response";
  return ["await_response", "await_claim"].includes(match.phase) ||
    (["preview_card", "replacement_preview"].includes(match.phase) && viewerId === match.activePlayerId);
}

export function adaptiveView(match, viewerId, { canSkip = false } = {}) {
  const view = copy(match);
  if (view.currentChallenge) {
    if (promptIsVisible(match, viewerId)) {
      view.currentChallenge.prompt = promptById(view.currentChallenge.promptId);
    } else {
      delete view.currentChallenge.promptId;
    }
  }
  view.remainingByLevel = Object.fromEntries(
    Object.entries(view.decksByLevel).map(([levelId, deck]) => [levelId, deck.length])
  );
  delete view.decksByLevel;
  delete view.usedPromptIds;
  delete view.discardedPromptIds;
  if (view.mode === "inner_circle" && ["preview_card", "replacement_preview"].includes(view.phase)) {
    view.targetablePlayerIds = availableInnerTargetIds(match).ids;
  }
  view.availableActions = actionsFor(match, viewerId, canSkip);
  return view;
}

export function canHostSkipAdaptive(match, viewerId) {
  if (match.status !== "playing" || player(match, viewerId)?.role !== "host") {
    return false;
  }
  const active = player(match, match.activePlayerId);
  if (!active?.connected) {
    return true;
  }
  if (match.phase === "await_response") {
    const responderId = match.mode === "date_night" ? match.currentResponderId :
      match.mode === "inner_circle" && match.currentChallenge?.claimant ? match.activePlayerId :
        match.targetPlayerId;
    return Boolean(responderId && !player(match, responderId)?.connected);
  }
  if (match.mode === "inner_circle" && ["preview_card", "replacement_preview"].includes(match.phase)) {
    return availableInnerTargetIds(match).ids.length === 0;
  }
  if (match.mode === "icebreaker" && match.phase === "spin_target") {
    return connectedAlternativeIds(match).length === 0;
  }
  return false;
}
