import test from "node:test";
import assert from "node:assert/strict";
import {
  addCaptionLobbyPlayer,
  canHostSkipCaptionRound,
  captionView,
  createCaptionMatch,
  performCaptionAction,
  setCaptionPresence
} from "../caption-engine.js";

const ORDERED = () => 0;

function lobby(names = ["Ana", "Rui", "Sara"]) {
  return createCaptionMatch({
    participants: names.map((name, index) => ({
      id: `p${index + 1}`,
      name,
      role: index === 0 ? "host" : "player"
    })),
    random: ORDERED
  });
}

function started(names) {
  return performCaptionAction(lobby(names), "p1", "start_match", {}, ORDERED);
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

test("a game needs three players before the host can start it", () => {
  const pair = createCaptionMatch({
    participants: [
      { id: "p1", name: "Ana", role: "host" },
      { id: "p2", name: "Rui", role: "player" }
    ],
    random: ORDERED
  });

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

test("starting deals a full hand to everyone and puts an image on the table", () => {
  const match = started();
  const view = captionView(match, "p2");

  assert.equal(view.phase, "submitting");
  assert.equal(view.roundNumber, 1);
  assert.equal(view.hand.length, match.handSize);
  assert.ok(view.image.url.startsWith("https://"));
  assert.ok(view.players.every((item) => item.handCount === match.handSize));
});

test("the judge plays no caption and everyone else plays exactly one", () => {
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

test("a caption has to come from your own hand", () => {
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

  assert.equal(view.captionDeck, undefined);
  assert.equal(view.imageDeck, undefined);
  assert.equal(view.captionDiscard, undefined);
  assert.equal(view.submissions, undefined);
  assert.ok(view.captionsRemaining > 0);
});

test("while the round is open, played captions stay hidden from everyone", () => {
  const match = playFrom(started(["Ana", "Rui", "Sara", "Tó"]), "p2");

  ["p1", "p2", "p3"].forEach((viewerId) => {
    assert.deepEqual(captionView(match, viewerId).reveal, []);
  });
  assert.deepEqual(captionView(match, "p1").submittedPlayerIds, ["p2"]);
});

test("judging is anonymous, and authorship appears only once the round is won", () => {
  const match = everyoneSubmits(started());

  const judging = captionView(match, "p1");
  assert.equal(judging.reveal.length, 2);
  assert.ok(judging.reveal.every((entry) => entry.playerId === undefined));
  assert.ok(judging.reveal.every((entry) => entry.text.length > 0));

  const won = performCaptionAction(match, "p1", "choose_winner", { cardId: judging.reveal[0].cardId }, ORDERED);
  const revealed = captionView(won, "p1");
  assert.ok(revealed.reveal.every((entry) => entry.playerId !== undefined));
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

test("winning a round scores a point for the caption's author", () => {
  const match = everyoneSubmits(started());
  const winningCard = captionView(match, "p1").reveal[0].cardId;
  const author = match.submissions.find((entry) => entry.cardId === winningCard).playerId;

  const won = performCaptionAction(match, "p1", "choose_winner", { cardId: winningCard }, ORDERED);

  assert.equal(won.players.find((item) => item.id === author).score, 1);
  assert.equal(won.lastRound.winnerId, author);
  assert.equal(won.lastRound.judgeId, "p1");
  assert.equal(won.phase, "round_won");
});

test("the next round rotates the judge, refills hands, and turns over a new image", () => {
  const first = everyoneSubmits(started());
  const firstImage = first.currentImageId;
  const won = performCaptionAction(first, "p1", "choose_winner", {
    cardId: captionView(first, "p1").reveal[0].cardId
  }, ORDERED);

  const second = performCaptionAction(won, "p1", "next_round", {}, ORDERED);

  assert.equal(second.judgeId, "p2");
  assert.equal(second.roundNumber, 2);
  assert.notEqual(second.currentImageId, firstImage);
  assert.equal(second.phase, "submitting");
  assert.ok(second.players.every((item) => item.hand.length === second.handSize));
});

test("the game ends when a player reaches the score target", () => {
  let match = createCaptionMatch({
    participants: [
      { id: "p1", name: "Ana", role: "host" },
      { id: "p2", name: "Rui", role: "player" },
      { id: "p3", name: "Sara", role: "player" }
    ],
    random: ORDERED,
    scoreTarget: 1
  });
  match = performCaptionAction(match, "p1", "start_match", {}, ORDERED);
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
  assert.equal(match.phase, "submitting");

  const afterOneMore = playFrom(match, "p3");
  assert.equal(afterOneMore.phase, "submitting");

  const dropped = setCaptionPresence(afterOneMore, "p4", false, ORDERED);

  assert.equal(dropped.phase, "judging");
  assert.equal(captionView(dropped, "p1").reveal.length, 2);
});

test("a player who already played still counts once they drop", () => {
  const match = everyoneSubmits(started());
  const dropped = setCaptionPresence(match, "p2", false, ORDERED);

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
  assert.equal(skipped.lastRound, null);
  assert.ok(skipped.players.every((item) => item.score === 0));
});

test("a judge who leaves is skipped over when the next round is dealt", () => {
  const first = everyoneSubmits(started());
  const won = performCaptionAction(first, "p1", "choose_winner", {
    cardId: captionView(first, "p1").reveal[0].cardId
  }, ORDERED);
  const withoutRui = setCaptionPresence(won, "p2", false, ORDERED);

  const second = performCaptionAction(withoutRui, "p1", "next_round", {}, ORDERED);

  assert.equal(second.judgeId, "p3");
});

test("played captions come back around so a long game does not run dry", () => {
  const deck = Array.from({ length: 8 }, (unused, index) => ({
    id: `cap-${index + 1}`,
    text: `Caption ${index + 1}`
  }));
  let match = createCaptionMatch({
    participants: [
      { id: "p1", name: "Ana", role: "host" },
      { id: "p2", name: "Rui", role: "player" },
      { id: "p3", name: "Sara", role: "player" }
    ],
    random: ORDERED,
    handSize: 2,
    scoreTarget: 99,
    captionCards: deck
  });
  match = performCaptionAction(match, "p1", "start_match", {}, ORDERED);

  const catalog = { captionCards: deck };
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

test("the game ends when the images run out", () => {
  let match = createCaptionMatch({
    participants: [
      { id: "p1", name: "Ana", role: "host" },
      { id: "p2", name: "Rui", role: "player" },
      { id: "p3", name: "Sara", role: "player" }
    ],
    random: ORDERED,
    scoreTarget: 99,
    memeImages: [{ id: "im-1", name: "One", url: "https://example.test/1.jpg", width: 600, height: 600 }]
  });
  match = performCaptionAction(match, "p1", "start_match", {}, ORDERED);
  match = everyoneSubmits(match);
  match = performCaptionAction(match, "p1", "choose_winner", {
    cardId: captionView(match, "p1").reveal[0].cardId
  }, ORDERED);

  const finished = performCaptionAction(match, "p1", "next_round", {}, ORDERED);

  assert.equal(finished.status, "finished");
  assert.equal(finished.endReason, "images_exhausted");
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
