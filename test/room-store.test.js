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

test("A Table 4 Two accepts exactly a pair and broadcasts its revealed prompt", () => {
  const store = createFixedStore();
  const created = store.createRoom({ mode: "date_night", hostName: "Ari" });
  const partner = store.joinRoom("PLAY5", "Lee");
  assert.throws(() => store.joinRoom("PLAY5", "Extra"), /full/);
  store.act("PLAY5", created.participantToken, "start_match");
  store.act("PLAY5", created.participantToken, "choose_level", { levelId: "curiosity" });
  assert.ok(store.getRoom("PLAY5", partner.participantToken).session.currentChallenge.prompt.text);
});

test("Classic accepts exactly a pair and allows either participant to advance", () => {
  const store = createFixedStore();
  const created = store.createRoom({ mode: "classic", hostName: "Ari" });
  const partner = store.joinRoom("PLAY5", "Lee");
  assert.throws(() => store.joinRoom("PLAY5", "Extra"), /full/);

  store.act("PLAY5", created.participantToken, "start_match");
  let view = store.getRoom("PLAY5", partner.participantToken);
  assert.equal(view.session.currentChallenge.prompt.id, "aron01");

  store.act("PLAY5", partner.participantToken, "next_prompt");
  view = store.getRoom("PLAY5", created.participantToken);
  assert.equal(view.session.currentChallenge.prompt.id, "aron02");
});

test("A Table 4 Two room creation accepts and exposes safe custom theme filters", () => {
  const store = createFixedStore();
  const created = store.createRoom({
    mode: "date_night",
    hostName: "Ari",
    promptFilters: { tags: ["Future", "Romance"], includeSpicy: true },
    dateVariant: "free_minds"
  });

  assert.deepEqual(created.room.session.promptFilters, { tags: ["Future", "Romance"], includeSpicy: true });
  assert.equal(created.room.session.dateVariant, "free_minds");
  assert.equal(created.room.session.usedPromptIds, undefined);
});

test("room creation rejects invalid custom filters", () => {
  const store = createFixedStore();

  assert.throws(
    () => store.createRoom({
      mode: "date_night",
      promptFilters: { tags: ["Childhood"], includeSpicy: false }
    }),
    /at least 2 prompts/
  );
  assert.throws(
    () => store.createRoom({
      mode: "icebreaker",
      promptFilters: { tags: ["Identity"], includeSpicy: false }
    }),
    /only available for A Table 4 Two/
  );
});

test("a caption room seats up to eight players and keeps each hand private", () => {
  const store = createFixedStore();
  const host = store.createRoom({ mode: "caption", hostName: "Ana" });
  const rui = store.joinRoom("PLAY5", "Rui");
  const sara = store.joinRoom("PLAY5", "Sara");

  store.act("PLAY5", host.participantToken, "start_match");

  const hostView = store.getRoom("PLAY5", host.participantToken);
  const ruiView = store.getRoom("PLAY5", rui.participantToken);
  assert.equal(hostView.session.phase, "submitting");
  assert.equal(hostView.mode, "caption");
  assert.equal(hostView.session.hand.length, 7);
  assert.notDeepEqual(
    hostView.session.hand.map((card) => card.id),
    ruiView.session.hand.map((card) => card.id)
  );
  assert.ok(hostView.session.players.every((item) => item.hand === undefined));
  assert.equal(sara.room.session.captionDeck, undefined);
});

test("a caption room refuses late joins and unknown participants", () => {
  const store = createFixedStore();
  const host = store.createRoom({ mode: "caption" });
  store.joinRoom("PLAY5", "Rui");
  store.joinRoom("PLAY5", "Sara");
  store.act("PLAY5", host.participantToken, "start_match");

  assert.throws(() => store.joinRoom("PLAY5", "Late"), /already started/);
  assert.throws(
    () => store.act("PLAY5", "wrong-token", "submit_caption", { cardId: "cap-001" }),
    /Participant access/
  );
});

test("a caption round hides played captions until judging opens", () => {
  const store = createFixedStore();
  const host = store.createRoom({ mode: "caption", hostName: "Ana" });
  const rui = store.joinRoom("PLAY5", "Rui");
  const sara = store.joinRoom("PLAY5", "Sara");
  store.act("PLAY5", host.participantToken, "start_match");

  const ruiHand = store.getRoom("PLAY5", rui.participantToken).session.hand;
  store.act("PLAY5", rui.participantToken, "submit_caption", { cardId: ruiHand[0].id });

  const midRound = store.getRoom("PLAY5", host.participantToken).session;
  assert.equal(midRound.phase, "submitting");
  assert.deepEqual(midRound.reveal, []);
  assert.deepEqual(midRound.submittedPlayerIds, [rui.participantId]);

  const saraHand = store.getRoom("PLAY5", sara.participantToken).session.hand;
  store.act("PLAY5", sara.participantToken, "submit_caption", { cardId: saraHand[0].id });

  const judging = store.getRoom("PLAY5", host.participantToken).session;
  assert.equal(judging.phase, "judging");
  assert.equal(judging.reveal.length, 2);
  assert.ok(judging.reveal.every((entry) => entry.playerId === undefined));
});

test("caption subscribers each receive their own hand", () => {
  const store = createFixedStore();
  const host = store.createRoom({ mode: "caption", hostName: "Ana" });
  const rui = store.joinRoom("PLAY5", "Rui");
  store.joinRoom("PLAY5", "Sara");
  const hostUpdates = [];
  const ruiUpdates = [];
  store.subscribe("PLAY5", host.participantToken, (room) => hostUpdates.push(room));
  store.subscribe("PLAY5", rui.participantToken, (room) => ruiUpdates.push(room));

  store.act("PLAY5", host.participantToken, "start_match");

  const hostHand = hostUpdates.at(-1).session.hand.map((card) => card.id);
  const ruiHand = ruiUpdates.at(-1).session.hand.map((card) => card.id);
  assert.equal(hostHand.length, 7);
  assert.equal(ruiHand.length, 7);
  assert.notDeepEqual(hostHand, ruiHand);
  assert.equal(hostUpdates.at(-1).session.viewerId, host.participantId);
});

function createIdleStore(currentTime) {
  let tokenIndex = 0;
  return createRoomStore({
    createCode: () => "PLAY5",
    createToken: () => `token-${tokenIndex += 1}`,
    random: () => 0.2,
    clock: () => currentTime(),
    roomTtlMs: 1_000,
    sweepIntervalMs: 0
  });
}

test("releases rooms that go idle and closes the streams still waiting on them", () => {
  let time = 0;
  const store = createIdleStore(() => time);
  const created = store.createRoom({ mode: "inner_circle" });
  const updates = [];
  store.subscribe("PLAY5", created.participantToken, (room) => updates.push(room));

  time = 500;
  assert.equal(store.sweepRooms(), 0);
  assert.equal(store.roomCount(), 1);

  time = 2_000;
  assert.equal(store.sweepRooms(), 1);
  assert.equal(store.roomCount(), 0);
  assert.equal(updates.at(-1), null);
  assert.throws(() => store.getRoom("PLAY5", created.participantToken), /Room not found/);
});

test("keeps a room alive while participants are still using it", () => {
  let time = 0;
  const store = createIdleStore(() => time);
  const created = store.createRoom({ audience: "friends", cardsPerLevel: 4 });

  time = 900;
  store.act("PLAY5", created.hostToken, "reveal");
  time = 1_500;

  assert.equal(store.sweepRooms(), 0);
  assert.equal(store.roomCount(), 1);
});

test("stopping the store releases every room it still holds", () => {
  let time = 0;
  const store = createIdleStore(() => time);
  store.createRoom({ mode: "icebreaker" });

  store.stop();

  assert.equal(store.roomCount(), 0);
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
