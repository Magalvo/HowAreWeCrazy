import test from "node:test";
import assert from "node:assert/strict";
import {
  adaptiveView,
  createAdaptiveMatch,
  performAdaptiveAction
} from "../adaptive-engine.js";

const pair = [
  { id: "host", name: "Host", role: "host" },
  { id: "p2", name: "Mina", role: "player" }
];

const group = [
  ...pair,
  { id: "p3", name: "Dev", role: "player" }
];

function start(mode, participants = group) {
  const lobby = createAdaptiveMatch({ mode, participants, random: () => 0.2 });
  return performAdaptiveAction(lobby, "host", "start_match");
}

test("Date Night requires two players and reveals responder-selected prompts publicly", () => {
  const solo = createAdaptiveMatch({ mode: "date_night", participants: [pair[0]], random: () => 0.2 });
  assert.throws(() => performAdaptiveAction(solo, "host", "start_match"), /exactly two/);

  let match = start("date_night", pair);
  match = performAdaptiveAction(match, "host", "choose_level", { levelId: "connection" });
  assert.ok(adaptiveView(match, "p2").currentChallenge.prompt.text);
  match = performAdaptiveAction(match, "host", "complete");
  assert.equal(match.connectionScore, 3);
  assert.equal(match.activePlayerId, "p2");
});

test("Date Night requires depth variety before its shared ending and makes reward final", () => {
  let match = start("date_night", pair);
  match.connectionScore = 20;
  match.completedByLevel = { curiosity: 2, connection: 2, reflection: 1 };
  match = performAdaptiveAction(match, "host", "choose_level", { levelId: "reflection" });
  match = performAdaptiveAction(match, "host", "complete");
  assert.equal(match.phase, "choose_ending");
  assert.ok(adaptiveView(match, "p2").availableActions.includes("choose_ending"));

  match = performAdaptiveAction(match, "p2", "choose_ending", { endingType: "activity" }, () => 0);
  assert.equal(match.status, "finished");
  assert.equal(match.endingChoice, "activity");
  assert.match(match.revealedReward.id, /^activity-/);

  let questionMatch = start("date_night", pair);
  questionMatch.phase = "choose_ending";
  questionMatch.connectionScore = 20;
  questionMatch.completedByLevel = { curiosity: 2, connection: 2, reflection: 2 };
  questionMatch = performAdaptiveAction(questionMatch, "host", "choose_ending", { endingType: "question" }, () => 0);
  assert.match(questionMatch.revealedReward.id, /^question-/);
});

test("Date Night passing rotates safely without adding shared points", () => {
  let match = start("date_night", pair);
  match = performAdaptiveAction(match, "host", "choose_level", { levelId: "curiosity" });
  match = performAdaptiveAction(match, "host", "pass");
  assert.equal(match.connectionScore, 0);
  assert.equal(match.activePlayerId, "p2");
});

test("Inner Circle filters friends prompts and keeps previews private until targeting", () => {
  let match = start("inner_circle");
  assert.equal(Object.values(match.decksByLevel).flat().length, 31);
  match = performAdaptiveAction(match, "host", "choose_level", { levelId: "connection" });
  assert.ok(adaptiveView(match, "host").currentChallenge.prompt.text);
  assert.equal(adaptiveView(match, "p2").currentChallenge.prompt, undefined);
  assert.equal(adaptiveView(match, "p2").currentChallenge.promptId, undefined);
  match = performAdaptiveAction(match, "host", "target_player", { targetPlayerId: "p2" });
  assert.ok(adaptiveView(match, "p3").currentChallenge.prompt.text);
});

test("Inner Circle scores, rotates, and enforces target cooldowns after a pass", () => {
  let match = start("inner_circle");
  match = performAdaptiveAction(match, "host", "choose_level", { levelId: "curiosity" });
  match = performAdaptiveAction(match, "host", "target_player", { targetPlayerId: "p2" });
  match = performAdaptiveAction(match, "p2", "pass");
  match = performAdaptiveAction(match, "host", "discard");
  match = performAdaptiveAction(match, "p2", "choose_level", { levelId: "reflection" });
  match = performAdaptiveAction(match, "p2", "target_player", { targetPlayerId: "p3" });
  match = performAdaptiveAction(match, "p3", "pass");
  match = performAdaptiveAction(match, "p2", "discard");
  match = performAdaptiveAction(match, "p3", "choose_level", { levelId: "curiosity" });
  assert.throws(
    () => performAdaptiveAction(match, "p3", "target_player", { targetPlayerId: "p2" }),
    /cooling down/
  );
  assert.ok(match.cooldownTargetIds.includes("p2"));
});

test("Inner Circle Bailout refunds Double Down and replacement excludes that responder", () => {
  let match = start("inner_circle");
  match = performAdaptiveAction(match, "host", "choose_level", { levelId: "curiosity", doubleDown: true });
  match = performAdaptiveAction(match, "host", "target_player", { targetPlayerId: "p2" });
  match = performAdaptiveAction(match, "p2", "bailout");
  assert.equal(match.players.find((item) => item.id === "host").doubleDownAvailable, true);
  assert.equal(match.phase, "replacement_preview");
  assert.throws(
    () => performAdaptiveAction(match, "host", "target_player", { targetPlayerId: "p2" }),
    /different player/
  );
  match = performAdaptiveAction(match, "host", "target_player", { targetPlayerId: "p3" });
  assert.equal(match.currentChallenge.doubled, false);
});

test("Inner Circle Double Down scores safely and wins immediately at 21", () => {
  let match = start("inner_circle");
  match.players.find((item) => item.id === "p2").score = 18;
  match = performAdaptiveAction(match, "host", "choose_level", { levelId: "connection", doubleDown: true });
  match = performAdaptiveAction(match, "host", "target_player", { targetPlayerId: "p2" });
  match = performAdaptiveAction(match, "p2", "complete");
  assert.equal(match.players.find((item) => item.id === "host").score, 0);
  assert.equal(match.status, "finished");
  assert.deepEqual(match.winnerIds, ["p2"]);
});

test("Inner Circle finishes an exhausted deck with tied high scores", () => {
  let match = start("inner_circle");
  match.players.find((item) => item.id === "host").score = 5;
  match.players.find((item) => item.id === "p2").score = 5;
  match.decksByLevel = { curiosity: ["c01"], connection: [], reflection: [] };
  match = performAdaptiveAction(match, "host", "choose_level", { levelId: "curiosity" });
  match = performAdaptiveAction(match, "host", "target_player", { targetPlayerId: "p3" });
  match = performAdaptiveAction(match, "p3", "pass");
  match = performAdaptiveAction(match, "host", "discard");
  assert.equal(match.status, "finished");
  assert.deepEqual(match.winnerIds, ["host", "p2"]);
});

test("Icebreaker draws only light levels, hides unspun prompts, and cycles responders fairly", () => {
  let match = start("icebreaker");
  assert.deepEqual(Object.keys(match.decksByLevel), ["curiosity", "connection"]);
  assert.equal(Object.values(match.decksByLevel).flat().length, 21);
  match = performAdaptiveAction(match, "host", "choose_level", { levelId: "connection" });
  assert.equal(adaptiveView(match, "host").currentChallenge.prompt, undefined);
  assert.equal(adaptiveView(match, "host").currentChallenge.promptId, undefined);
  match = performAdaptiveAction(match, "host", "spin_target", {}, () => 0);
  const firstTarget = match.targetPlayerId;
  assert.notEqual(firstTarget, "host");
  assert.ok(adaptiveView(match, "p3").currentChallenge.prompt.text);
  match = performAdaptiveAction(match, firstTarget, "pass");
  match = performAdaptiveAction(match, match.activePlayerId, "choose_level", { levelId: "curiosity" });
  match = performAdaptiveAction(match, match.activePlayerId, "spin_target", {}, () => 0);
  assert.notEqual(match.targetPlayerId, firstTarget);
});

test("Icebreaker completion grows shared progress and finishes at 15", () => {
  let match = start("icebreaker");
  match.groupScore = 12;
  match = performAdaptiveAction(match, "host", "choose_level", { levelId: "connection" });
  match = performAdaptiveAction(match, "host", "spin_target", {}, () => 0);
  match = performAdaptiveAction(match, match.targetPlayerId, "complete");
  assert.equal(match.groupScore, 15);
  assert.equal(match.status, "finished");
  assert.equal(match.endReason, "score_target");
});

test("Icebreaker closes gently when its light prompt deck is exhausted", () => {
  let match = start("icebreaker");
  match.decksByLevel = { curiosity: ["c01"], connection: [] };
  match = performAdaptiveAction(match, "host", "choose_level", { levelId: "curiosity" });
  match = performAdaptiveAction(match, "host", "spin_target", {}, () => 0);
  match = performAdaptiveAction(match, match.targetPlayerId, "pass");
  assert.equal(match.status, "finished");
  assert.equal(match.endReason, "deck_exhausted");
  assert.equal(match.groupScore, 0);
});
