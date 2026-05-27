import { randomBytes, randomUUID } from "node:crypto";
import { advance, continueLevel, createSession, reveal } from "../game-engine.js";
import {
  adaptiveView,
  addAdaptiveLobbyPlayer,
  canHostSkipAdaptive,
  createAdaptiveMatch,
  isAdaptiveMode,
  normalizeAdaptiveMode,
  performAdaptiveAction,
  setAdaptivePresence
} from "../adaptive-engine.js";

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

  function adaptiveRoom(room) {
    return isAdaptiveMode(room.mode);
  }

  function publicRoom(room, participantToken) {
    if (adaptiveRoom(room)) {
      const member = memberByToken(room, participantToken);
      const view = adaptiveView(room.session, member.id, {
        canSkip: canHostSkipAdaptive(room.session, member.id)
      });
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
    if (adaptiveRoom(room)) {
      room.listeners.forEach((entry) => entry.listener(publicRoom(room, entry.participantToken)));
      return;
    }
    const snapshot = publicRoom(room);
    room.listeners.forEach((listener) => listener(snapshot));
  }

  function createRoom({ audience, playerNames = "", cardsPerLevel = 6, hostName = "", mode = "conversation" }) {
    const normalizedMode = normalizeAdaptiveMode(mode);
    if (normalizedMode !== "conversation" && !isAdaptiveMode(normalizedMode)) {
      const error = new Error("Invalid room mode");
      error.statusCode = 400;
      throw error;
    }
    if (normalizedMode === "conversation" &&
      (!["couple", "friends", "group"].includes(audience) || ![4, 6, 8].includes(Number(cardsPerLevel)))) {
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

    if (isAdaptiveMode(normalizedMode)) {
      const participantToken = createToken();
      const room = {
        code,
        mode: normalizedMode,
        hostToken,
        members: [{ id: host.id, participantToken }],
        session: createAdaptiveMatch({ mode: normalizedMode, participants: [host], random }),
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
      mode: normalizedMode,
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
    if (adaptiveRoom(room)) {
      if (room.session.status !== "lobby") {
        const error = new Error("This experience has already started");
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
      room.session = addAdaptiveLobbyPlayer(room.session, participant);
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

    if (adaptiveRoom(room)) {
      const member = memberByToken(room, credential);
      room.session = performAdaptiveAction(room.session, member.id, action, {
        ...payload,
        canSkip: action === "skip_stalled_turn" && canHostSkipAdaptive(room.session, member.id)
      }, random);
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
      room.session = setAdaptivePresence(room.session, member.id, true);
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
        room.session = setAdaptivePresence(room.session, member.id, false);
        broadcast(room);
      }
      room.disconnectTimers.delete(member.id);
    }, disconnectGraceMs);
    timer.unref?.();
    room.disconnectTimers.set(member.id, timer);
  }

  function subscribe(code, participantToken, listener) {
    const room = requireRoom(code);
    if (adaptiveRoom(room)) {
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
