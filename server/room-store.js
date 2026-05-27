import { randomBytes, randomUUID } from "node:crypto";
import { advance, continueLevel, createSession, reveal } from "../game-engine.js";
import {
  addLobbyPlayer,
  competitiveView,
  createCompetitiveMatch,
  performCompetitiveAction,
  setCompetitivePresence
} from "../competitive-engine.js";

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function defaultCode() {
  const bytes = randomBytes(5);
  return Array.from(bytes, (byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join("");
}

function normalizeCode(code) {
  return String(code || "").replace(/\s+/g, "").toUpperCase();
}

function normalizeName(name, fallback) {
  const cleaned = String(name || "").trim().slice(0, 28);
  return cleaned || fallback;
}

function forbidden(message) {
  const error = new Error(message);
  error.statusCode = 403;
  throw error;
}

export function createRoomStore({
  createCode = defaultCode,
  createToken = randomUUID,
  random = Math.random,
  now = () => new Date().toISOString(),
  disconnectGraceMs = 10_000
} = {}) {
  const rooms = new Map();

  function requireRoom(code) {
    const room = rooms.get(normalizeCode(code));
    if (!room) {
      const error = new Error("Room not found");
      error.statusCode = 404;
      throw error;
    }
    return room;
  }

  function memberByToken(room, participantToken) {
    const member = room.members?.find((item) => item.participantToken === participantToken);
    if (!member) {
      forbidden("Participant access is required for this room");
    }
    return member;
  }

  function stalledForHost(room, viewerId) {
    if (room.mode !== "competitive") {
      return false;
    }
    const viewer = room.session.players.find((item) => item.id === viewerId);
    if (viewer?.role !== "host" || room.session.status !== "playing") {
      return false;
    }
    const active = room.session.players.find((item) => item.id === room.session.activePlayerId);
    const target = room.session.players.find((item) => item.id === room.session.targetPlayerId);
    const noEligibleTarget = ["preview_card", "replacement_preview"].includes(room.session.phase) &&
      !room.session.players.some((item) =>
        item.connected &&
        item.id !== room.session.activePlayerId &&
        item.id !== room.session.currentChallenge?.excludedTargetId
      );
    return active?.connected === false ||
      (room.session.phase === "await_response" && target?.connected === false) ||
      noEligibleTarget;
  }

  function publicRoom(room, participantToken) {
    if (room.mode === "competitive") {
      const member = memberByToken(room, participantToken);
      const view = competitiveView(room.session, member.id, { canSkip: stalledForHost(room, member.id) });
      return {
        code: room.code,
        mode: room.mode,
        participants: view.players.map(({ id, name, role, connected }) => ({ id, name, role, connected })),
        session: view,
        viewerId: member.id,
        createdAt: room.createdAt
      };
    }

    return {
      code: room.code,
      mode: room.mode,
      participants: room.participants.map(({ id, name, role }) => ({ id, name, role })),
      session: room.session,
      createdAt: room.createdAt
    };
  }

  function broadcast(room) {
    if (room.mode === "competitive") {
      room.listeners.forEach((entry) => entry.listener(publicRoom(room, entry.participantToken)));
      return;
    }
    const snapshot = publicRoom(room);
    room.listeners.forEach((listener) => listener(snapshot));
  }

  function createRoom({ audience, playerNames = "", cardsPerLevel = 6, hostName = "", mode = "conversation" }) {
    if (!["conversation", "competitive"].includes(mode)) {
      const error = new Error("Invalid room mode");
      error.statusCode = 400;
      throw error;
    }
    if (!["couple", "friends", "group"].includes(audience) || ![4, 6, 8].includes(Number(cardsPerLevel))) {
      const error = new Error("Invalid game settings");
      error.statusCode = 400;
      throw error;
    }
    let code = normalizeCode(createCode());
    while (rooms.has(code)) {
      code = normalizeCode(createCode());
    }

    const hostToken = createToken();
    const host = {
      id: createToken(),
      name: normalizeName(hostName, "Host"),
      role: "host"
    };

    if (mode === "competitive") {
      const participantToken = createToken();
      const room = {
        code,
        mode,
        hostToken,
        members: [{ id: host.id, participantToken }],
        session: createCompetitiveMatch({ participants: [host], audience, random }),
        createdAt: now(),
        listeners: new Set(),
        disconnectTimers: new Map(),
        connectionCounts: new Map()
      };
      rooms.set(code, room);
      return {
        room: publicRoom(room, participantToken),
        hostToken,
        participantId: host.id,
        participantToken
      };
    }

    const room = {
      code,
      mode,
      hostToken,
      participants: [host],
      session: createSession({ audience, playerNames, cardsPerLevel: Number(cardsPerLevel), random }),
      createdAt: now(),
      listeners: new Set()
    };
    rooms.set(code, room);
    return { room: publicRoom(room), hostToken, participantId: host.id };
  }

  function joinRoom(code, name) {
    const room = requireRoom(code);
    if (room.mode === "competitive") {
      if (room.session.status !== "lobby") {
        const error = new Error("This Points Mode match has already started");
        error.statusCode = 409;
        throw error;
      }
      const participantToken = createToken();
      const participant = {
        id: createToken(),
        name: normalizeName(name, `Guest ${room.session.players.length}`),
        role: "player"
      };
      room.members.push({ id: participant.id, participantToken });
      room.session = addLobbyPlayer(room.session, participant);
      broadcast(room);
      return {
        room: publicRoom(room, participantToken),
        participantId: participant.id,
        participantToken
      };
    }

    const participant = {
      id: createToken(),
      name: normalizeName(name, `Guest ${room.participants.length}`),
      role: "player"
    };
    room.participants.push(participant);
    broadcast(room);
    return { room: publicRoom(room), participantId: participant.id };
  }

  function getRoom(code, participantToken) {
    const room = requireRoom(code);
    return publicRoom(room, participantToken);
  }

  function act(code, credential, action, payload = {}) {
    const room = requireRoom(code);

    if (room.mode === "competitive") {
      const member = memberByToken(room, credential);
      room.session = performCompetitiveAction(room.session, member.id, action, {
        ...payload,
        canSkip: action === "skip_stalled_turn" && stalledForHost(room, member.id)
      });
      broadcast(room);
      return publicRoom(room, credential);
    }

    if (credential !== room.hostToken) {
      forbidden("Only the host can control the deck");
    }
    if (action === "reveal") {
      room.session = reveal(room.session);
    } else if (action === "advance") {
      room.session = advance(room.session);
    } else if (action === "continue") {
      room.session = continueLevel(room.session);
    } else {
      const error = new Error("Unsupported room action");
      error.statusCode = 400;
      throw error;
    }
    broadcast(room);
    return publicRoom(room);
  }

  function connectParticipant(room, member) {
    const timer = room.disconnectTimers.get(member.id);
    if (timer) {
      clearTimeout(timer);
      room.disconnectTimers.delete(member.id);
    }
    const count = (room.connectionCounts.get(member.id) || 0) + 1;
    room.connectionCounts.set(member.id, count);
    if (room.session.players.find((item) => item.id === member.id)?.connected === false) {
      room.session = setCompetitivePresence(room.session, member.id, true);
      broadcast(room);
    }
  }

  function disconnectParticipant(room, member) {
    const count = Math.max(0, (room.connectionCounts.get(member.id) || 1) - 1);
    room.connectionCounts.set(member.id, count);
    if (count !== 0) {
      return;
    }
    const timer = setTimeout(() => {
      if ((room.connectionCounts.get(member.id) || 0) === 0) {
        room.session = setCompetitivePresence(room.session, member.id, false);
        broadcast(room);
      }
      room.disconnectTimers.delete(member.id);
    }, disconnectGraceMs);
    timer.unref?.();
    room.disconnectTimers.set(member.id, timer);
  }

  function subscribe(code, participantToken, listener) {
    const room = requireRoom(code);
    if (room.mode === "competitive") {
      const member = memberByToken(room, participantToken);
      const entry = { participantToken, listener };
      room.listeners.add(entry);
      connectParticipant(room, member);
      listener(publicRoom(room, participantToken));
      return () => {
        room.listeners.delete(entry);
        disconnectParticipant(room, member);
      };
    }

    const callback = typeof participantToken === "function" ? participantToken : listener;
    room.listeners.add(callback);
    callback(publicRoom(room));
    return () => room.listeners.delete(callback);
  }

  return { act, createRoom, getRoom, joinRoom, subscribe };
}
