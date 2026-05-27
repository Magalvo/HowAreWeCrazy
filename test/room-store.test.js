import test from "node:test";
import assert from "node:assert/strict";
import { createRoomStore } from "../server/room-store.js";

function createFixedStore() {
  let tokenIndex = 0;
  return createRoomStore({
    createCode: () => "PLAY5",
    createToken: () => `token-${tokenIndex += 1}`,
    random: () => 0.2,
    now: () => "2026-05-23T10:00:00.000Z"
  });
}

test("creates a room and adds participants using its join code", () => {
  const store = createFixedStore();
  const created = store.createRoom({ audience: "friends", cardsPerLevel: 4, hostName: "Nina" });
  const joined = store.joinRoom("play5", "Omar");

  assert.equal(created.room.code, "PLAY5");
  assert.equal(created.room.participants[0].name, "Nina");
  assert.equal(joined.room.participants.length, 2);
  assert.equal(joined.room.participants[1].role, "player");
});

test("only the host token can change shared deck state", () => {
  const store = createFixedStore();
  const created = store.createRoom({ audience: "group", cardsPerLevel: 4 });

  assert.throws(() => store.act("PLAY5", "incorrect", "reveal"), /Only the host/);
  const revealed = store.act("PLAY5", created.hostToken, "reveal");
  assert.equal(revealed.session.revealed, true);
});

test("subscribers receive join and card updates", () => {
  const store = createFixedStore();
  const created = store.createRoom({ audience: "couple", cardsPerLevel: 4 });
  const updates = [];
  const unsubscribe = store.subscribe("PLAY5", (room) => updates.push(room));

  store.joinRoom("PLAY5", "Jo");
  store.act("PLAY5", created.hostToken, "advance");
  unsubscribe();

  assert.equal(updates.length, 3);
  assert.equal(updates[1].participants.length, 2);
  assert.equal(updates[2].session.cardIndex, 1);
});

test("Inner Circle issues participant access and personalizes private preview snapshots", () => {
  const store = createFixedStore();
  const created = store.createRoom({ mode: "inner_circle" });
  const joinedOne = store.joinRoom("PLAY5", "Jo");
  const joinedTwo = store.joinRoom("PLAY5", "Kai");

  store.act("PLAY5", created.participantToken, "start_match");
  store.act("PLAY5", created.participantToken, "choose_level", { levelId: "reflection" });

  const hostView = store.getRoom("PLAY5", created.participantToken);
  const guestView = store.getRoom("PLAY5", joinedOne.participantToken);
  assert.ok(hostView.session.currentChallenge.prompt.text);
  assert.equal(guestView.session.currentChallenge.prompt, undefined);
  assert.equal(joinedTwo.room.mode, "inner_circle");
});

test("legacy competitive mode becomes Inner Circle and rejects late joins or unauthorized actions", () => {
  const store = createFixedStore();
  const created = store.createRoom({ mode: "competitive" });
  store.joinRoom("PLAY5", "Jo");
  store.joinRoom("PLAY5", "Kai");
  store.act("PLAY5", created.participantToken, "start_match");

  assert.equal(created.room.mode, "inner_circle");
  assert.throws(() => store.joinRoom("PLAY5", "Late"), /already started/);
  assert.throws(() => store.act("PLAY5", "wrong-token", "choose_level", { levelId: "curiosity" }), /Participant access/);
});

test("Inner Circle exposes host skip after a disconnected current responder", async () => {
  const store = createRoomStore({
    createCode: () => "PLAY5",
    createToken: (() => {
      let index = 0;
      return () => `token-${index += 1}`;
    })(),
    random: () => 0.2,
    disconnectGraceMs: 0
  });
  const created = store.createRoom({ mode: "inner_circle" });
  const playerTwo = store.joinRoom("PLAY5", "Jo");
  store.joinRoom("PLAY5", "Kai");
  store.act("PLAY5", created.participantToken, "start_match");
  store.act("PLAY5", created.participantToken, "choose_level", { levelId: "curiosity" });
  store.act("PLAY5", created.participantToken, "target_player", { targetPlayerId: playerTwo.participantId });
  const unsubscribe = store.subscribe("PLAY5", playerTwo.participantToken, () => {});
  unsubscribe();
  await new Promise((resolve) => setTimeout(resolve, 5));

  const hostView = store.getRoom("PLAY5", created.participantToken);
  assert.ok(hostView.session.availableActions.includes("skip_stalled_turn"));
});

test("Date Night accepts exactly a pair and broadcasts its revealed prompt", () => {
  const store = createFixedStore();
  const created = store.createRoom({ mode: "date_night", hostName: "Ari" });
  const partner = store.joinRoom("PLAY5", "Lee");
  assert.throws(() => store.joinRoom("PLAY5", "Extra"), /full/);
  store.act("PLAY5", created.participantToken, "start_match");
  store.act("PLAY5", created.participantToken, "choose_level", { levelId: "curiosity" });
  assert.ok(store.getRoom("PLAY5", partner.participantToken).session.currentChallenge.prompt.text);
});

test("Icebreaker conceals a chosen prompt until a server-selected spin target exists", () => {
  const store = createFixedStore();
  const created = store.createRoom({ mode: "icebreaker" });
  const guest = store.joinRoom("PLAY5", "Lee");
  store.joinRoom("PLAY5", "Ren");
  store.act("PLAY5", created.participantToken, "start_match");
  store.act("PLAY5", created.participantToken, "choose_level", { levelId: "connection" });
  assert.equal(store.getRoom("PLAY5", guest.participantToken).session.currentChallenge.prompt, undefined);
  store.act("PLAY5", created.participantToken, "spin_target");
  assert.ok(store.getRoom("PLAY5", guest.participantToken).session.currentChallenge.prompt.text);
});
