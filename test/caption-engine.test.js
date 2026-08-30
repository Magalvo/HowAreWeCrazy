import test from "node:test";
import assert from "node:assert/strict";
import {
  addCaptionLobbyPlayer,
  canHostSkipCaptionRound,
  captionHandSize,
  captionView,
  createCaptionMatch,
  minCaptionPlayers,
  performCaptionAction,
  setCaptionPresence
} from "../caption-engine.js";

const ORDERED = () => 0;

function participants(names) {
  return names.map((name, index) => ({
    id: `p${index + 1}`,
    name,
    role: index === 0 ? "host" : "player"
  }));
}

function lobby(names = ["Ana", "Rui", "Sara"], options = {}) {
  return createCaptionMatch({ participants: participants(names), random: ORDERED, ...options });
}

function started(names, options) {
  return performCaptionAction(lobby(names, options), "p1", "start_match", {}, ORDERED);
}

function playFrom(match, playerId, catalog = {}) {
  const hand = captionView(match, playerId, catalog).hand;
  return performCaptionAction(match, playerId, "submit_caption", { cardId: hand[0].id }, ORDERED);
}

function everyoneSubmits(match, catalog = {}) {
  return match.players
    .filter((item) => item.id !== match.judgeId)
    .reduce((current, item) => playFrom(current, item.id, catalog), match);
}

test("a judged game needs three players before the host can start it", () => {
  const pair = lobby(["Ana", "Rui"]);

  assert.deepEqual(captionView(pair, "p1").availableActions, []);
  assert.throws(() => performCaptionAction(pair, "p1", "start_match", {}, ORDERED), /at least 3 players/);

  const trio = addCaptionLobbyPlayer(pair, { id: "p3", name: "Sara", role: "player" });
  assert.deepEqual(captionView(trio, "p1").availableActions, ["start_match"]);
});

test("only the host starts the game, and the room closes once it is running", () => {
  const match = lobby();

  assert.throws(() => performCaptionAction(match, "p2", "start_match", {}, ORDERED), /Only the host/);

  const playing = performCaptionAction(match, "p1", "start_match", {}, ORDERED);
  assert.equal(playing.status, "playing");
  assert.throws(() => addCaptionLobbyPlayer(playing, { id: "p4", name: "Late", role: "player" }), /already started/);
});

test("starting deals a full hand to everyone and puts a prompt on the table", () => {
  const match = started();
  const view = captionView(match, "p2");

  assert.equal(view.phase, "submitting");
  assert.equal(view.roundNumber, 1);
  assert.equal(view.hand.length, match.handSize);
  assert.ok(view.prompt.url.startsWith("https://"));
  assert.ok(view.players.every((item) => item.handCount === match.handSize));
});

test("the judge plays no card and everyone else plays exactly one", () => {
  const match = started();

  assert.equal(match.judgeId, "p1");
  assert.throws(
    () => performCaptionAction(match, "p1", "submit_caption", { cardId: match.players[0].hand[0] }, ORDERED),
    /judge does not play/
  );

  const afterOne = playFrom(match, "p2");
  assert.throws(() => playFrom(afterOne, "p2"), /already played/);
  assert.equal(captionView(afterOne, "p2").hand.length, match.handSize - 1);
});

test("a card has to come from your own hand", () => {
  const match = started();
  const otherHand = captionView(match, "p3").hand;

  assert.throws(
    () => performCaptionAction(match, "p2", "submit_caption", { cardId: otherHand[0].id }, ORDERED),
    /not in your hand/
  );
  assert.throws(
    () => performCaptionAction(match, "p2", "submit_caption", { cardId: "cap-does-not-exist" }, ORDERED),
    /not in your hand/
  );
});

test("judging opens only once every player owed a turn has played", () => {
  const match = started(["Ana", "Rui", "Sara", "Tó"]);

  const partial = playFrom(match, "p2");
  assert.equal(partial.phase, "submitting");
  assert.deepEqual(captionView(partial, "p1").awaitingPlayerIds, ["p3", "p4"]);

  const complete = playFrom(playFrom(partial, "p3"), "p4");
  assert.equal(complete.phase, "judging");
  assert.equal(captionView(complete, "p1").reveal.length, 3);
});

test("nobody sees another player's hand", () => {
  const match = started();
  const view = captionView(match, "p2");

  assert.equal(view.hand.length, match.handSize);
  assert.ok(view.players.every((item) => item.hand === undefined));
  assert.deepEqual(
    view.hand.map((card) => card.id),
    match.players.find((item) => item.id === "p2").hand
  );
});

test("a snapshot never carries the decks it was dealt from", () => {
  const view = captionView(started(), "p2");

  assert.equal(view.handDeck, undefined);
  assert.equal(view.promptDeck, undefined);
  assert.equal(view.handDiscard, undefined);
  assert.equal(view.submissions, undefined);
  assert.ok(view.handCardsRemaining > 0);
});

test("while the round is open, played cards stay hidden from everyone", () => {
  const match = playFrom(started(["Ana", "Rui", "Sara", "Tó"]), "p2");

  ["p1", "p2", "p3"].forEach((viewerId) => {
    assert.deepEqual(captionView(match, viewerId).reveal, []);
  });
  assert.deepEqual(captionView(match, "p1").submittedPlayerIds, ["p2"]);
});

test("judging is anonymous, and authorship appears only once the round is over", () => {
  const match = everyoneSubmits(started());

  const judging = captionView(match, "p1");
  assert.equal(judging.reveal.length, 2);
  assert.ok(judging.reveal.every((entry) => entry.playerId === undefined));
  assert.ok(judging.reveal.every((entry) => entry.card.text.length > 0));

  const over = performCaptionAction(match, "p1", "choose_winner", { cardId: judging.reveal[0].cardId }, ORDERED);
  assert.ok(captionView(over, "p1").reveal.every((entry) => entry.playerId !== undefined));
});

test("only the judge picks the winner, and only from what was played", () => {
  const match = everyoneSubmits(started());
  const played = captionView(match, "p1").reveal[0].cardId;

  assert.throws(
    () => performCaptionAction(match, "p2", "choose_winner", { cardId: played }, ORDERED),
    /Only the judge/
  );
  assert.throws(
    () => performCaptionAction(match, "p1", "choose_winner", { cardId: "cap-001-not-played" }, ORDERED),
    /not played this round/
  );
});

test("winning a round scores a point for the card's author", () => {
  const match = everyoneSubmits(started());
  const winningCard = captionView(match, "p1").reveal[0].cardId;
  const author = match.submissions.find((entry) => entry.cardId === winningCard).playerId;

  const won = performCaptionAction(match, "p1", "choose_winner", { cardId: winningCard }, ORDERED);

  assert.equal(won.players.find((item) => item.id === author).score, 1);
  assert.equal(won.lastRound.winnerId, author);
  assert.equal(won.lastRound.judgeId, "p1");
  assert.equal(won.phase, "round_over");
});

test("the next round rotates the judge, refills hands, and turns over a new prompt", () => {
  const first = everyoneSubmits(started());
  const firstPrompt = first.currentPromptId;
  const won = performCaptionAction(first, "p1", "choose_winner", {
    cardId: captionView(first, "p1").reveal[0].cardId
  }, ORDERED);

  const second = performCaptionAction(won, "p1", "next_round", {}, ORDERED);

  assert.equal(second.judgeId, "p2");
  assert.equal(second.roundNumber, 2);
  assert.notEqual(second.currentPromptId, firstPrompt);
  assert.equal(second.phase, "submitting");
  assert.ok(second.players.every((item) => item.hand.length === second.handSize));
});

test("the game ends when a player reaches the score target", () => {
  let match = started(["Ana", "Rui", "Sara"], { scoreTarget: 1 });
  match = everyoneSubmits(match);
  const winningCard = captionView(match, "p1").reveal[0].cardId;
  const author = match.submissions.find((entry) => entry.cardId === winningCard).playerId;
  match = performCaptionAction(match, "p1", "choose_winner", { cardId: winningCard }, ORDERED);

  const finished = performCaptionAction(match, "p1", "next_round", {}, ORDERED);

  assert.equal(finished.status, "finished");
  assert.equal(finished.endReason, "score_target");
  assert.deepEqual(finished.winnerIds, [author]);
  assert.deepEqual(captionView(finished, "p2").availableActions, []);
});

test("losing the player everyone was waiting on releases the round", () => {
  const match = playFrom(started(["Ana", "Rui", "Sara", "Tó"]), "p2");
  const afterOneMore = playFrom(match, "p3");
  assert.equal(afterOneMore.phase, "submitting");

  const dropped = setCaptionPresence(afterOneMore, "p4", false, ORDERED);

  assert.equal(dropped.phase, "judging");
  assert.equal(captionView(dropped, "p1").reveal.length, 2);
});

test("a player who already played still counts once they drop", () => {
  const dropped = setCaptionPresence(everyoneSubmits(started()), "p2", false, ORDERED);

  assert.equal(dropped.phase, "judging");
  assert.equal(captionView(dropped, "p1").reveal.length, 2);
});

test("the host can move past a round whose judge has gone", () => {
  const match = everyoneSubmits(started());
  assert.equal(canHostSkipCaptionRound(match, "p1"), false);

  const judgeGone = setCaptionPresence(match, "p1", false, ORDERED);
  assert.equal(canHostSkipCaptionRound(judgeGone, "p1"), true);
  assert.ok(captionView(judgeGone, "p1", { canSkip: true }).availableActions.includes("skip_stalled_round"));

  const skipped = performCaptionAction(judgeGone, "p1", "skip_stalled_round", {}, ORDERED);
  assert.equal(skipped.phase, "submitting");
  assert.equal(skipped.roundNumber, 2);
  assert.ok(skipped.players.every((item) => item.score === 0));
});

test("a judge who leaves is skipped over when the next round is dealt", () => {
  const first = everyoneSubmits(started());
  const won = performCaptionAction(first, "p1", "choose_winner", {
    cardId: captionView(first, "p1").reveal[0].cardId
  }, ORDERED);
  const withoutRui = setCaptionPresence(won, "p2", false, ORDERED);

  assert.equal(performCaptionAction(withoutRui, "p1", "next_round", {}, ORDERED).judgeId, "p3");
});

test("played cards come back around so a long game does not run dry", () => {
  const deck = Array.from({ length: 8 }, (unused, index) => ({
    id: `cap-${index + 1}`,
    text: `Caption ${index + 1}`
  }));
  const catalog = { captionCards: deck };
  let match = started(["Ana", "Rui", "Sara"], {
    handSize: 2,
    scoreTarget: 99,
    captionCards: deck
  });

  for (let round = 0; round < 6; round += 1) {
    match = everyoneSubmits(match, catalog);
    assert.equal(match.phase, "judging", `round ${round + 1} should reach judging`);
    match = performCaptionAction(match, match.judgeId, "choose_winner", {
      cardId: captionView(match, match.judgeId, catalog).reveal[0].cardId
    }, ORDERED);
    match = performCaptionAction(match, match.judgeId, "next_round", {}, ORDERED);
  }

  assert.equal(match.status, "playing");
  assert.ok(match.players.every((item) => item.hand.length === 2));
});

test("the game ends when the prompts run out", () => {
  let match = started(["Ana", "Rui", "Sara"], {
    scoreTarget: 99,
    memeImages: [{ id: "im-1", name: "One", url: "https://example.test/1.jpg", width: 600, height: 600 }]
  });
  match = everyoneSubmits(match);
  match = performCaptionAction(match, "p1", "choose_winner", {
    cardId: captionView(match, "p1").reveal[0].cardId
  }, ORDERED);

  const finished = performCaptionAction(match, "p1", "next_round", {}, ORDERED);

  assert.equal(finished.status, "finished");
  assert.equal(finished.endReason, "prompts_exhausted");
});

test("actions are refused when they do not belong to the phase", () => {
  const match = started();

  assert.throws(() => performCaptionAction(match, "p1", "choose_winner", { cardId: "x" }, ORDERED), /nothing to judge/);
  assert.throws(() => performCaptionAction(match, "p1", "next_round", {}, ORDERED), /still in play/);
  assert.throws(() => performCaptionAction(match, "p9", "submit_caption", { cardId: "x" }, ORDERED), /not in this room/);
  assert.throws(() => performCaptionAction(match, "p2", "invent_action", {}, ORDERED), /Unsupported action/);
});

test("performing an action leaves the previous state untouched", () => {
  const match = started();
  const before = structuredClone(match);

  playFrom(match, "p2");

  assert.deepEqual(match, before);
});

test("an unknown round direction is refused", () => {
  assert.throws(
    () => createCaptionMatch({ participants: participants(["Ana"]), promptKind: "sideways" }),
    /Unknown round direction/
  );
});

// --- Round direction ------------------------------------------------------

test("the reversed direction puts a caption on the table and images in hand", () => {
  const match = started(["Ana", "Rui", "Sara"], { promptKind: "caption" });
  const view = captionView(match, "p2");

  assert.equal(view.promptKind, "caption");
  assert.ok(view.prompt.text.length > 0);
  assert.equal(view.prompt.url, undefined);
  assert.ok(view.hand.every((card) => card.url?.startsWith("https://")));
});

test("an image hand is dealt smaller than a caption hand", () => {
  assert.equal(captionHandSize("image"), 7);
  assert.equal(captionHandSize("caption"), 3);
  assert.equal(started(["Ana", "Rui", "Sara"]).handSize, 7);
  assert.equal(started(["Ana", "Rui", "Sara"], { promptKind: "caption" }).handSize, 3);
});

test("a reversed round is judged the same way, on images", () => {
  const match = everyoneSubmits(started(["Ana", "Rui", "Sara"], { promptKind: "caption" }));

  const judging = captionView(match, "p1");
  assert.equal(judging.phase, "judging");
  assert.ok(judging.reveal.every((entry) => entry.card.url.startsWith("https://")));
  assert.ok(judging.reveal.every((entry) => entry.playerId === undefined));

  const over = performCaptionAction(match, "p1", "choose_winner", { cardId: judging.reveal[0].cardId }, ORDERED);
  assert.equal(over.phase, "round_over");
  assert.equal(over.players.reduce((total, item) => total + item.score, 0), 1);
});

// --- Free play, no judge --------------------------------------------------

test("free play starts with two players and seats no judge", () => {
  assert.equal(minCaptionPlayers(true), 3);
  assert.equal(minCaptionPlayers(false), 2);

  const pair = lobby(["Ana", "Rui"], { judged: false });
  assert.deepEqual(captionView(pair, "p1").availableActions, ["start_match"]);

  const match = performCaptionAction(pair, "p1", "start_match", {}, ORDERED);
  assert.equal(match.judgeId, null);
  assert.equal(captionView(match, "p1").isJudge, false);
  assert.equal(captionView(match, "p1").minPlayers, 2);
});

test("free play deals a hand to everyone, including the host", () => {
  const match = started(["Ana", "Rui"], { judged: false });

  assert.ok(match.players.every((item) => item.hand.length === match.handSize));
  assert.ok(captionView(match, "p1").availableActions.includes("submit_caption"));
  assert.ok(captionView(match, "p2").availableActions.includes("submit_caption"));
});

test("free play reveals both plays with their authors and scores nothing", () => {
  let match = started(["Ana", "Rui"], { judged: false });
  match = playFrom(match, "p1");
  assert.equal(match.phase, "submitting");
  assert.deepEqual(captionView(match, "p2").reveal, []);

  match = playFrom(match, "p2");

  const view = captionView(match, "p1");
  assert.equal(match.phase, "round_over");
  assert.equal(view.reveal.length, 2);
  assert.ok(view.reveal.every((entry) => entry.playerId !== undefined));
  assert.ok(view.players.every((item) => item.score === 0));
  assert.equal(view.lastRound, null);
});

test("free play has no winner to choose", () => {
  let match = started(["Ana", "Rui"], { judged: false });
  match = playFrom(playFrom(match, "p1"), "p2");

  assert.ok(!captionView(match, "p1").availableActions.includes("choose_winner"));
  assert.throws(
    () => performCaptionAction(match, "p1", "choose_winner", { cardId: match.reveal[0].cardId }, ORDERED),
    /no judge/
  );
});

test("either player can deal the next free-play round", () => {
  let match = started(["Ana", "Rui"], { judged: false });
  const firstPrompt = match.currentPromptId;
  match = playFrom(playFrom(match, "p1"), "p2");
  assert.ok(captionView(match, "p2").availableActions.includes("next_round"));

  const second = performCaptionAction(match, "p2", "next_round", {}, ORDERED);

  assert.equal(second.roundNumber, 2);
  assert.equal(second.judgeId, null);
  assert.notEqual(second.currentPromptId, firstPrompt);
  assert.ok(second.players.every((item) => item.hand.length === second.handSize));
});

test("free play runs until the prompts run out, never on score", () => {
  let match = started(["Ana", "Rui"], {
    judged: false,
    memeImages: [{ id: "im-1", name: "One", url: "https://example.test/1.jpg", width: 600, height: 600 }]
  });
  match = playFrom(playFrom(match, "p1"), "p2");

  const finished = performCaptionAction(match, "p1", "next_round", {}, ORDERED);

  assert.equal(finished.status, "finished");
  assert.equal(finished.endReason, "prompts_exhausted");
  assert.deepEqual(finished.winnerIds, []);
});

test("free play can also run reversed, on images in hand", () => {
  let match = started(["Ana", "Rui"], { judged: false, promptKind: "caption" });
  assert.ok(captionView(match, "p1").prompt.text.length > 0);

  match = playFrom(playFrom(match, "p1"), "p2");

  const view = captionView(match, "p2");
  assert.equal(view.phase, "round_over");
  assert.ok(view.reveal.every((entry) => entry.card.url.startsWith("https://")));
  assert.ok(view.reveal.every((entry) => entry.playerId !== undefined));
});
