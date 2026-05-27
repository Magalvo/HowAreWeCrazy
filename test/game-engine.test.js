import test from "node:test";
import assert from "node:assert/strict";
import {
  advance,
  continueLevel,
  createSession,
  currentCard,
  currentPosition,
  reveal,
  totalCards
} from "../game-engine.js";

function fixedRandom() {
  return 0.2;
}

test("creates a complete three-level game for a chosen audience", () => {
  const session = createSession({ audience: "friends", cardsPerLevel: 4, random: fixedRandom });

  assert.equal(totalCards(session), 12);
  assert.equal(currentPosition(session), 1);
  assert.ok(currentCard(session).audiences.includes("friends"));
});

test("requires a reveal state without losing progress", () => {
  const session = createSession({ audience: "couple", cardsPerLevel: 4, random: fixedRandom });
  const revealed = reveal(session);

  assert.equal(session.revealed, false);
  assert.equal(revealed.revealed, true);
  assert.equal(currentPosition(revealed), 1);
});

test("general couple conversations do not include A Table 4 Two-only expansion cards", () => {
  const session = createSession({ audience: "couple", cardsPerLevel: 20, random: fixedRandom });

  assert.equal(Object.values(session.cardsByLevel).flat().some((id) => id.startsWith("d")), false);
});

test("local conversations exclude spicy prompts by default", () => {
  const session = createSession({ audience: "friends", cardsPerLevel: 50, random: fixedRandom });
  const ids = Object.values(session.cardsByLevel).flat();

  assert.equal(ids.includes("q131"), false);
  assert.equal(ids.includes("q132"), false);
  assert.equal(ids.includes("q134"), false);
});

test("pauses between levels and finishes after the final prompt", () => {
  let session = createSession({ audience: "group", cardsPerLevel: 4, random: fixedRandom });

  for (let index = 0; index < 4; index += 1) {
    session = advance(session);
  }

  assert.equal(session.betweenLevels, true);
  assert.equal(session.levelIndex, 1);

  session = continueLevel(session);
  for (let index = 0; index < 8; index += 1) {
    session = advance(session);
    if (session.betweenLevels) {
      session = continueLevel(session);
    }
  }

  assert.equal(session.completed, true);
});
