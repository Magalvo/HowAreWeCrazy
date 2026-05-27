import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createAppServer } from "../server/app-server.js";
import { createRoomStore } from "../server/room-store.js";

async function openTestServer() {
  let tokenIndex = 0;
  const store = createRoomStore({
    createCode: () => "ROOM7",
    createToken: () => `id-${tokenIndex += 1}`,
    random: () => 0.2
  });
  const server = createAppServer({ store });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return { server, origin: `http://127.0.0.1:${port}` };
}

async function postJson(origin, path, body) {
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

test("room API creates, joins, and allows the host to reveal the shared card", async (t) => {
  const { server, origin } = await openTestServer();
  t.after(() => server.close());

  const createResponse = await postJson(origin, "/api/rooms", {
    audience: "friends",
    cardsPerLevel: 4,
    hostName: "Ari"
  });
  const created = await createResponse.json();
  const joinResponse = await postJson(origin, "/api/rooms/ROOM7/join", { name: "Lee" });
  const joined = await joinResponse.json();
  const actionResponse = await postJson(origin, "/api/rooms/ROOM7/actions", {
    action: "reveal",
    hostToken: created.hostToken
  });
  const revealed = await actionResponse.json();

  assert.equal(createResponse.status, 201);
  assert.equal(joined.room.participants.length, 2);
  assert.equal(revealed.session.revealed, true);
});

test("room API rejects deck controls without the host token", async (t) => {
  const { server, origin } = await openTestServer();
  t.after(() => server.close());

  await postJson(origin, "/api/rooms", { audience: "group", cardsPerLevel: 4 });
  const response = await postJson(origin, "/api/rooms/ROOM7/actions", {
    action: "advance",
    hostToken: "not-the-host"
  });

  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /Only the host/);
});

test("Points Mode API authenticates player actions and hides private preview prompts", async (t) => {
  const { server, origin } = await openTestServer();
  t.after(() => server.close());

  const created = await (await postJson(origin, "/api/rooms", {
    audience: "group",
    cardsPerLevel: 4,
    mode: "competitive"
  })).json();
  const joinedOne = await (await postJson(origin, "/api/rooms/ROOM7/join", { name: "Lee" })).json();
  await postJson(origin, "/api/rooms/ROOM7/join", { name: "Ren" });
  await postJson(origin, "/api/rooms/ROOM7/actions", {
    action: "start_match",
    participantToken: created.participantToken
  });
  await postJson(origin, "/api/rooms/ROOM7/actions", {
    action: "choose_level",
    levelId: "connection",
    participantToken: created.participantToken
  });

  const host = await (await fetch(`${origin}/api/rooms/ROOM7?participantToken=${created.participantToken}`)).json();
  const guest = await (await fetch(`${origin}/api/rooms/ROOM7?participantToken=${joinedOne.participantToken}`)).json();
  assert.ok(host.session.currentChallenge.prompt.text);
  assert.equal(guest.session.currentChallenge.prompt, undefined);
});

test("Points Mode event stream sends a personalized private-preview snapshot", async (t) => {
  const { server, origin } = await openTestServer();
  t.after(() => server.close());

  const created = await (await postJson(origin, "/api/rooms", {
    audience: "group",
    cardsPerLevel: 4,
    mode: "competitive"
  })).json();
  const guest = await (await postJson(origin, "/api/rooms/ROOM7/join", { name: "Lee" })).json();
  await postJson(origin, "/api/rooms/ROOM7/join", { name: "Ren" });
  await postJson(origin, "/api/rooms/ROOM7/actions", {
    action: "start_match",
    participantToken: created.participantToken
  });
  await postJson(origin, "/api/rooms/ROOM7/actions", {
    action: "choose_level",
    levelId: "reflection",
    participantToken: created.participantToken
  });

  const controller = new AbortController();
  const response = await fetch(
    `${origin}/api/rooms/ROOM7/events?participantToken=${guest.participantToken}`,
    { signal: controller.signal }
  );
  const { value } = await response.body.getReader().read();
  controller.abort();
  const eventBody = new TextDecoder().decode(value);

  assert.match(eventBody, /event: room/);
  assert.match(eventBody, /"phase":"preview_card"/);
  assert.doesNotMatch(eventBody, /"prompt":/);
});
