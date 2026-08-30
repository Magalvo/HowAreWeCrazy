import { CAPTION_CARDS } from "./data/caption-cards.js";
import { MEME_IMAGES } from "./data/meme-images.js";

export const CAPTION_MODE = "caption";
export const CAPTION_SCORE_TARGET = 5;
export const MAX_CAPTION_PLAYERS = 8;

/**
 * Which deck goes on the table each round. The other one is dealt into hands.
 *
 * `image` is the familiar shape: one image on the table, everyone plays a caption at it.
 * `caption` turns the round around, and hands hold images instead. The engine treats the
 * two decks symmetrically, so this is a choice about which feeds what rather than a
 * second set of rules.
 */
export const PROMPT_KINDS = ["image", "caption"];

// An image hand is far heavier than a text one: every card is a separate request to a
// third-party host, on every player's phone, every round. Fewer cards, same table.
const HAND_SIZE_BY_KIND = { image: 7, caption: 5 };

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function copy(value) {
  return structuredClone(value);
}

function shuffle(items, random) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function player(match, playerId) {
  return match.players.find((item) => item.id === playerId);
}

function requirePlayer(match, playerId) {
  const found = player(match, playerId);
  if (!found) {
    fail("You are not in this room.", 403);
  }
  return found;
}

function requirePlaying(match) {
  if (match.status !== "playing") {
    fail("This game is not running.");
  }
}

/** Judged games need someone to play to; free play only needs someone to play with. */
export function minCaptionPlayers(judged) {
  return judged ? 3 : 2;
}

export function captionHandSize(promptKind) {
  return HAND_SIZE_BY_KIND[promptKind] ?? HAND_SIZE_BY_KIND.image;
}

/** Everyone who still owes a card: connected, holding cards, and not judging. */
function pendingSubmitters(match) {
  return match.players.filter((item) =>
    item.id !== match.judgeId &&
    item.connected &&
    item.hand.length > 0 &&
    !match.submissions.some((entry) => entry.playerId === item.id));
}

function drawHandCard(next, random) {
  if (next.handDeck.length === 0) {
    // Played cards come back so a long game does not run itself dry.
    next.handDeck = shuffle(next.handDiscard, random);
    next.handDiscard = [];
  }
  return next.handDeck.shift();
}

function refillHands(next, random) {
  next.players.forEach((item) => {
    while (item.hand.length < next.handSize) {
      const card = drawHandCard(next, random);
      if (!card) {
        return;
      }
      item.hand.push(card);
    }
  });
}

function finish(next, reason) {
  next.status = "finished";
  next.phase = null;
  next.endReason = reason;
  const best = Math.max(0, ...next.players.map((item) => item.score));
  next.winnerIds = next.judged && best > 0
    ? next.players.filter((item) => item.score === best).map((item) => item.id)
    : [];
  return next;
}

function nextJudgeId(match) {
  const order = match.turnOrder;
  const current = order.indexOf(match.judgeId);
  for (let step = 1; step <= order.length; step += 1) {
    const candidate = order[(current + step) % order.length];
    if (player(match, candidate)?.connected) {
      return candidate;
    }
  }
  return order[(current + 1) % order.length];
}

function beginRound(next, random, { rotate = true } = {}) {
  if (rotate && next.judged) {
    next.judgeId = nextJudgeId(next);
  }
  refillHands(next, random);
  const promptId = next.promptDeck.shift();
  if (!promptId) {
    return finish(next, "prompts_exhausted");
  }
  next.currentPromptId = promptId;
  next.submissions = [];
  next.reveal = [];
  next.roundNumber += 1;
  next.phase = "submitting";
  return next;
}

/**
 * Closes the round once nobody is still owed a turn.
 *
 * A judged game hands over to the judge with the plays anonymous. Free play has nobody to
 * decide, so it goes straight to showing everyone what everyone played.
 */
function closeSubmissionsIfReady(next, random) {
  if (next.phase !== "submitting" || pendingSubmitters(next).length > 0) {
    return next;
  }
  if (next.submissions.length === 0) {
    return next;
  }
  next.reveal = shuffle(next.submissions, random).map((entry) => ({
    cardId: entry.cardId,
    playerId: entry.playerId
  }));
  if (next.judged) {
    next.phase = "judging";
    return next;
  }
  next.handDiscard.push(...next.submissions.map((entry) => entry.cardId));
  next.lastRound = null;
  next.phase = "round_over";
  return next;
}

export function createCaptionMatch({
  participants,
  random = Math.random,
  promptKind = "image",
  judged = true,
  scoreTarget = CAPTION_SCORE_TARGET,
  handSize,
  captionCards = CAPTION_CARDS,
  memeImages = MEME_IMAGES
} = {}) {
  if (!participants?.length) {
    fail("A game needs at least one participant.");
  }
  if (participants.length > MAX_CAPTION_PLAYERS) {
    fail("This room is full.");
  }
  if (!PROMPT_KINDS.includes(promptKind)) {
    fail("Unknown round direction.");
  }
  const players = participants.map((participant) => ({
    ...participant,
    connected: true,
    score: 0,
    hand: []
  }));
  const imageIds = memeImages.map((image) => image.id);
  const captionIds = captionCards.map((card) => card.id);
  const onTable = promptKind === "image" ? imageIds : captionIds;
  const inHand = promptKind === "image" ? captionIds : imageIds;
  return {
    mode: CAPTION_MODE,
    promptKind,
    judged,
    status: "lobby",
    phase: null,
    players,
    turnOrder: players.map((item) => item.id),
    judgeId: null,
    roundNumber: 0,
    scoreTarget,
    handSize: handSize ?? captionHandSize(promptKind),
    handDeck: shuffle(inHand, random),
    handDiscard: [],
    promptDeck: shuffle(onTable, random),
    currentPromptId: null,
    submissions: [],
    reveal: [],
    lastRound: null,
    winnerIds: [],
    endReason: null
  };
}

export function addCaptionLobbyPlayer(match, participant) {
  if (match.status !== "lobby") {
    fail("This game has already started.", 409);
  }
  if (match.players.length >= MAX_CAPTION_PLAYERS) {
    fail("This room is full.", 409);
  }
  const next = copy(match);
  next.players.push({ ...participant, connected: true, score: 0, hand: [] });
  next.turnOrder.push(participant.id);
  return next;
}

export function setCaptionPresence(match, playerId, connected, random = Math.random) {
  const next = copy(match);
  const participant = player(next, playerId);
  if (!participant) {
    return next;
  }
  participant.connected = connected;
  // Losing the player everyone was waiting on should release the round, not stall it.
  return connected ? next : closeSubmissionsIfReady(next, random);
}

function startMatch(next, actorId, random) {
  const actor = requirePlayer(next, actorId);
  if (actor.role !== "host") {
    fail("Only the host can start the game.", 403);
  }
  if (next.status !== "lobby") {
    fail("This game has already started.");
  }
  const needed = minCaptionPlayers(next.judged);
  if (next.players.length < needed) {
    fail(`This game needs at least ${needed} players.`);
  }
  next.status = "playing";
  next.judgeId = next.judged ? next.turnOrder[0] : null;
  return beginRound(next, random, { rotate: false });
}

function submitCard(next, actorId, payload, random) {
  requirePlaying(next);
  const actor = requirePlayer(next, actorId);
  if (next.phase !== "submitting") {
    fail("Submissions are closed for this round.");
  }
  if (next.judged && actorId === next.judgeId) {
    fail("The judge does not play a card this round.");
  }
  if (next.submissions.some((entry) => entry.playerId === actorId)) {
    fail("You have already played a card this round.");
  }
  const cardId = payload.cardId;
  if (!actor.hand.includes(cardId)) {
    fail("That card is not in your hand.");
  }
  actor.hand = actor.hand.filter((item) => item !== cardId);
  next.submissions.push({ playerId: actorId, cardId });
  return closeSubmissionsIfReady(next, random);
}

function chooseWinner(next, actorId, payload) {
  requirePlaying(next);
  requirePlayer(next, actorId);
  if (!next.judged) {
    fail("This game has no judge.");
  }
  if (next.phase !== "judging") {
    fail("There is nothing to judge yet.");
  }
  if (actorId !== next.judgeId) {
    fail("Only the judge picks the winning card.", 403);
  }
  const winning = next.reveal.find((entry) => entry.cardId === payload.cardId);
  if (!winning) {
    fail("That card was not played this round.");
  }
  const winner = player(next, winning.playerId);
  winner.score += 1;
  next.lastRound = {
    promptId: next.currentPromptId,
    winnerId: winner.id,
    winningCardId: winning.cardId,
    judgeId: next.judgeId
  };
  next.handDiscard.push(...next.submissions.map((entry) => entry.cardId));
  next.phase = "round_over";
  return next;
}

function startNextRound(next, actorId, random) {
  requirePlaying(next);
  requirePlayer(next, actorId);
  if (next.phase !== "round_over") {
    fail("This round is still in play.");
  }
  if (next.judged && next.players.some((item) => item.score >= next.scoreTarget)) {
    return finish(next, "score_target");
  }
  return beginRound(next, random);
}

function skipStalledRound(next, actorId, random) {
  requirePlaying(next);
  const actor = requirePlayer(next, actorId);
  if (actor.role !== "host" || !canHostSkipCaptionRound(next, actorId)) {
    fail("There is nothing stalled to skip.", 403);
  }
  next.handDiscard.push(...next.submissions.map((entry) => entry.cardId));
  next.lastRound = null;
  return beginRound(next, random);
}

export function performCaptionAction(match, actorId, action, payload = {}, random = Math.random) {
  const next = copy(match);
  if (action === "start_match") {
    return startMatch(next, actorId, random);
  }
  if (action === "submit_caption") {
    return submitCard(next, actorId, payload, random);
  }
  if (action === "choose_winner") {
    return chooseWinner(next, actorId, payload);
  }
  if (action === "next_round") {
    return startNextRound(next, actorId, random);
  }
  if (action === "skip_stalled_round") {
    return skipStalledRound(next, actorId, random);
  }
  return fail("Unsupported action.");
}

/** A round is stalled when the person it is waiting on is gone. */
export function canHostSkipCaptionRound(match, viewerId) {
  if (match.status !== "playing" || player(match, viewerId)?.role !== "host") {
    return false;
  }
  if (match.judged && (match.phase === "judging" || match.phase === "round_over")) {
    return !player(match, match.judgeId)?.connected;
  }
  if (match.phase === "submitting") {
    return pendingSubmitters(match).length === 0 && match.submissions.length === 0;
  }
  return false;
}

function actionsFor(match, viewerId, canSkip) {
  const actor = player(match, viewerId);
  if (!actor) {
    return [];
  }
  if (match.status === "lobby") {
    const ready = match.players.length >= minCaptionPlayers(match.judged);
    return actor.role === "host" && ready ? ["start_match"] : [];
  }
  if (match.status !== "playing") {
    return [];
  }
  const actions = [];
  if (canSkip && actor.role === "host") {
    actions.push("skip_stalled_round");
  }
  if (match.phase === "submitting" &&
    !(match.judged && viewerId === match.judgeId) &&
    !match.submissions.some((entry) => entry.playerId === viewerId) &&
    actor.hand.length > 0) {
    actions.push("submit_caption");
  }
  if (match.judged && match.phase === "judging" && viewerId === match.judgeId) {
    actions.push("choose_winner");
  }
  if (match.phase === "round_over") {
    actions.push("next_round");
  }
  return actions;
}

/**
 * The snapshot one player is allowed to see.
 *
 * Three things never leave this function: another player's hand, who played which card
 * while a judge is deciding, and the decks. Judging is deliberately anonymous, so authors
 * appear only once the round is over - which in free play is immediately, since there is
 * nobody whose opinion the anonymity was protecting.
 */
export function captionView(match, viewerId, {
  canSkip = false,
  captionCards = CAPTION_CARDS,
  memeImages = MEME_IMAGES
} = {}) {
  const viewer = player(match, viewerId);
  const authorsVisible = match.phase === "round_over" || match.status === "finished";
  // The match holds card ids only, so the decks it was dealt from have to come back in
  // here. Anything that swaps a card source has to swap it in both places.
  const captionById = new Map(captionCards.map((card) => [card.id, card]));
  const imageById = new Map(memeImages.map((image) => [image.id, image]));
  const promptById = match.promptKind === "image" ? imageById : captionById;
  const handById = match.promptKind === "image" ? captionById : imageById;

  return {
    mode: match.mode,
    promptKind: match.promptKind,
    judged: match.judged,
    status: match.status,
    phase: match.phase,
    roundNumber: match.roundNumber,
    scoreTarget: match.scoreTarget,
    minPlayers: minCaptionPlayers(match.judged),
    judgeId: match.judgeId,
    viewerId,
    isJudge: match.judged && viewerId === match.judgeId,
    players: match.players.map((item) => ({
      id: item.id,
      name: item.name,
      role: item.role,
      connected: item.connected,
      score: item.score,
      handCount: item.hand.length
    })),
    hand: (viewer?.hand || []).map((cardId) => handById.get(cardId)).filter(Boolean),
    prompt: match.currentPromptId ? promptById.get(match.currentPromptId) || null : null,
    submittedPlayerIds: match.phase === "submitting"
      ? match.submissions.map((entry) => entry.playerId)
      : [],
    awaitingPlayerIds: match.phase === "submitting"
      ? pendingSubmitters(match).map((item) => item.id)
      : [],
    reveal: ["judging", "round_over"].includes(match.phase)
      ? match.reveal.map((entry) => ({
          cardId: entry.cardId,
          card: handById.get(entry.cardId) || null,
          ...(authorsVisible ? { playerId: entry.playerId } : {})
        }))
      : [],
    lastRound: match.lastRound,
    winnerIds: match.winnerIds,
    endReason: match.endReason,
    handCardsRemaining: match.handDeck.length + match.handDiscard.length,
    promptsRemaining: match.promptDeck.length,
    availableActions: actionsFor(match, viewerId, canSkip)
  };
}
