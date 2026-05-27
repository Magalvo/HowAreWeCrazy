import { LEVELS, PROMPTS, promptById } from "./data/prompts.js";

export const LEVEL_POINTS = {
  curiosity: 1,
  connection: 3,
  reflection: 5
};

function fail(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function copy(match) {
  return structuredClone(match);
}

function player(match, playerId) {
  const found = match.players.find((item) => item.id === playerId);
  if (!found) {
    fail("Player is not part of this match");
  }
  return found;
}

function requireStatus(match, status, phase) {
  if (match.status !== status || (phase && match.phase !== phase)) {
    fail("Action is not available right now");
  }
}

function requireActive(match, actorId) {
  if (match.activePlayerId !== actorId) {
    fail("Only the active player can do that");
  }
}

function requireHost(match, actorId) {
  if (player(match, actorId).role !== "host") {
    fail("Only the host can do that");
  }
}

function takePrompt(match, levelId) {
  const deck = match.decksByLevel[levelId];
  if (!deck || deck.length === 0) {
    fail("That level has no cards left");
  }
  const promptId = deck.shift();
  match.usedPromptIds.push(promptId);
  return promptId;
}

function allDecksEmpty(match) {
  return LEVELS.every((level) => match.decksByLevel[level.id].length === 0);
}

function finishByScore(match, reason) {
  const highestScore = Math.max(...match.players.map((item) => item.score));
  match.status = "finished";
  match.phase = "finished";
  match.winnerIds = match.players.filter((item) => item.score === highestScore).map((item) => item.id);
  match.endReason = reason;
  match.currentChallenge = null;
  match.targetPlayerId = null;
}

function finishIfTargetReached(match) {
  const winners = match.players.filter((item) => item.score >= match.scoreTarget);
  if (winners.length === 0) {
    return false;
  }
  match.status = "finished";
  match.phase = "finished";
  match.winnerIds = winners.map((item) => item.id);
  match.endReason = "score_target";
  match.currentChallenge = null;
  match.targetPlayerId = null;
  return true;
}

function nextTurn(match) {
  if (allDecksEmpty(match)) {
    finishByScore(match, "deck_exhausted");
    return;
  }

  const activeIndex = match.turnOrder.indexOf(match.activePlayerId);
  match.activePlayerId = match.turnOrder[(activeIndex + 1) % match.turnOrder.length];
  match.targetPlayerId = null;
  match.currentChallenge = null;
  match.phase = "choose_level";
  match.turnNumber += 1;
}

function discardChallenge(match) {
  if (match.currentChallenge) {
    match.discardedPromptIds.push(match.currentChallenge.promptId);
  }
}

export function createCompetitiveMatch({ participants, audience = "group", random = Math.random, scoreTarget = 21 }) {
  const eligiblePrompts = PROMPTS;
  const decksByLevel = Object.fromEntries(
    LEVELS.map((level) => [
      level.id,
      shuffle(eligiblePrompts.filter((prompt) => prompt.level === level.id).map((prompt) => prompt.id), random)
    ])
  );

  return {
    audience,
    status: "lobby",
    phase: null,
    scoreTarget,
    players: participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      role: participant.role,
      score: 0,
      bailoutAvailable: true,
      doubleDownAvailable: true,
      connected: true
    })),
    turnOrder: participants.map((participant) => participant.id),
    activePlayerId: null,
    targetPlayerId: null,
    turnNumber: 0,
    decksByLevel,
    usedPromptIds: [],
    discardedPromptIds: [],
    currentChallenge: null,
    winnerIds: [],
    endReason: null
  };
}

export function addLobbyPlayer(match, participant) {
  requireStatus(match, "lobby");
  if (match.players.length >= 6) {
    fail("Points Mode rooms support up to 6 players");
  }
  const next = copy(match);
  next.players.push({
    id: participant.id,
    name: participant.name,
    role: participant.role,
    score: 0,
    bailoutAvailable: true,
    doubleDownAvailable: true,
    connected: true
  });
  next.turnOrder.push(participant.id);
  return next;
}

export function setCompetitivePresence(match, playerId, connected) {
  const next = copy(match);
  player(next, playerId).connected = connected;
  return next;
}

export function performCompetitiveAction(match, actorId, action, payload = {}) {
  const next = copy(match);
  const actor = player(next, actorId);

  if (action === "start_match") {
    requireStatus(next, "lobby");
    requireHost(next, actorId);
    if (next.players.length < 3 || next.players.length > 6) {
      fail("Points Mode needs 3 to 6 players before starting");
    }
    next.status = "playing";
    next.phase = "choose_level";
    next.activePlayerId = next.turnOrder[0];
    next.turnNumber = 1;
    return next;
  }

  requireStatus(next, "playing");

  if (action === "choose_level") {
    requireStatus(next, "playing", "choose_level");
    requireActive(next, actorId);
    const levelId = payload.levelId;
    if (!LEVEL_POINTS[levelId]) {
      fail("Choose a valid level");
    }
    const doubled = Boolean(payload.doubleDown);
    if (doubled && !actor.doubleDownAvailable) {
      fail("Double Down has already been used");
    }
    next.currentChallenge = {
      levelId,
      basePoints: LEVEL_POINTS[levelId],
      promptId: takePrompt(next, levelId),
      doubled,
      doubleDownCommitted: false,
      replacement: false,
      excludedTargetId: null,
      claimant: false
    };
    next.phase = "preview_card";
    return next;
  }

  if (action === "target_player") {
    if (!["preview_card", "replacement_preview"].includes(next.phase)) {
      fail("A target cannot be selected right now");
    }
    requireActive(next, actorId);
    const target = player(next, payload.targetPlayerId);
    if (target.id === actorId) {
      fail("Choose another player");
    }
    if (!target.connected) {
      fail("Choose a connected player");
    }
    if (next.currentChallenge.excludedTargetId === target.id) {
      fail("Choose a different player after a Bailout");
    }
    next.targetPlayerId = target.id;
    if (next.currentChallenge.doubled) {
      actor.doubleDownAvailable = false;
      next.currentChallenge.doubleDownCommitted = true;
    }
    next.phase = "await_response";
    return next;
  }

  if (action === "complete") {
    requireStatus(next, "playing", "await_response");
    if (next.targetPlayerId !== actorId) {
      fail("Only the responder can complete this prompt");
    }
    const challenge = next.currentChallenge;
    const earnedPoints = challenge.claimant
      ? challenge.basePoints
      : challenge.doubled
        ? challenge.basePoints * 2
        : challenge.basePoints;
    actor.score += earnedPoints;
    if (challenge.doubled && challenge.doubleDownCommitted && !challenge.claimant) {
      const active = player(next, next.activePlayerId);
      active.score = Math.max(0, active.score - challenge.basePoints);
    }
    if (!finishIfTargetReached(next)) {
      nextTurn(next);
    }
    return next;
  }

  if (action === "pass") {
    requireStatus(next, "playing", "await_response");
    if (next.targetPlayerId !== actorId || next.currentChallenge.claimant) {
      fail("Only the challenged responder can pass");
    }
    next.phase = "await_claim";
    return next;
  }

  if (action === "bailout") {
    requireStatus(next, "playing", "await_response");
    if (next.targetPlayerId !== actorId || next.currentChallenge.claimant) {
      fail("Only the challenged responder can use Bailout");
    }
    if (!actor.bailoutAvailable) {
      fail("Bailout has already been used");
    }
    actor.bailoutAvailable = false;
    if (next.currentChallenge.doubleDownCommitted) {
      player(next, next.activePlayerId).doubleDownAvailable = true;
    }
    const replacedLevelId = next.currentChallenge.levelId;
    discardChallenge(next);
    if (next.decksByLevel[replacedLevelId].length === 0) {
      nextTurn(next);
      return next;
    }
    next.currentChallenge = {
      levelId: replacedLevelId,
      basePoints: LEVEL_POINTS[replacedLevelId],
      promptId: takePrompt(next, replacedLevelId),
      doubled: false,
      doubleDownCommitted: false,
      replacement: true,
      excludedTargetId: actorId,
      claimant: false
    };
    next.targetPlayerId = null;
    next.phase = "replacement_preview";
    return next;
  }

  if (action === "claim") {
    requireStatus(next, "playing", "await_claim");
    requireActive(next, actorId);
    next.targetPlayerId = actorId;
    next.currentChallenge.claimant = true;
    next.currentChallenge.doubled = false;
    next.phase = "await_response";
    return next;
  }

  if (action === "discard") {
    requireStatus(next, "playing", "await_claim");
    requireActive(next, actorId);
    discardChallenge(next);
    nextTurn(next);
    return next;
  }

  if (action === "skip_stalled_turn") {
    requireHost(next, actorId);
    if (!payload.canSkip) {
      fail("The turn is not stalled");
    }
    if (next.currentChallenge?.doubleDownCommitted) {
      player(next, next.activePlayerId).doubleDownAvailable = true;
    }
    discardChallenge(next);
    nextTurn(next);
    return next;
  }

  fail("Unsupported Points Mode action");
}

function actionsFor(match, viewerId, canSkip) {
  const actions = [];
  const viewer = match.players.find((item) => item.id === viewerId);
  if (!viewer) {
    return actions;
  }
  if (match.status === "lobby") {
    if (viewer.role === "host" && match.players.length >= 3) {
      actions.push("start_match");
    }
    return actions;
  }
  if (match.status !== "playing") {
    return actions;
  }
  if (viewer.id === match.activePlayerId && match.phase === "choose_level") {
    actions.push("choose_level");
  }
  if (viewer.id === match.activePlayerId && ["preview_card", "replacement_preview"].includes(match.phase)) {
    actions.push("target_player");
  }
  if (viewer.id === match.targetPlayerId && match.phase === "await_response") {
    actions.push("complete");
    if (!match.currentChallenge.claimant) {
      actions.push("pass");
      if (viewer.bailoutAvailable) {
        actions.push("bailout");
      }
    }
  }
  if (viewer.id === match.activePlayerId && match.phase === "await_claim") {
    actions.push("claim", "discard");
  }
  if (viewer.role === "host" && canSkip) {
    actions.push("skip_stalled_turn");
  }
  return actions;
}

export function competitiveView(match, viewerId, { canSkip = false } = {}) {
  const viewerCanSeePrompt =
    match.currentChallenge &&
    (["await_response", "await_claim"].includes(match.phase) ||
      (viewerId === match.activePlayerId && ["preview_card", "replacement_preview"].includes(match.phase)));
  const challenge = match.currentChallenge
    ? {
        levelId: match.currentChallenge.levelId,
        basePoints: match.currentChallenge.basePoints,
        doubled: match.currentChallenge.doubled,
        replacement: match.currentChallenge.replacement,
        excludedTargetId: match.currentChallenge.excludedTargetId,
        claimant: match.currentChallenge.claimant,
        ...(viewerCanSeePrompt ? { prompt: promptById(match.currentChallenge.promptId) } : {})
      }
    : null;

  return {
    status: match.status,
    phase: match.phase,
    scoreTarget: match.scoreTarget,
    players: match.players.map((item) => ({ ...item })),
    turnOrder: [...match.turnOrder],
    activePlayerId: match.activePlayerId,
    targetPlayerId: match.targetPlayerId,
    turnNumber: match.turnNumber,
    remainingByLevel: Object.fromEntries(LEVELS.map((level) => [level.id, match.decksByLevel[level.id].length])),
    currentChallenge: challenge,
    winnerIds: [...match.winnerIds],
    endReason: match.endReason,
    availableActions: actionsFor(match, viewerId, canSkip)
  };
}
