import test from "node:test";
import assert from "node:assert/strict";
import {
  competitiveView,
  createCompetitiveMatch,
  performCompetitiveAction
} from "../competitive-engine.js";

const participants = [
  { id: "host", name: "Host", role: "host" },
  { id: "p2", name: "Mina", role: "player" },
  { id: "p3", name: "Dev", role: "player" }
];

function matchStarted() {
  const lobby = createCompetitiveMatch({ participants, audience: "group", random: () => 0.2 });
  return performCompetitiveAction(lobby, "host", "start_match");
}

test("starts in join order and keeps drawn prompts private until targeting", () => {
  let match = matchStarted();
  assert.equal(match.activePlayerId, "host");
  assert.equal(Object.values(match.decksByLevel).flat().length, 36);

  match = performCompetitiveAction(match, "host", "choose_level", { levelId: "connection" });
  const hostView = competitiveView(match, "host");
  const otherView = competitiveView(match, "p2");

  assert.ok(hostView.currentChallenge.prompt.text);
  assert.equal(otherView.currentChallenge.prompt, undefined);

  match = performCompetitiveAction(match, "host", "target_player", { targetPlayerId: "p2" });
  assert.ok(competitiveView(match, "p3").currentChallenge.prompt.text);
});

test("awards points to responders and rotates turns", () => {
  let match = matchStarted();
  match = performCompetitiveAction(match, "host", "choose_level", { levelId: "reflection" });
  match = performCompetitiveAction(match, "host", "target_player", { targetPlayerId: "p2" });
  match = performCompetitiveAction(match, "p2", "complete");

  assert.equal(match.players.find((item) => item.id === "p2").score, 5);
  assert.equal(match.activePlayerId, "p2");
  assert.equal(match.phase, "choose_level");
});

test("a pass lets the active player claim base points", () => {
  let match = matchStarted();
  match = performCompetitiveAction(match, "host", "choose_level", { levelId: "connection", doubleDown: true });
  match = performCompetitiveAction(match, "host", "target_player", { targetPlayerId: "p2" });
  match = performCompetitiveAction(match, "p2", "pass");
  match = performCompetitiveAction(match, "host", "claim");
  match = performCompetitiveAction(match, "host", "complete");

  assert.equal(match.players.find((item) => item.id === "host").score, 3);
  assert.equal(match.players.find((item) => item.id === "host").doubleDownAvailable, false);
});

test("Bailout is free, refunds Double Down, and requires a different replacement target", () => {
  let match = matchStarted();
  match = performCompetitiveAction(match, "host", "choose_level", { levelId: "curiosity", doubleDown: true });
  match = performCompetitiveAction(match, "host", "target_player", { targetPlayerId: "p2" });
  match = performCompetitiveAction(match, "p2", "bailout");

  assert.equal(match.players.find((item) => item.id === "p2").score, 0);
  assert.equal(match.players.find((item) => item.id === "p2").bailoutAvailable, false);
  assert.equal(match.players.find((item) => item.id === "host").doubleDownAvailable, true);
  assert.equal(match.phase, "replacement_preview");
  assert.throws(
    () => performCompetitiveAction(match, "host", "target_player", { targetPlayerId: "p2" }),
    /different player/
  );
  match = performCompetitiveAction(match, "host", "target_player", { targetPlayerId: "p3" });
  assert.equal(match.currentChallenge.doubled, false);
});

test("Double Down doubles responder points and clamps the active score at zero", () => {
  let match = matchStarted();
  match = performCompetitiveAction(match, "host", "choose_level", { levelId: "reflection", doubleDown: true });
  match = performCompetitiveAction(match, "host", "target_player", { targetPlayerId: "p2" });
  match = performCompetitiveAction(match, "p2", "complete");

  assert.equal(match.players.find((item) => item.id === "p2").score, 10);
  assert.equal(match.players.find((item) => item.id === "host").score, 0);
});

test("finishes immediately when a player reaches 21 points", () => {
  let match = matchStarted();
  match.players.find((item) => item.id === "p2").score = 18;
  match = performCompetitiveAction(match, "host", "choose_level", { levelId: "connection" });
  match = performCompetitiveAction(match, "host", "target_player", { targetPlayerId: "p2" });
  match = performCompetitiveAction(match, "p2", "complete");

  assert.equal(match.status, "finished");
  assert.deepEqual(match.winnerIds, ["p2"]);
  assert.equal(match.endReason, "score_target");
});

test("finishes by high score with ties when all decks are depleted", () => {
  let match = matchStarted();
  match.players.find((item) => item.id === "host").score = 5;
  match.players.find((item) => item.id === "p2").score = 5;
  match.decksByLevel.curiosity = ["c01"];
  match.decksByLevel.connection = [];
  match.decksByLevel.reflection = [];
  match = performCompetitiveAction(match, "host", "choose_level", { levelId: "curiosity" });
  match = performCompetitiveAction(match, "host", "target_player", { targetPlayerId: "p3" });
  match = performCompetitiveAction(match, "p3", "pass");
  match = performCompetitiveAction(match, "host", "discard");

  assert.equal(match.status, "finished");
  assert.deepEqual(match.winnerIds, ["host", "p2"]);
  assert.equal(match.endReason, "deck_exhausted");
});
