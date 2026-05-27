import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  advance,
  continueLevel,
  createSession,
  currentCard,
  currentLevel,
  currentPosition,
  reveal,
  totalCards
} from "../game-engine.js";
import { LEVELS, promptById } from "../data/prompts.js";
import { LEVEL_POINTS } from "../adaptive-engine.js";
import type {
  ActiveRoom,
  AdaptiveMode,
  AdaptivePlayer,
  AdaptiveSession,
  Audience,
  ConversationSession,
  Level,
  PlayMode,
  Prompt,
  RoomConnection,
  RoomMode,
  RoomSnapshot,
  ScreenName
} from "./types";

const SESSION_KEY = "open-thread.session";
const ROOM_KEY = "open-thread.room";
const SAVED_KEY = "open-thread.saved";
const ADAPTIVE_MODES = ["date_night", "inner_circle", "icebreaker", "competitive"];
const levels = LEVELS as Level[];
const points = LEVEL_POINTS as Record<string, number>;

function loadJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function isAdaptiveRoom(room: ActiveRoom | null): boolean {
  return Boolean(room && ADAPTIVE_MODES.includes(room.mode));
}

function normalizeExperience(mode?: string): RoomMode {
  return mode === "competitive" ? "inner_circle" : (mode as RoomMode) || "conversation";
}

function experienceLabel(mode?: string): string {
  return {
    date_night: "Date Night",
    inner_circle: "Inner Circle",
    competitive: "Inner Circle",
    icebreaker: "Icebreaker"
  }[mode || ""] || "Conversation";
}

function audienceLabel(audience: Audience): string {
  return { couple: "two people", friends: "friends", group: "a group" }[audience];
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error || "Room request failed");
  }
  return body;
}

export function App() {
  const invitedCode = new URLSearchParams(window.location.search).get("room")?.toUpperCase().slice(0, 5) || "";
  const [session, setSession] = useState<ConversationSession | AdaptiveSession | null>(() =>
    loadJson<ConversationSession>(SESSION_KEY));
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(() => loadJson<ActiveRoom>(ROOM_KEY));
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>(() => loadJson<string[]>(SAVED_KEY) ?? []);
  const [screen, setScreen] = useState<ScreenName>("setup");
  const [previousScreen, setPreviousScreen] = useState<ScreenName>("setup");
  const [playMode, setPlayMode] = useState<PlayMode>(invitedCode ? "join" : "local");
  const [roomMode, setRoomMode] = useState<RoomMode>("conversation");
  const [audience, setAudience] = useState<Audience>("couple");
  const [playerNames, setPlayerNames] = useState("");
  const [hostName, setHostName] = useState("");
  const [cardsPerLevel, setCardsPerLevel] = useState(6);
  const [agreement, setAgreement] = useState(false);
  const [joinCode, setJoinCode] = useState(invitedCode);
  const [joinName, setJoinName] = useState("");
  const [joinAgreement, setJoinAgreement] = useState(false);
  const [toast, setToast] = useState("");
  const [pending, setPending] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const spinningRef = useRef(false);
  const deferredSpinRef = useRef<RoomSnapshot | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const adaptive = isAdaptiveRoom(activeRoom) && session && "mode" in session
    ? session as AdaptiveSession
    : null;
  const conversation = !adaptive && session ? session as ConversationSession : null;
  const host = !activeRoom || activeRoom.role === "host";

  useEffect(() => {
    const theme = adaptive?.mode ||
      (screen === "setup" && playMode === "host" ? normalizeExperience(roomMode) : "conversation");
    document.body.dataset.experience = theme;
  }, [adaptive?.mode, playMode, roomMode, screen]);

  useEffect(() => {
    if (session && !activeRoom && !("mode" in session)) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
    if (activeRoom) {
      localStorage.setItem(ROOM_KEY, JSON.stringify(activeRoom));
    } else {
      localStorage.removeItem(ROOM_KEY);
    }
    localStorage.setItem(SAVED_KEY, JSON.stringify(savedIds));
  }, [activeRoom, savedIds, session]);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!activeRoom) {
      sourceRef.current?.close();
      sourceRef.current = null;
      return;
    }
    let cancelled = false;
    const query = isAdaptiveRoom(activeRoom)
      ? `?participantToken=${encodeURIComponent(activeRoom.participantToken || "")}`
      : "";
    const acceptSnapshot = (room: RoomSnapshot) => {
      if (spinningRef.current && (room.session as AdaptiveSession)?.phase === "await_response") {
        deferredSpinRef.current = room;
        return;
      }
      setSnapshot(room);
      setSession(room.session);
    };
    void requestJson<RoomSnapshot>(`/api/rooms/${activeRoom.code}${query}`)
      .then((room) => {
        if (!cancelled) {
          acceptSnapshot(room);
        }
      })
      .catch(() => {
        if (!cancelled) {
          leaveRoom();
          notice("That room is no longer active");
        }
      });
    const source = new EventSource(`/api/rooms/${activeRoom.code}/events${query}`);
    sourceRef.current = source;
    source.addEventListener("room", (event) => {
      if (!cancelled) {
        acceptSnapshot(JSON.parse((event as MessageEvent).data) as RoomSnapshot);
      }
    });
    source.onerror = () => {
      if (!cancelled) {
        notice("Reconnecting to live room...");
      }
    };
    return () => {
      cancelled = true;
      source.close();
      if (sourceRef.current === source) {
        sourceRef.current = null;
      }
    };
  // Connect only when room identity changes; current snapshots arrive through the stream.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom?.code, activeRoom?.participantToken]);

  useEffect(() => {
    if (!activeRoom || adaptive || !conversation || !["game", "transition", "results"].includes(screen)) {
      return;
    }
    const expected = conversation.completed ? "results" : conversation.betweenLevels ? "transition" : "game";
    if (screen !== expected) {
      setScreen(expected);
    }
  }, [activeRoom, adaptive, conversation, screen]);

  function notice(message: string) {
    setToast(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(""), 2500);
  }

  function openCurrentSession(nextSession: ConversationSession | AdaptiveSession | null = session) {
    if (!nextSession) {
      setScreen("setup");
    } else if ("mode" in nextSession) {
      setScreen("adaptive");
    } else if (nextSession.completed) {
      setScreen("results");
    } else if (nextSession.betweenLevels) {
      setScreen("transition");
    } else {
      setScreen("game");
    }
  }

  function goTo(next: ScreenName) {
    if (next !== "library") {
      setPreviousScreen(next);
    }
    setScreen(next);
    window.scrollTo(0, 0);
  }

  function enterRoom(connection: RoomConnection, role: "host" | "player") {
    const room: ActiveRoom = {
      code: connection.room.code,
      mode: connection.room.mode || "conversation",
      participantId: connection.participantId,
      role,
      ...(connection.hostToken ? { hostToken: connection.hostToken } : {}),
      ...(connection.participantToken ? { participantToken: connection.participantToken } : {})
    };
    setActiveRoom(room);
    setSnapshot(connection.room);
    setSession(connection.room.session);
    setScreen(isAdaptiveRoom(room) ? "adaptive" : "game");
  }

  function leaveRoom() {
    sourceRef.current?.close();
    sourceRef.current = null;
    setActiveRoom(null);
    setSnapshot(null);
    setSession(null);
  }

  async function handleSetupSubmit(event: FormEvent) {
    event.preventDefault();
    const options = { audience, playerNames, cardsPerLevel };
    if (playMode === "host") {
      try {
        const connection = await requestJson<RoomConnection>("/api/rooms", {
          method: "POST",
          body: JSON.stringify({ ...options, mode: roomMode, hostName })
        });
        enterRoom(connection, "host");
        notice(roomMode === "conversation"
          ? `Room ${connection.room.code} is live`
          : `${experienceLabel(roomMode)} room ${connection.room.code} is open`);
      } catch (error) {
        notice((error as Error).message);
      }
      return;
    }
    leaveRoom();
    const next = createSession(options) as ConversationSession;
    setSession(next);
    setScreen("game");
  }

  async function handleJoinSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const code = joinCode.replace(/\s+/g, "").toUpperCase();
      const connection = await requestJson<RoomConnection>(`/api/rooms/${code}/join`, {
        method: "POST",
        body: JSON.stringify({ name: joinName })
      });
      enterRoom(connection, "player");
      notice(`Joined room ${connection.room.code}`);
    } catch (error) {
      notice((error as Error).message);
    }
  }

  async function sendRoomAction(action: string, payload: Record<string, unknown> = {}) {
    if (!activeRoom || pending || (!isAdaptiveRoom(activeRoom) && !host)) {
      return;
    }
    const spin = action === "spin_target";
    setPending(true);
    if (spin) {
      spinningRef.current = true;
      setSpinning(true);
    }
    try {
      const authorization = isAdaptiveRoom(activeRoom)
        ? { participantToken: activeRoom.participantToken }
        : { hostToken: activeRoom.hostToken };
      const request = requestJson<RoomSnapshot>(`/api/rooms/${activeRoom.code}/actions`, {
        method: "POST",
        body: JSON.stringify({ action, ...authorization, ...payload })
      });
      const response = spin
        ? (await Promise.all([request, new Promise((resolve) => window.setTimeout(resolve, 480))]))[0]
        : await request;
      if (spin) {
        spinningRef.current = false;
        setSpinning(false);
      }
      const next = deferredSpinRef.current || response;
      deferredSpinRef.current = null;
      setSnapshot(next);
      setSession(next.session);
    } catch (error) {
      notice((error as Error).message);
    } finally {
      spinningRef.current = false;
      deferredSpinRef.current = null;
      setSpinning(false);
      setPending(false);
    }
  }

  function toggleSaved(id: string) {
    setSavedIds((current) => {
      const removing = current.includes(id);
      notice(removing ? "Removed from saved cards" : "Saved for later");
      return removing ? current.filter((savedId) => savedId !== id) : [id, ...current];
    });
  }

  async function copyInvite() {
    if (!activeRoom) {
      return;
    }
    const label = experienceLabel(activeRoom.mode);
    const inviteUrl = `${window.location.origin}/?room=${activeRoom.code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${label} on Open Thread`,
          text: `Join my ${label} room: ${activeRoom.code}`,
          url: inviteUrl
        });
        notice("Invite shared");
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
      }
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      notice("Invite link copied");
    } catch {
      notice(`Invite code: ${activeRoom.code}`);
    }
  }

  async function install() {
    if (!installPrompt) {
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  const resumeText = useMemo(() => {
    if (!session) return "";
    if (adaptive && activeRoom) {
      const state = adaptive.status === "lobby" ? "waiting in the lobby" :
        adaptive.status === "finished" ? "ready to review results" :
          `playing turn ${adaptive.turnNumber}`;
      return `${experienceLabel(activeRoom.mode)} room ${activeRoom.code} is ${state}.`;
    }
    if (conversation && activeRoom) {
      const role = activeRoom.role === "host" ? "Hosting" : "Joined";
      return `${role} room ${activeRoom.code}: card ${currentPosition(conversation)} of ${totalCards(conversation)} is waiting.`;
    }
    if (conversation) {
      const name = conversation.playerNames || audienceLabel(conversation.audience);
      return `${name}: card ${currentPosition(conversation)} of ${totalCards(conversation)} is waiting.`;
    }
    return "";
  }, [activeRoom, adaptive, conversation, session]);

  return (
    <>
      <main className="app">
        <Header
          installAvailable={Boolean(installPrompt)}
          savedCount={savedIds.length}
          onHome={() => goTo("setup")}
          onInstall={() => void install()}
          onLibrary={() => goTo("library")}
        />
        {screen === "setup" && (
          <SetupScreen
            sessionActive={Boolean(session)}
            resumeText={resumeText}
            playMode={playMode}
            roomMode={roomMode}
            audience={audience}
            playerNames={playerNames}
            hostName={hostName}
            cardsPerLevel={cardsPerLevel}
            agreement={agreement}
            joinCode={joinCode}
            joinName={joinName}
            joinAgreement={joinAgreement}
            onPlayMode={setPlayMode}
            onRoomMode={setRoomMode}
            onAudience={setAudience}
            onPlayerNames={setPlayerNames}
            onHostName={setHostName}
            onCardsPerLevel={setCardsPerLevel}
            onAgreement={setAgreement}
            onJoinCode={setJoinCode}
            onJoinName={setJoinName}
            onJoinAgreement={setJoinAgreement}
            onResume={() => openCurrentSession()}
            onDiscard={() => { leaveRoom(); setSession(null); }}
            onSubmit={(event) => void handleSetupSubmit(event)}
            onJoin={(event) => void handleJoinSubmit(event)}
          />
        )}
        {screen === "adaptive" && adaptive && snapshot && (
          <AdaptiveRoomScreen
            session={adaptive}
            snapshot={snapshot as RoomSnapshot<AdaptiveSession>}
            savedIds={savedIds}
            pending={pending}
            spinning={spinning}
            onInvite={() => void copyInvite()}
            onAction={(action, payload) => void sendRoomAction(action, payload)}
            onSave={toggleSaved}
            onLeave={() => { leaveRoom(); goTo("setup"); }}
          />
        )}
        {screen === "game" && conversation && (
          <ConversationGame
            session={conversation}
            snapshot={snapshot as RoomSnapshot<ConversationSession> | null}
            activeRoom={activeRoom}
            host={host}
            pending={pending}
            savedIds={savedIds}
            onInvite={() => void copyInvite()}
            onReveal={() => {
              if (activeRoom) void sendRoomAction("reveal");
              else setSession(reveal(conversation) as ConversationSession);
            }}
            onAdvance={() => {
              if (activeRoom) void sendRoomAction("advance");
              else {
                const next = advance(conversation) as ConversationSession;
                setSession(next);
                openCurrentSession(next);
              }
            }}
            onSave={toggleSaved}
          />
        )}
        {screen === "transition" && conversation && (
          <ConversationTransition
            session={conversation}
            roomCode={activeRoom ? snapshot?.code : undefined}
            host={host}
            pending={pending}
            onContinue={() => {
              if (activeRoom) void sendRoomAction("continue");
              else {
                const next = continueLevel(conversation) as ConversationSession;
                setSession(next);
                openCurrentSession(next);
              }
            }}
          />
        )}
        {screen === "results" && conversation && (
          <ConversationResults
            session={conversation}
            roomCode={activeRoom ? snapshot?.code : undefined}
            onNew={() => { leaveRoom(); setSession(null); goTo("setup"); }}
            onReview={() => goTo("library")}
          />
        )}
        {screen === "library" && (
          <LibraryScreen
            savedIds={savedIds}
            onClose={() => setScreen(previousScreen)}
            onRemove={toggleSaved}
            onClear={() => { setSavedIds([]); notice("Saved cards cleared"); }}
          />
        )}
      </main>
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<unknown>;
}

function Header({
  installAvailable,
  savedCount,
  onHome,
  onInstall,
  onLibrary
}: {
  installAvailable: boolean;
  savedCount: number;
  onHome: () => void;
  onInstall: () => void;
  onLibrary: () => void;
}) {
  return (
    <header className="topbar">
      <button className="brand" aria-label="Return to setup" onClick={onHome}>
        <span className="brand-mark" aria-hidden="true" />
        <span>Open Thread</span>
      </button>
      <div className="topbar-actions">
        {installAvailable && <button className="ghost-button install-button" onClick={onInstall}>Install</button>}
        <button className="ghost-button" aria-label="Open saved cards" onClick={onLibrary}>
          Saved <span className="saved-count">{savedCount}</span>
        </button>
      </div>
    </header>
  );
}

function SetupScreen(props: {
  sessionActive: boolean;
  resumeText: string;
  playMode: PlayMode;
  roomMode: RoomMode;
  audience: Audience;
  playerNames: string;
  hostName: string;
  cardsPerLevel: number;
  agreement: boolean;
  joinCode: string;
  joinName: string;
  joinAgreement: boolean;
  onPlayMode: (value: PlayMode) => void;
  onRoomMode: (value: RoomMode) => void;
  onAudience: (value: Audience) => void;
  onPlayerNames: (value: string) => void;
  onHostName: (value: string) => void;
  onCardsPerLevel: (value: number) => void;
  onAgreement: (value: boolean) => void;
  onJoinCode: (value: string) => void;
  onJoinName: (value: string) => void;
  onJoinAgreement: (value: boolean) => void;
  onResume: () => void;
  onDiscard: () => void;
  onSubmit: (event: FormEvent) => void;
  onJoin: (event: FormEvent) => void;
}) {
  const adaptive = props.playMode === "host" && props.roomMode !== "conversation";
  const helper = {
    conversation: "Everyone follows one shared deck. No scores, only space to answer or pass.",
    date_night: "Work together toward a shared milestone, then choose a closing moment.",
    inner_circle: "Private draws and points stay playful through balanced target cooldowns.",
    icebreaker: "A fair spin chooses responders while everyone builds group progress."
  }[props.roomMode];
  const startText = adaptive
    ? `Create ${experienceLabel(props.roomMode)} room`
    : props.playMode === "host" ? "Create live room" : "Start the conversation";
  return (
    <section className="screen setup-screen" aria-labelledby="welcome-title">
      <p className="eyebrow">Conversation card game</p>
      <h1 id="welcome-title">Get closer, one honest question at a time.</h1>
      <p className="lede">Play from one phone or create a room so every player can follow along on their own screen across three levels.</p>
      {props.sessionActive && (
        <div className="resume-card">
          <p className="eyebrow">Session in progress</p>
          <p>{props.resumeText}</p>
          <div className="button-row">
            <button className="primary-button" onClick={props.onResume}>Resume game</button>
            <button className="text-button" onClick={props.onDiscard}>Start over</button>
          </div>
        </div>
      )}
      <fieldset className="play-mode">
        <legend>How are you playing?</legend>
        <div className="mode-grid">
          {([["local", "One phone"], ["host", "Host room"], ["join", "Join room"]] as const).map(([value, label]) => (
            <label className="mode-choice" key={value}>
              <input type="radio" name="playMode" checked={props.playMode === value} onChange={() => props.onPlayMode(value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {props.playMode !== "join" ? (
        <form className="setup-form" onSubmit={props.onSubmit}>
          {!adaptive && (
            <fieldset>
              <legend>Who is playing?</legend>
              <div className="choice-grid">
                {([["couple", "Two people", "Dates or partners"], ["friends", "Friends", "New or longtime"], ["group", "Group", "Three or more"]] as const).map(([value, title, copy]) => (
                  <label className="choice" key={value}>
                    <input type="radio" checked={props.audience === value} onChange={() => props.onAudience(value)} />
                    <span className="choice-title">{title}</span>
                    <span className="choice-copy">{copy}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <label className="field">
            <span>Names or table name <small>(optional)</small></span>
            <input value={props.playerNames} onChange={(event) => props.onPlayerNames(event.target.value)} maxLength={42} placeholder="Maya + Jordan" />
          </label>
          {props.playMode === "host" && (
            <label className="field">
              <span>Your name <small>(shown in the room)</small></span>
              <input value={props.hostName} onChange={(event) => props.onHostName(event.target.value)} maxLength={28} placeholder="Maya" />
            </label>
          )}
          {props.playMode === "host" && (
            <fieldset>
              <legend>Choose an experience</legend>
              <div className="rule-grid">
                {([
                  ["conversation", "Any group | Unscored", "Conversation", "A gentle shared deck for open conversation."],
                  ["date_night", "2 players | Shared goal", "Date Night", "Build a connection milestone together."],
                  ["inner_circle", "3-6 friends | Points", "Inner Circle", "Playfully compete with balanced targeting."],
                  ["icebreaker", "3-6 players | Shared goal", "Icebreaker", "Meet the room through fair roulette."]
                ] as const).map(([value, meta, title, copy]) => (
                  <label className="rule-choice" key={value}>
                    <input type="radio" checked={props.roomMode === value} onChange={() => props.onRoomMode(value)} />
                    <span className="rule-meta">{meta}</span>
                    <span className="choice-title">{title}</span>
                    <span className="choice-copy">{copy}</span>
                  </label>
                ))}
              </div>
              <p className="experience-helper">{helper}</p>
            </fieldset>
          )}
          {!adaptive && (
            <label className="field">
              <span>Cards per level</span>
              <select value={props.cardsPerLevel} onChange={(event) => props.onCardsPerLevel(Number(event.target.value))}>
                <option value={4}>Quick round - 12 cards</option>
                <option value={6}>Full round - 18 cards</option>
                <option value={8}>Long round - 24 cards</option>
              </select>
            </label>
          )}
          <label className="agreement">
            <input type="checkbox" required checked={props.agreement} onChange={(event) => props.onAgreement(event.target.checked)} />
            <span>We agree anyone can pass on a card, without explaining why.</span>
          </label>
          <button className="primary-button start-button" type="submit">{startText}</button>
        </form>
      ) : (
        <form className="setup-form join-form" onSubmit={props.onJoin}>
          <label className="field">
            <span>Room code</span>
            <input value={props.joinCode} onChange={(event) => props.onJoinCode(event.target.value)} maxLength={5} placeholder="AB123" required />
          </label>
          <label className="field">
            <span>Your name <small>(optional)</small></span>
            <input value={props.joinName} onChange={(event) => props.onJoinName(event.target.value)} maxLength={28} placeholder="Jordan" />
          </label>
          <label className="agreement">
            <input type="checkbox" required checked={props.joinAgreement} onChange={(event) => props.onJoinAgreement(event.target.checked)} />
            <span>I agree anyone can pass on a card, without explaining why.</span>
          </label>
          <button className="primary-button start-button" type="submit">Join conversation</button>
        </form>
      )}
    </section>
  );
}

function AdaptiveRoomScreen({
  session,
  snapshot,
  savedIds,
  pending,
  spinning,
  onInvite,
  onAction,
  onSave,
  onLeave
}: {
  session: AdaptiveSession;
  snapshot: RoomSnapshot<AdaptiveSession>;
  savedIds: string[];
  pending: boolean;
  spinning: boolean;
  onInvite: () => void;
  onAction: (action: string, payload?: Record<string, unknown>) => void;
  onSave: (id: string) => void;
  onLeave: () => void;
}) {
  const hasAction = (action: string) => session.availableActions.includes(action);
  const player = (id?: string | null) => session.players.find((item) => item.id === id);
  const active = player(session.activePlayerId);
  const target = player(session.targetPlayerId);
  const challenge = session.currentChallenge;
  const publicPrompt = session.mode === "inner_circle"
    ? ["await_response", "await_claim"].includes(session.phase)
    : session.phase === "await_response";
  const prompt = challenge?.prompt;
  const waiting = !prompt && (
    session.mode === "icebreaker" && session.phase === "spin_target" ||
    session.mode === "inner_circle" && ["preview_card", "replacement_preview"].includes(session.phase)
  );
  const guidance = adaptiveGuidance(session, active, target, hasAction);

  return (
    <section className="screen points-screen" aria-live="polite">
      <aside className="room-banner">
        <div className="room-heading">
          <div>
            <p className="eyebrow">{experienceLabel(session.mode)}</p>
            <p className="room-code">{snapshot.code}</p>
          </div>
          <button className="ghost-button" onClick={onInvite}>Share invite</button>
        </div>
        <div className="participant-list">
          {session.players.map((participant) => (
            <span className={`participant-chip${participant.connected ? "" : " is-offline"}`} key={participant.id}>
              {participant.name}{participant.role === "host" ? " - host" : ""}{participant.connected ? "" : " - unavailable"}
            </span>
          ))}
        </div>
      </aside>
      {session.status === "lobby" && (
        <AdaptiveLobby session={session} hasAction={hasAction} pending={pending} onAction={onAction} />
      )}
      {session.status === "playing" && active && (
        <div className={`points-match${spinning ? " is-spinning" : ""}`}>
          <div className="points-status">
            <div>
              <p className="eyebrow">Turn {session.turnNumber}</p>
              <h2>{session.mode === "date_night" ? `${active.name} responds` : session.mode === "icebreaker" ? `${active.name} facilitates` : `${active.name}'s turn`}</h2>
            </div>
            <p className="score-target">{session.mode === "date_night" ? "Shared milestone" : session.mode === "icebreaker" ? "Together to 15" : "First to 21"}</p>
          </div>
          {session.mode !== "inner_circle" ? <SharedMeter session={session} /> : <ScorePanel session={session} />}
          <p className="points-guidance">{guidance}</p>
          {hasAction("choose_level") && (
            <LevelPicker session={session} viewer={player(snapshot.viewerId)} pending={pending} onAction={onAction} />
          )}
          {waiting && (
            <div className="waiting-stage">
              <span className="face-down-card" aria-hidden="true" />
              <p className="eyebrow">{session.mode === "icebreaker" ? "Prompt concealed" : "Private preview"}</p>
              <p>{session.mode === "icebreaker"
                ? hasAction("spin_target") ? "Spin when the room is ready. The prompt appears once a responder is chosen." : "The facilitator is spinning for a responder."
                : "The active player is choosing who receives this prompt."}</p>
            </div>
          )}
          {prompt && challenge && (
            <ChallengeCard
              session={session}
              snapshot={snapshot}
              publicPrompt={publicPrompt}
              prompt={prompt}
              challenge={challenge}
              saved={publicPrompt && savedIds.includes(prompt.id)}
              pending={pending}
              onAction={onAction}
            />
          )}
          {session.mode === "date_night" && session.phase === "choose_ending" && (
            <div className="ending-picker">
              <p className="eyebrow">Shared milestone reached</p>
              <h3>How would you like to close tonight?</h3>
              <div className="ending-actions">
                <button className="primary-button" disabled={pending || !hasAction("choose_ending")} onClick={() => onAction("choose_ending", { endingType: "activity" })}>Do Something Together</button>
                <button className="secondary-button" disabled={pending || !hasAction("choose_ending")} onClick={() => onAction("choose_ending", { endingType: "question" })}>One More Meaningful Question</button>
              </div>
            </div>
          )}
          <ActionDock
            actions={session.availableActions}
            prompt={prompt}
            canSave={Boolean(prompt && publicPrompt)}
            saved={Boolean(prompt && savedIds.includes(prompt.id))}
            pending={pending}
            onAction={onAction}
            onSave={() => prompt && onSave(prompt.id)}
          />
        </div>
      )}
      {session.status === "finished" && <AdaptiveResults session={session} onLeave={onLeave} />}
    </section>
  );
}

function AdaptiveLobby({ session, hasAction, pending, onAction }: {
  session: AdaptiveSession;
  hasAction: (action: string) => boolean;
  pending: boolean;
  onAction: (action: string) => void;
}) {
  let title = "An evening for two.";
  let copy = session.players.length === 1
    ? "Waiting for one partner to join this shared Date Night."
    : "Both partners are here. The host can begin when you are comfortable.";
  let action = "Start Date Night";
  if (session.mode !== "date_night") {
    const needed = Math.max(0, 3 - session.players.length);
    const group = session.mode === "inner_circle" ? "friends" : "players";
    title = session.mode === "inner_circle" ? "Gather your inner circle." : "Open the room gently.";
    copy = needed > 0
      ? `Waiting for ${needed} more ${group === "friends" ? "friend" : "player"}${needed === 1 ? "" : "s"} before you begin.`
      : `${session.players.length} ${group} are ready. The host can begin when everyone is settled.`;
    action = session.mode === "inner_circle" ? "Start Inner Circle" : "Start Icebreaker";
  }
  return (
    <div className="points-lobby">
      <p className="eyebrow">Lobby</p>
      <h2>{title}</h2>
      <p className="lede">{copy}</p>
      <p className="safety-note">Passing is always welcome. No explanation needed.</p>
      {hasAction("start_match") && <button className="primary-button" disabled={pending} onClick={() => onAction("start_match")}>{action}</button>}
    </div>
  );
}

function SharedMeter({ session }: { session: AdaptiveSession }) {
  const score = session.mode === "date_night" ? session.connectionScore || 0 : session.groupScore || 0;
  return (
    <div className="shared-meter">
      <div className="meter-copy">
        <span>{session.mode === "date_night" ? "Connection Meter" : "Group progress"}</span>
        <strong>{score} / {session.scoreTarget}</strong>
      </div>
      <div className="meter-track" aria-hidden="true"><span style={{ width: `${Math.min(100, (score / session.scoreTarget) * 100)}%` }} /></div>
      {session.mode === "date_night" && (
        <div className="level-progress">
          {levels.map((level) => <span key={level.id}>{level.name}: {session.completedByLevel?.[level.id] || 0} / 2</span>)}
        </div>
      )}
    </div>
  );
}

function ScorePanel({ session, final = false }: { session: AdaptiveSession; final?: boolean }) {
  return final ? <ScoreRows session={session} final /> : (
    <details className="score-panel">
      <summary>Scoreboard</summary>
      <ScoreRows session={session} />
    </details>
  );
}

function ScoreRows({ session, final = false }: { session: AdaptiveSession; final?: boolean }) {
  const players = final ? [...session.players].sort((left, right) => right.score - left.score) : session.players;
  return (
    <div className={`scoreboard${final ? " final-scoreboard" : ""}`}>
      {players.map((item, index) => (
        <div className={`score-row${item.id === session.activePlayerId && !final ? " is-active" : ""}`} key={item.id}>
          <span className="score-position">{final ? `#${index + 1}` : item.id === session.activePlayerId ? "Turn" : ""}</span>
          <span className="score-name">
            {item.name}
            <span className="score-resources">{item.bailoutAvailable ? "Bailout" : "Bailout used"} | {item.doubleDownAvailable ? "Double Down" : "Double Down used"}</span>
          </span>
          <span className="score-points">{item.score} pt{item.score === 1 ? "" : "s"}</span>
        </div>
      ))}
    </div>
  );
}

function LevelPicker({ session, viewer, pending, onAction }: {
  session: AdaptiveSession;
  viewer?: AdaptivePlayer;
  pending: boolean;
  onAction: (action: string, payload?: Record<string, unknown>) => void;
}) {
  const [doubleDown, setDoubleDown] = useState(false);
  const mayWager = session.mode === "inner_circle" && Boolean(viewer?.doubleDownAvailable);
  return (
    <div className="level-picker">
      <p className="eyebrow">Choose a challenge</p>
      <div className="level-actions">
        {levels.filter((level) => Object.hasOwn(session.remainingByLevel, level.id)).map((level) => (
          <button className="level-button" key={level.id} disabled={!session.remainingByLevel[level.id] || pending} onClick={() => onAction("choose_level", { levelId: level.id, doubleDown: mayWager && doubleDown })}>
            <strong>{points[level.id]}</strong>
            <span>{level.name}<br />{session.remainingByLevel[level.id]} left</span>
          </button>
        ))}
      </div>
      {mayWager && (
        <label className="double-down">
          <input type="checkbox" checked={doubleDown} onChange={(event) => setDoubleDown(event.target.checked)} />
          <span><strong>Double Down</strong> - double their reward; lose the card&apos;s base value if they complete it.</span>
        </label>
      )}
    </div>
  );
}

function ChallengeCard({ session, snapshot, publicPrompt, prompt, challenge, saved, pending, onAction }: {
  session: AdaptiveSession;
  snapshot: RoomSnapshot<AdaptiveSession>;
  publicPrompt: boolean;
  prompt: Prompt;
  challenge: NonNullable<AdaptiveSession["currentChallenge"]>;
  saved: boolean;
  pending: boolean;
  onAction: (action: string, payload?: Record<string, unknown>) => void;
}) {
  const level = levels.find((item) => item.id === challenge.levelId);
  const value = challenge.doubled && !challenge.claimant ? challenge.basePoints * 2 : challenge.basePoints;
  const targets = session.players.filter((item) =>
    item.id !== snapshot.viewerId && item.connected && item.id !== challenge.excludedTargetId);
  return (
    <article className="points-card">
      <div className="card-meta">
        <p className="eyebrow">{level?.name} - {value} point{value === 1 ? "" : "s"}{challenge.doubled ? " - Double Down" : ""}</p>
        <p className="visibility-label">{!publicPrompt ? "Only visible on your phone" : session.mode === "date_night" ? "Visible to both partners" : "Visible to the room"}</p>
      </div>
      <p className="points-question">{prompt.text}</p>
      {session.mode === "inner_circle" && session.availableActions.includes("target_player") && (
        <div className="target-picker">
          <p>Prompts are spread around the group. Cooling down players return in the next cycle.</p>
          <div className="target-actions">
            {targets.map((item) => {
              const allowed = session.targetablePlayerIds?.includes(item.id) || false;
              return (
                <button className={`target-button${allowed ? "" : " is-cooling"}`} key={item.id} disabled={!allowed || pending} onClick={() => onAction("target_player", { targetPlayerId: item.id })}>
                  {allowed ? item.name : `${item.name} - Cooling down`}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}

function ActionDock({ actions, prompt, canSave, saved, pending, onAction, onSave }: {
  actions: string[];
  prompt?: Prompt;
  canSave: boolean;
  saved: boolean;
  pending: boolean;
  onAction: (action: string) => void;
  onSave: () => void;
}) {
  const controls: Array<[string, string, string]> = [
    ["spin_target", "Spin for responder", "primary-button"],
    ["complete", "Completed", "primary-button"],
    ["pass", "Pass", "secondary-button"],
    ["bailout", "Bailout", "text-button bailout-button"],
    ["claim", "Claim this prompt", "primary-button"],
    ["discard", "Discard", "secondary-button"],
    ["skip_stalled_turn", "Skip stalled turn", "text-button"]
  ];
  if (!controls.some(([action]) => actions.includes(action)) && !canSave) return null;
  return (
    <div className="points-actions action-dock">
      {controls.filter(([action]) => actions.includes(action)).map(([action, label, className]) => (
        <button className={className} key={action} disabled={pending} onClick={() => onAction(action)}>{label}</button>
      ))}
      {canSave && prompt && (
        <button className={`secondary-button${saved ? " is-saved" : ""}`} onClick={onSave}>{saved ? "Saved" : "Save card"}</button>
      )}
    </div>
  );
}

function AdaptiveResults({ session, onLeave }: { session: AdaptiveSession; onLeave: () => void }) {
  let title: string;
  let copy: string;
  if (session.mode === "inner_circle") {
    const winners = (session.winnerIds || []).map((id) => session.players.find((item) => item.id === id)?.name).filter(Boolean).join(" & ");
    title = (session.winnerIds?.length || 0) > 1 ? `${winners} tie.` : `${winners} wins.`;
    copy = session.endReason === "score_target" ? "The first player reached 21 points." : "The prompts are complete. Highest score takes the match.";
  } else if (session.mode === "date_night") {
    title = session.endReason === "milestone" ? "You reached a shared milestone." : "Thank you for meeting each other here.";
    copy = session.endReason === "milestone"
      ? `Together you reached ${session.connectionScore} connection points and explored every depth.`
      : `You reached ${session.connectionScore} connection points before this deck ended.`;
  } else {
    title = session.endReason === "score_target" ? "Your group reached the goal." : "That was a good round.";
    copy = session.endReason === "score_target"
      ? `Together you built ${session.groupScore} points of group connection.`
      : `Your group built ${session.groupScore} points before the available prompts ended.`;
  }
  return (
    <div className="points-results">
      <p className="eyebrow">Experience complete</p>
      <h2>{title}</h2>
      <p className="lede">{copy}</p>
      {session.revealedReward && (
        <article className="reward-card">
          <p className="eyebrow">{session.endingChoice === "activity" ? "Do Something Together" : "One More Meaningful Question"}</p>
          <p>{session.revealedReward.text}</p>
        </article>
      )}
      {session.mode === "inner_circle" && <ScorePanel session={session} final />}
      <button className="primary-button" onClick={onLeave}>Leave room</button>
    </div>
  );
}

function adaptiveGuidance(session: AdaptiveSession, active: AdaptivePlayer | undefined, target: AdaptivePlayer | undefined, hasAction: (action: string) => boolean) {
  if (session.mode === "date_night") {
    if (session.phase === "choose_ending") return "You reached your shared milestone. Either partner can choose how to close tonight.";
    if (session.phase === "choose_level") return hasAction("choose_level") ? "Your turn to answer. Choose a depth that feels right." : `${active?.name} is choosing a prompt to answer.`;
    return hasAction("complete") ? "Share what feels true, then mark Completed. Passing is always welcome." : `${active?.name} is answering this prompt.`;
  }
  if (session.mode === "icebreaker") {
    if (session.phase === "choose_level") return hasAction("choose_level") ? "You are facilitating. Pick a friendly depth for the group." : `${active?.name} is selecting a prompt level.`;
    if (session.phase === "spin_target") return hasAction("spin_target") ? "The prompt is ready. Spin to fairly choose its responder." : `${active?.name} is spinning for a responder.`;
    return hasAction("complete") ? "Answer aloud, then mark Completed, or Pass with no explanation needed." : `${target?.name} is responding for the group.`;
  }
  if (session.phase === "choose_level") return hasAction("choose_level") ? "Your turn. Choose how deep to go and whether to risk your Double Down." : `${active?.name} is choosing a challenge.`;
  if (["preview_card", "replacement_preview"].includes(session.phase)) {
    return hasAction("target_player")
      ? session.phase === "replacement_preview" ? "Bailout respected. Choose a different player for this replacement prompt." : "Only you can see this card. Choose who receives it."
      : `${active?.name} is selecting a player.`;
  }
  if (session.phase === "await_response") {
    if (session.currentChallenge?.claimant) return hasAction("complete") ? "Answer the prompt, then confirm completion to claim its points." : `${active?.name} chose to answer the passed prompt.`;
    return hasAction("complete") ? "Answer aloud, then mark the prompt completed - or pass without explanation." : `${target?.name} is responding.`;
  }
  if (session.phase === "await_claim") return hasAction("claim") ? "The prompt was passed. Answer it yourself for base points or discard it." : `${active?.name} may claim or discard the passed prompt.`;
  return "";
}

function ConversationBanner({ snapshot, host, onInvite }: { snapshot: RoomSnapshot<ConversationSession>; host: boolean; onInvite: () => void }) {
  return (
    <aside className="room-banner">
      <div className="room-heading">
        <div><p className="eyebrow">Live room</p><p className="room-code">{snapshot.code}</p></div>
        <button className="ghost-button" onClick={onInvite}>Share invite</button>
      </div>
      <p className="room-role">{host ? "You control the shared deck. Invite players with this code." : "The host controls the shared deck. Reveals appear here live."}</p>
      <div className="participant-list">{snapshot.participants.map((participant) => <span className="participant-chip" key={participant.id}>{participant.name}{participant.role === "host" ? " - host" : ""}</span>)}</div>
    </aside>
  );
}

function ConversationGame({ session, snapshot, activeRoom, host, pending, savedIds, onInvite, onReveal, onAdvance, onSave }: {
  session: ConversationSession;
  snapshot: RoomSnapshot<ConversationSession> | null;
  activeRoom: ActiveRoom | null;
  host: boolean;
  pending: boolean;
  savedIds: string[];
  onInvite: () => void;
  onReveal: () => void;
  onAdvance: () => void;
  onSave: (id: string) => void;
}) {
  const level = currentLevel(session) as Level;
  const card = currentCard(session) as Prompt;
  const saved = savedIds.includes(card.id);
  return (
    <section className="screen game-screen" aria-live="polite">
      {activeRoom && snapshot && <ConversationBanner snapshot={snapshot} host={host} onInvite={onInvite} />}
      <div className="game-header">
        <div><p className="eyebrow">{level.number}</p><h2>{level.name}</h2></div>
        <p className="progress-copy">{currentPosition(session)} / {totalCards(session)}</p>
      </div>
      <div className="progress-track" aria-hidden="true"><span style={{ width: `${(currentPosition(session) / totalCards(session)) * 100}%` }} /></div>
      <button className={`prompt-card${session.revealed ? " is-revealed" : ""}${host ? "" : " is-readonly"}`} aria-label={session.revealed ? card.text : host ? "Reveal prompt card" : "Waiting for host to reveal prompt card"} onClick={() => !session.revealed && host && onReveal()}>
        <span className="card-level">{level.guidance}</span>
        {!session.revealed ? <span className="card-hidden"><strong>Tap to reveal</strong><span>Read aloud, then take your time.</span></span> : <span className="card-question">{card.text}</span>}
      </button>
      <p className="turn-copy">{activeRoom && !host ? "Follow along here. The host reveals and advances the shared deck." : "There is no right answer. Listening counts."}</p>
      <div className="conversation-action-dock">
        <div className="play-actions">
          <button className={`secondary-button${saved ? " is-saved" : ""}`} disabled={!session.revealed} onClick={() => onSave(card.id)}>{saved ? "Saved" : "Save card"}</button>
          {host && <button className="primary-button" disabled={!session.revealed || pending} onClick={onAdvance}>Next card</button>}
        </div>
        {host && <button className="text-button pass-button" onClick={onAdvance}>Pass and draw another</button>}
      </div>
    </section>
  );
}

function ConversationTransition({ session, roomCode, host, pending, onContinue }: { session: ConversationSession; roomCode?: string; host: boolean; pending: boolean; onContinue: () => void }) {
  const completedLevel = levels[session.levelIndex - 1];
  const nextLevel = currentLevel(session) as Level;
  return (
    <section className="screen transition-screen" aria-labelledby="transition-title">
      {roomCode && <div className="room-mini">Room {roomCode}</div>}
      <p className="eyebrow">{completedLevel.name} complete</p>
      <h2 id="transition-title">Take a breath.</h2>
      <p>{completedLevel.completion} Next up: {nextLevel.name}.</p>
      <button className="primary-button" disabled={!host || pending} onClick={onContinue}>{host ? "Continue" : "Waiting for host"}</button>
    </section>
  );
}

function ConversationResults({ session, roomCode, onNew, onReview }: { session: ConversationSession; roomCode?: string; onNew: () => void; onReview: () => void }) {
  const name = session.playerNames || "your table";
  return (
    <section className="screen results-screen" aria-labelledby="results-title">
      {roomCode && <div className="room-mini">Room {roomCode}</div>}
      <p className="eyebrow">Conversation complete</p>
      <h2 id="results-title">Thanks for showing up.</h2>
      <p className="lede">You completed {totalCards(session)} prompts with {name}. Keep the saved cards for a later conversation.</p>
      <div className="results-actions">
        <button className="primary-button" onClick={onNew}>{roomCode ? "Leave room" : "Play again"}</button>
        <button className="secondary-button" onClick={onReview}>Review saved cards</button>
      </div>
    </section>
  );
}

function LibraryScreen({ savedIds, onClose, onRemove, onClear }: { savedIds: string[]; onClose: () => void; onRemove: (id: string) => void; onClear: () => void }) {
  const saved = savedIds.map((id) => promptById(id) as Prompt | undefined).filter(Boolean) as Prompt[];
  return (
    <section className="screen library-screen" aria-labelledby="library-title">
      <div className="library-header">
        <div><p className="eyebrow">Your collection</p><h2 id="library-title">Saved cards</h2></div>
        <button className="ghost-button" onClick={onClose}>Close</button>
      </div>
      {!saved.length && <p className="empty-state">Cards you save during play will appear here.</p>}
      <div className="saved-grid">
        {saved.map((prompt) => (
          <article className="saved-card" key={prompt.id}>
            <p className="eyebrow">{levels.find((level) => level.id === prompt.level)?.name}</p>
            <p>{prompt.text}</p>
            <button className="text-button" onClick={() => onRemove(prompt.id)}>Remove</button>
          </article>
        ))}
      </div>
      {Boolean(saved.length) && <button className="text-button clear-button" onClick={onClear}>Clear saved cards</button>}
    </section>
  );
}
