import { createContext, FormEvent, useContext, useEffect, useMemo, useRef, useState } from "react";
import TwotoneBookmarkIcon from "@iconify-react/ic/twotone-bookmark";
import FlagPortugalIcon from "@iconify-react/twemoji/flag-portugal";
import FlagUnitedKingdomIcon from "@iconify-react/twemoji/flag-united-kingdom";
import QRCode from "qrcode";
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
import { LEVELS, PROMPTS, promptById } from "../data/prompts.js";
import { adaptiveView, createAdaptiveMatch, LEVEL_POINTS, performAdaptiveAction } from "../adaptive-engine.js";
import { createI18n, LANGUAGES, type Language } from "./i18n";
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
const LANGUAGE_KEY = "open-thread.language";
const ADAPTIVE_MODES = ["date_night", "inner_circle", "icebreaker", "competitive"];
const levels = LEVELS as Level[];
const prompts = PROMPTS as Prompt[];
const points = LEVEL_POINTS as Record<string, number>;
const LOCAL_DATE_REQUIRED_PROMPT_IDS = [
  "c01",
  "c08",
  "c09",
  "d106",
  "d108",
  "n03",
  "n12",
  "d210",
  "q118",
  "q111",
  "r07",
  "r12",
  "d311",
  "d315",
  "q121"
];
type I18n = ReturnType<typeof createI18n>;
const I18nContext = createContext<I18n>(createI18n("en"));

function useI18n() {
  return useContext(I18nContext);
}

function baseDateNightPrompt(prompt: Prompt, includeSpicy: boolean): boolean {
  return prompt.audiences.includes("couple") &&
    (!prompt.experiences || prompt.experiences.includes("date_night")) &&
    (!prompt.isSpicy || includeSpicy);
}

function matchesSelectedThemes(prompt: Prompt, selectedTags: string[]): boolean {
  return selectedTags.length === 0 || Boolean(prompt.tags?.some((tag) => selectedTags.includes(tag)));
}

function dateNightThemeTags(includeSpicy: boolean): string[] {
  return [...new Set(prompts
    .filter((prompt) => baseDateNightPrompt(prompt, includeSpicy))
    .flatMap((prompt) => prompt.tags || []))]
    .sort((left, right) => left.localeCompare(right));
}

function dateNightAvailability(selectedTags: string[], includeSpicy: boolean): Record<string, number> {
  return Object.fromEntries(levels.map((level) => [
    level.id,
    prompts.filter((prompt) =>
      prompt.level === level.id &&
      baseDateNightPrompt(prompt, includeSpicy) &&
      matchesSelectedThemes(prompt, selectedTags)
    ).length
  ]));
}

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
    date_night: "A Table 4 Two",
    inner_circle: "Inner Circle",
    competitive: "Inner Circle",
    icebreaker: "Icebreaker"
  }[mode || ""] || "Conversation";
}

function audienceLabel(audience: Audience): string {
  return { couple: "two people", friends: "friends", group: "a group" }[audience];
}

function pairNames(playerNames: string) {
  const names = playerNames
    .split(/[+,&/]/)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 2);
  return [names[0] || "Partner 1", names[1] || "Partner 2"];
}

function localAdaptiveViewerId(session: AdaptiveSession) {
  return session.currentResponderId || session.activePlayerId || session.players[0]?.id || "";
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
  const [language, setLanguage] = useState<Language>(() =>
    loadJson<Language>(LANGUAGE_KEY) || (navigator.language === "pt-PT" ? "pt-PT" : "en"));
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
  const [selectedThemeTags, setSelectedThemeTags] = useState<string[]>([]);
  const [includeSpicy, setIncludeSpicy] = useState(false);
  const [agreement, setAgreement] = useState(false);
  const [joinCode, setJoinCode] = useState(invitedCode);
  const [joinName, setJoinName] = useState("");
  const [joinAgreement, setJoinAgreement] = useState(false);
  const [toast, setToast] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const spinningRef = useRef(false);
  const deferredSpinRef = useRef<RoomSnapshot | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const adaptiveMatch = session && "mode" in session ? session as AdaptiveSession : null;
  const adaptive = adaptiveMatch
    ? activeRoom
      ? adaptiveMatch
      : adaptiveView(adaptiveMatch, localAdaptiveViewerId(adaptiveMatch)) as AdaptiveSession
    : null;
  const conversation = !adaptive && session ? session as ConversationSession : null;
  const host = !activeRoom || activeRoom.role === "host";
  const dateNightTags = useMemo(() => dateNightThemeTags(includeSpicy), [includeSpicy]);
  const dateNightCounts = useMemo(
    () => dateNightAvailability(selectedThemeTags, includeSpicy),
    [includeSpicy, selectedThemeTags]
  );
  const dateNightFiltersValid = levels.every((level) => (dateNightCounts[level.id] || 0) >= 2);
  const i18n = useMemo(() => createI18n(language), [language]);

  useEffect(() => {
    setSelectedThemeTags((current) => current.filter((tag) => dateNightTags.includes(tag)));
  }, [dateNightTags]);

  useEffect(() => {
    const theme = adaptive?.mode ||
      (screen === "setup" && playMode !== "join" ? normalizeExperience(roomMode) : "conversation");
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
    localStorage.setItem(LANGUAGE_KEY, JSON.stringify(language));
  }, [activeRoom, language, savedIds, session]);

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
          notice(i18n.t("That room is no longer active"));
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
        notice(i18n.t("Reconnecting to live room..."));
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

  function choosePlayMode(nextMode: PlayMode) {
    setPlayMode(nextMode);
    if (nextMode === "local" && !["conversation", "date_night"].includes(roomMode)) {
      setRoomMode("conversation");
    }
  }

  function toggleThemeTag(tag: string) {
    setSelectedThemeTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
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
    setInviteOpen(false);
    setActiveRoom(null);
    setSnapshot(null);
    setSession(null);
  }

  async function handleSetupSubmit(event: FormEvent) {
    event.preventDefault();
    const options = { audience, playerNames, cardsPerLevel };
    if (playMode === "host") {
      try {
        const dateNightFilters = roomMode === "date_night"
          ? { promptFilters: { tags: selectedThemeTags, includeSpicy } }
          : {};
        const connection = await requestJson<RoomConnection>("/api/rooms", {
          method: "POST",
          body: JSON.stringify({ ...options, mode: roomMode, hostName, ...dateNightFilters })
        });
        enterRoom(connection, "host");
        notice(roomMode === "conversation"
          ? i18n.t("Room {code} is live", { code: connection.room.code })
          : i18n.t("{experience} room {code} is open", {
              experience: experienceLabel(roomMode),
              code: connection.room.code
            }));
      } catch (error) {
        notice((error as Error).message);
      }
      return;
    }
    leaveRoom();
    if (roomMode === "date_night") {
      const [firstName, secondName] = pairNames(playerNames);
      const lobby = createAdaptiveMatch({
        mode: "date_night",
        participants: [
          { id: "local-1", name: firstName, role: "host" },
          { id: "local-2", name: secondName, role: "player" }
        ],
        promptFilters: { tags: selectedThemeTags, includeSpicy },
        includePromptIds: [...LOCAL_DATE_REQUIRED_PROMPT_IDS]
      });
      const started = performAdaptiveAction(lobby, "local-1", "start_match");
      setSession(started as AdaptiveSession);
      setScreen("adaptive");
      return;
    }
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
      notice(i18n.t("Joined room {code}", { code: connection.room.code }));
    } catch (error) {
      notice((error as Error).message);
    }
  }

  async function sendRoomAction(action: string, payload: Record<string, unknown> = {}) {
    if (adaptiveMatch && !activeRoom) {
      if (pending) {
        return;
      }
      setPending(true);
      try {
        const actorId = localAdaptiveViewerId(adaptiveMatch);
        const next = performAdaptiveAction(adaptiveMatch, actorId, action, payload);
        setSession(next as AdaptiveSession);
      } catch (error) {
        notice((error as Error).message);
      } finally {
        setPending(false);
      }
      return;
    }
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
      notice(i18n.t(removing ? "Removed from saved cards" : "Saved for later"));
      return removing ? current.filter((savedId) => savedId !== id) : [id, ...current];
    });
  }

  function inviteUrl() {
    if (!activeRoom) {
      return "";
    }
    return `${window.location.origin}/?room=${activeRoom.code}`;
  }

  async function shareInvite() {
    if (!activeRoom) {
      return;
    }
    const label = experienceLabel(activeRoom.mode);
    const url = inviteUrl();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${label} on How Are We Crazy`,
          text: `Join my ${label} room: ${activeRoom.code}`,
          url
        });
        notice(i18n.t("Invite shared"));
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
      }
    }
    await copyInvite();
  }

  async function copyInvite() {
    if (!activeRoom) {
      return;
    }
    const url = inviteUrl();
    try {
      await navigator.clipboard.writeText(url);
      notice(i18n.t("Invite link copied"));
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
    if (adaptive && !activeRoom) {
      return i18n.t("{experience}: playing turn {turn}.", {
        experience: experienceLabel(adaptive.mode),
        turn: adaptive.turnNumber || 1
      });
    }
    if (adaptive && activeRoom) {
      const state = adaptive.status === "lobby" ? "waiting in the lobby" :
        adaptive.status === "finished" ? "ready to review results" :
          i18n.t("playing turn {turn}", { turn: adaptive.turnNumber });
      return i18n.t("{experience} room {code} is {state}.", {
        experience: experienceLabel(activeRoom.mode),
        code: activeRoom.code,
        state: i18n.t(state)
      });
    }
    if (conversation && activeRoom) {
      const role = activeRoom.role === "host" ? "Hosting" : "Joined";
      return i18n.t("{role} room {code}: card {current} of {total} is waiting.", {
        role: i18n.t(role),
        code: activeRoom.code,
        current: currentPosition(conversation),
        total: totalCards(conversation)
      });
    }
    if (conversation) {
      const name = conversation.playerNames || audienceLabel(conversation.audience);
      return i18n.t("{name}: card {current} of {total} is waiting.", {
        name: i18n.t(name),
        current: currentPosition(conversation),
        total: totalCards(conversation)
      });
    }
    return "";
  }, [activeRoom, adaptive, conversation, i18n, session]);

  return (
    <I18nContext.Provider value={i18n}>
      <main className="app">
        <Header
          savedCount={savedIds.length}
          language={language}
          onHome={() => goTo("setup")}
          onLibrary={() => goTo("library")}
          onLanguage={setLanguage}
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
            dateNightTags={dateNightTags}
            selectedThemeTags={selectedThemeTags}
            includeSpicy={includeSpicy}
            dateNightCounts={dateNightCounts}
            dateNightFiltersValid={dateNightFiltersValid}
            agreement={agreement}
            joinCode={joinCode}
            joinName={joinName}
            joinAgreement={joinAgreement}
            onPlayMode={choosePlayMode}
            onRoomMode={setRoomMode}
            onAudience={setAudience}
            onPlayerNames={setPlayerNames}
            onHostName={setHostName}
            onCardsPerLevel={setCardsPerLevel}
            onThemeTag={toggleThemeTag}
            onClearThemeTags={() => setSelectedThemeTags([])}
            onIncludeSpicy={setIncludeSpicy}
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
        {screen === "adaptive" && adaptive && (
          <AdaptiveRoomScreen
            session={adaptive}
            snapshot={(snapshot || {
              code: "LOCAL",
              mode: adaptive.mode,
              participants: adaptive.players,
              session: adaptive,
              viewerId: localAdaptiveViewerId(adaptive)
            }) as RoomSnapshot<AdaptiveSession>}
            savedIds={savedIds}
            pending={pending}
            spinning={spinning}
            onInvite={() => setInviteOpen(true)}
            onAction={(action, payload) => void sendRoomAction(action, payload)}
            onSave={toggleSaved}
            onLeave={() => { leaveRoom(); goTo("setup"); }}
            local={!activeRoom}
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
            onInvite={() => setInviteOpen(true)}
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
            onClear={() => { setSavedIds([]); notice(i18n.t("Saved cards cleared")); }}
          />
        )}
      </main>
      {activeRoom && inviteOpen && (
        <InviteSheet
          code={activeRoom.code}
          inviteUrl={inviteUrl()}
          mode={activeRoom.mode}
          onClose={() => setInviteOpen(false)}
          onCopy={() => void copyInvite()}
          onShare={() => void shareInvite()}
        />
      )}
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </I18nContext.Provider>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<unknown>;
}

function Header({
  savedCount,
  language,
  onHome,
  onLibrary,
  onLanguage
}: {
  savedCount: number;
  language: Language;
  onHome: () => void;
  onLibrary: () => void;
  onLanguage: (language: Language) => void;
}) {
  const { t } = useI18n();
  const [languageOpen, setLanguageOpen] = useState(false);
  const CurrentFlagIcon = language === "pt-PT" ? FlagPortugalIcon : FlagUnitedKingdomIcon;
  return (
    <header className="topbar">
      <button className="brand" aria-label="Return to setup" onClick={onHome}>
        <span className="brand-mark" aria-hidden="true" />
        <span>How Are We Crazy</span>
      </button>
      <div className="topbar-actions">
        <div className="language-menu">
          <button
            className="language-trigger"
            type="button"
            aria-expanded={languageOpen}
            aria-haspopup="menu"
            aria-label="Language"
            onClick={() => setLanguageOpen((open) => !open)}
          >
            <CurrentFlagIcon className="language-flag" aria-hidden="true" />
            <span>{language === "pt-PT" ? "PT" : "EN"}</span>
            <span className="language-chevron" aria-hidden="true" />
          </button>
          {languageOpen && (
            <div className="language-popover" role="menu">
              {LANGUAGES.map((item) => {
                const selected = language === item.code;
                const FlagIcon = item.code === "pt-PT" ? FlagPortugalIcon : FlagUnitedKingdomIcon;
                return (
                  <button
                    className={`language-option${selected ? " is-selected" : ""}`}
                    key={item.code}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => {
                      onLanguage(item.code);
                      setLanguageOpen(false);
                    }}
                  >
                    <FlagIcon className="language-flag" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <button className="saved-button" aria-label={t("Open saved cards")} title={t("Saved cards")} onClick={onLibrary}>
          <TwotoneBookmarkIcon className="bookmark-icon" aria-hidden="true" />
          <span className="saved-count" aria-hidden="true">{savedCount}</span>
        </button>
      </div>
    </header>
  );
}

function InviteSheet({
  code,
  inviteUrl,
  mode,
  onClose,
  onCopy,
  onShare
}: {
  code: string;
  inviteUrl: string;
  mode: RoomMode | "competitive";
  onClose: () => void;
  onCopy: () => void;
  onShare: () => void;
}) {
  const { t } = useI18n();
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(inviteUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      color: {
        dark: "#231d19",
        light: "#fffaf2"
      }
    }).then((dataUrl) => {
      if (!cancelled) {
        setQrDataUrl(dataUrl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [inviteUrl]);

  return (
    <div className="invite-backdrop" role="presentation" onClick={onClose}>
      <section className="invite-sheet" role="dialog" aria-modal="true" aria-labelledby="invite-title" onClick={(event) => event.stopPropagation()}>
        <div className="invite-heading">
          <div>
            <p className="eyebrow">{experienceLabel(mode)}</p>
            <h2 id="invite-title">{t("Invite players")}</h2>
          </div>
          <button className="ghost-button invite-close" type="button" onClick={onClose}>{t("Close")}</button>
        </div>
        <div className="qr-card">
          {qrDataUrl
            ? <img src={qrDataUrl} alt={t("QR code invite")} />
            : <div className="qr-placeholder" aria-hidden="true" />}
        </div>
        <p className="invite-code">{code}</p>
        <p className="invite-copy">{t("Scan this code or share the link so players can join from their own phones.")}</p>
        <div className="invite-actions">
          <button className="primary-button" type="button" onClick={onShare}>{t("Share")}</button>
          <button className="secondary-button" type="button" onClick={onCopy}>{t("Copy link")}</button>
        </div>
      </section>
    </div>
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
  dateNightTags: string[];
  selectedThemeTags: string[];
  includeSpicy: boolean;
  dateNightCounts: Record<string, number>;
  dateNightFiltersValid: boolean;
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
  onThemeTag: (value: string) => void;
  onClearThemeTags: () => void;
  onIncludeSpicy: (value: boolean) => void;
  onAgreement: (value: boolean) => void;
  onJoinCode: (value: string) => void;
  onJoinName: (value: string) => void;
  onJoinAgreement: (value: boolean) => void;
  onResume: () => void;
  onDiscard: () => void;
  onSubmit: (event: FormEvent) => void;
  onJoin: (event: FormEvent) => void;
}) {
  const { t, tag } = useI18n();
  const adaptive = props.playMode === "host" && props.roomMode !== "conversation" ||
    props.playMode === "local" && props.roomMode === "date_night";
  const helper = {
    conversation: "Everyone follows one shared deck. No scores, only space to answer or pass.",
    date_night: "Work together toward a shared milestone, then choose a closing moment.",
    inner_circle: "Private draws and points stay playful through balanced target cooldowns.",
    icebreaker: "A fair spin chooses responders while everyone builds group progress."
  }[props.roomMode];
  const startText = adaptive
    ? props.playMode === "host"
      ? t("Create {experience} room", { experience: experienceLabel(props.roomMode) })
      : t("Start {experience}", { experience: experienceLabel(props.roomMode) })
    : props.playMode === "host" ? t("Create live room") : t("Start the conversation");
  const dateNightThemeInvalid = props.playMode !== "join" &&
    props.roomMode === "date_night" &&
    !props.dateNightFiltersValid;
  return (
    <section className="screen setup-screen" aria-labelledby="welcome-title">
      <p className="eyebrow">{t("Conversation card game")}</p>
      <h1 id="welcome-title">{t("Get closer, one honest question at a time.")}</h1>
      <p className="lede">{t("Play from one phone or create a room so every player can follow along on their own screen across three levels.")}</p>
      {props.sessionActive && (
        <div className="resume-card">
          <p className="eyebrow">{t("Session in progress")}</p>
          <p>{props.resumeText}</p>
          <div className="button-row">
            <button className="primary-button" onClick={props.onResume}>{t("Resume game")}</button>
            <button className="text-button" onClick={props.onDiscard}>{t("Start over")}</button>
          </div>
        </div>
      )}
      <fieldset className="play-mode">
        <legend>{t("How are you playing?")}</legend>
        <div className="mode-grid">
          {([["local", "One phone"], ["host", "Host room"], ["join", "Join room"]] as const).map(([value, label]) => (
            <label className="mode-choice" key={value}>
              <input type="radio" name="playMode" checked={props.playMode === value} onChange={() => props.onPlayMode(value)} />
              <span>{t(label)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {props.playMode !== "join" ? (
        <form className="setup-form" onSubmit={props.onSubmit}>
          {!adaptive && (
            <fieldset>
              <legend>{t("Who is playing?")}</legend>
              <div className="choice-grid">
                {([["couple", "Two people", "Dates or partners"], ["friends", "Friends", "New or longtime"], ["group", "Group", "Three or more"]] as const).map(([value, title, copy]) => (
                  <label className="choice" key={value}>
                    <input type="radio" checked={props.audience === value} onChange={() => props.onAudience(value)} />
                    <span className="choice-title">{t(title)}</span>
                    <span className="choice-copy">{t(copy)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <label className="field">
            <span>{t("Names or table name")} <small>({t("optional")})</small></span>
            <input value={props.playerNames} onChange={(event) => props.onPlayerNames(event.target.value)} maxLength={42} placeholder="Maya + Jordan" />
          </label>
          {props.playMode === "host" && (
            <label className="field">
              <span>{t("Your name")} <small>({t("shown in the room")})</small></span>
              <input value={props.hostName} onChange={(event) => props.onHostName(event.target.value)} maxLength={28} placeholder="Maya" />
            </label>
          )}
          {props.playMode === "local" && (
            <fieldset>
              <legend>{t("Choose a format")}</legend>
              <div className="rule-grid">
                {([
                  ["conversation", "Unscored", "Conversation", "A gentle shared deck for open conversation."],
                  ["date_night", "2 players | Shared goal", "A Table 4 Two", "Build a connection milestone together."]
                ] as const).map(([value, meta, title, copy]) => (
                  <label className="rule-choice" key={value}>
                    <input type="radio" checked={props.roomMode === value} onChange={() => props.onRoomMode(value)} />
                    <span className="rule-meta">{t(meta)}</span>
                    <span className="choice-title">{t(title)}</span>
                    <span className="choice-copy">{t(copy)}</span>
                  </label>
                ))}
              </div>
              <p className="experience-helper">{t(helper)}</p>
            </fieldset>
          )}
          {props.playMode === "host" && (
            <fieldset>
              <legend>{t("Choose an experience")}</legend>
              <div className="rule-grid">
                {([
                  ["conversation", "Any group | Unscored", "Conversation", "A gentle shared deck for open conversation."],
                  ["date_night", "2 players | Shared goal", "A Table 4 Two", "Build a connection milestone together."],
                  ["inner_circle", "3-6 friends | Points", "Inner Circle", "Playfully compete with balanced targeting."],
                  ["icebreaker", "3-6 players | Shared goal", "Icebreaker", "Meet the room through fair roulette."]
                ] as const).map(([value, meta, title, copy]) => (
                  <label className="rule-choice" key={value}>
                    <input type="radio" checked={props.roomMode === value} onChange={() => props.onRoomMode(value)} />
                    <span className="rule-meta">{t(meta)}</span>
                    <span className="choice-title">{t(title)}</span>
                    <span className="choice-copy">{t(copy)}</span>
                  </label>
                ))}
              </div>
              <p className="experience-helper">{t(helper)}</p>
            </fieldset>
          )}
          {(props.playMode === "host" || props.playMode === "local") && props.roomMode === "date_night" && (
            <fieldset className="theme-panel">
              <legend>{t("Choose your themes")}</legend>
              <div className="theme-heading">
                <p>{t("Leave everything open, or pick any themes you want this A Table 4 Two deck to include.")}</p>
                {props.selectedThemeTags.length > 0 && (
                  <button className="text-button" type="button" onClick={props.onClearThemeTags}>{t("All themes")}</button>
                )}
              </div>
              <div className="theme-chip-list" aria-label="A Table 4 Two themes">
                {props.dateNightTags.map((themeTag) => {
                  const selected = props.selectedThemeTags.includes(themeTag);
                  return (
                    <button
                      className={`theme-chip${selected ? " is-selected" : ""}`}
                      key={themeTag}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => props.onThemeTag(themeTag)}
                    >
                      {tag(themeTag)}
                    </button>
                  );
                })}
              </div>
              <label className="spicy-toggle">
                <input
                  type="checkbox"
                  checked={props.includeSpicy}
                  onChange={(event) => props.onIncludeSpicy(event.target.checked)}
                />
                <span>
                  {t("Spicy cards")}
                  <small>{t("Opt-in only. These are more provocative and are still pass-friendly.")}</small>
                </span>
              </label>
              <div className="theme-counts" aria-label={t("Available prompts by level")}>
                {levels.map((level) => {
                  const count = props.dateNightCounts[level.id] || 0;
                  return <span className={count < 2 ? "is-low" : ""} key={level.id}>{t(level.name)}: {count}</span>;
                })}
              </div>
              <p className="theme-status">
                {props.selectedThemeTags.length === 0
                  ? t("All themes selected.")
                  : t("Selected: {themes}.", { themes: props.selectedThemeTags.map((item) => tag(item)).join(", ") })}
              </p>
              {dateNightThemeInvalid && (
                <p className="theme-warning">{t("Choose broader themes. A Table 4 Two needs at least 2 prompts in every level.")}</p>
              )}
            </fieldset>
          )}
          {!adaptive && (
            <label className="field">
              <span>{t("Cards per level")}</span>
              <select value={props.cardsPerLevel} onChange={(event) => props.onCardsPerLevel(Number(event.target.value))}>
                <option value={4}>{t("Quick round - 12 cards")}</option>
                <option value={6}>{t("Full round - 18 cards")}</option>
                <option value={8}>{t("Long round - 24 cards")}</option>
              </select>
            </label>
          )}
          <label className="agreement">
            <input type="checkbox" required checked={props.agreement} onChange={(event) => props.onAgreement(event.target.checked)} />
            <span>{t("We agree anyone can pass on a card, without explaining why.")}</span>
          </label>
          <button className="primary-button start-button" type="submit" disabled={dateNightThemeInvalid}>{startText}</button>
        </form>
      ) : (
        <form className="setup-form join-form" onSubmit={props.onJoin}>
          <label className="field">
            <span>{t("Room code")}</span>
            <input value={props.joinCode} onChange={(event) => props.onJoinCode(event.target.value)} maxLength={5} placeholder="AB123" required />
          </label>
          <label className="field">
            <span>{t("Your name")} <small>({t("optional")})</small></span>
            <input value={props.joinName} onChange={(event) => props.onJoinName(event.target.value)} maxLength={28} placeholder="Jordan" />
          </label>
          <label className="agreement">
            <input type="checkbox" required checked={props.joinAgreement} onChange={(event) => props.onJoinAgreement(event.target.checked)} />
            <span>{t("I agree anyone can pass on a card, without explaining why.")}</span>
          </label>
          <button className="primary-button start-button" type="submit">{t("Join conversation")}</button>
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
  onLeave,
  local = false
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
  local?: boolean;
}) {
  const { prompt: localizePrompt, t } = useI18n();
  const hasAction = (action: string) => session.availableActions.includes(action);
  const player = (id?: string | null) => session.players.find((item) => item.id === id);
  const active = player(session.activePlayerId);
  const target = player(session.targetPlayerId);
  const challenge = session.currentChallenge;
  const publicPrompt = session.mode === "inner_circle"
    ? ["await_response", "await_claim"].includes(session.phase)
    : session.phase === "await_response";
  const prompt = challenge?.prompt ? localizePrompt(challenge.prompt) : undefined;
  const waiting = !prompt && (
    session.mode === "icebreaker" && session.phase === "spin_target" ||
    session.mode === "inner_circle" && ["preview_card", "replacement_preview"].includes(session.phase)
  );
  const guidance = adaptiveGuidance(session, active, target, hasAction, t);

  return (
    <section className="screen points-screen" aria-live="polite">
      <aside className="room-banner">
        <div className="room-heading">
          <div>
            <p className="eyebrow">{local ? t("One phone") : experienceLabel(session.mode)}</p>
            {!local && <p className="room-code">{snapshot.code}</p>}
          </div>
          {!local && <button className="ghost-button" onClick={onInvite}>{t("Share invite")}</button>}
        </div>
        <div className="participant-list">
          {session.players.map((participant) => (
            <span className={`participant-chip${participant.connected ? "" : " is-offline"}`} key={participant.id}>
              {participant.name}{participant.role === "host" ? ` - ${t("host")}` : ""}{participant.connected ? "" : ` - ${t("unavailable")}`}
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
              <p className="eyebrow">{t("Turn {turn}", { turn: session.turnNumber })}</p>
              <h2>{session.mode === "date_night" ? t("{name} responds", { name: active.name }) : session.mode === "icebreaker" ? t("{name} facilitates", { name: active.name }) : t("{name}'s turn", { name: active.name })}</h2>
            </div>
            <p className="score-target">{session.mode === "date_night" ? t("Shared milestone") : session.mode === "icebreaker" ? t("Together to 15") : t("First to 21")}</p>
          </div>
          {session.mode !== "inner_circle" ? <SharedMeter session={session} /> : <ScorePanel session={session} />}
          <p className="points-guidance">{guidance}</p>
          {hasAction("choose_level") && (
            <LevelPicker session={session} viewer={player(snapshot.viewerId)} pending={pending} onAction={onAction} />
          )}
          {waiting && (
            <div className="waiting-stage">
              <span className="face-down-card" aria-hidden="true" />
              <p className="eyebrow">{session.mode === "icebreaker" ? t("Prompt concealed") : t("Private preview")}</p>
              <p>{session.mode === "icebreaker"
                ? hasAction("spin_target") ? t("Spin when the room is ready. The prompt appears once a responder is chosen.") : t("The facilitator is spinning for a responder.")
                : t("The active player is choosing who receives this prompt.")}</p>
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
              <p className="eyebrow">{t("Shared milestone reached")}</p>
              <h3>{t("How would you like to close tonight?")}</h3>
              <div className="ending-actions">
                <button className="primary-button" disabled={pending || !hasAction("choose_ending")} onClick={() => onAction("choose_ending", { endingType: "activity" })}>{t("Do Something Together")}</button>
                <button className="secondary-button" disabled={pending || !hasAction("choose_ending")} onClick={() => onAction("choose_ending", { endingType: "question" })}>{t("One More Meaningful Question")}</button>
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
  const { t, tag } = useI18n();
  let title = "A table for two.";
  const needed = Math.max(0, 3 - session.players.length);
  let copy = session.players.length === 1
    ? "Waiting for one partner to join this shared Table."
    : "Both partners are here. The host can begin when you are comfortable.";
  let action = "Start A Table 4 Two";
  if (session.mode !== "date_night") {
    const group = session.mode === "inner_circle" ? "friends" : "players";
    title = session.mode === "inner_circle" ? "Gather your inner circle." : "Open the room gently.";
    copy = needed > 0
      ? "Waiting for {count} more {kind} before you begin."
      : "{count} {kind} are ready. The host can begin when everyone is settled.";
    action = session.mode === "inner_circle" ? "Start Inner Circle" : "Start Icebreaker";
  }
  const selectedThemes = session.promptFilters?.tags?.length
    ? session.promptFilters.tags.map((item) => tag(item)).join(", ")
    : t("All themes");
  const copyValues: Record<string, string | number> = session.mode === "date_night" ? {} : {
    count: needed > 0 ? needed : session.players.length,
    kind: t(session.mode === "inner_circle"
      ? needed === 1 ? "friend" : "friends"
      : needed === 1 ? "player" : "players")
  };
  return (
    <div className="points-lobby">
      <p className="eyebrow">{t("Lobby")}</p>
      <h2>{t(title)}</h2>
      <p className="lede">{t(copy, copyValues)}</p>
      {session.mode === "date_night" && (
        <div className="lobby-filters">
          <span>{t("Themes: {themes}", { themes: selectedThemes })}</span>
          <span>{t(session.promptFilters?.includeSpicy ? "Spicy prompts ON" : "Spicy prompts off")}</span>
        </div>
      )}
      <p className="safety-note">{t("Passing is always welcome. No explanation needed.")}</p>
      {hasAction("start_match") && <button className="primary-button" disabled={pending} onClick={() => onAction("start_match")}>{t(action)}</button>}
    </div>
  );
}

function SharedMeter({ session }: { session: AdaptiveSession }) {
  const { level: localizeLevel, t } = useI18n();
  const score = session.mode === "date_night" ? session.connectionScore || 0 : session.groupScore || 0;
  return (
    <div className="shared-meter">
      <div className="meter-copy">
        <span>{session.mode === "date_night" ? t("Connection Meter") : t("Group progress")}</span>
        <strong>{score} / {session.scoreTarget}</strong>
      </div>
      <div className="meter-track" aria-hidden="true"><span style={{ width: `${Math.min(100, (score / session.scoreTarget) * 100)}%` }} /></div>
      {session.mode === "date_night" && (
        <div className="level-progress">
          {levels.map((level) => <span key={level.id}>{localizeLevel(level).name}: {session.completedByLevel?.[level.id] || 0} / 2</span>)}
        </div>
      )}
    </div>
  );
}

function ScorePanel({ session, final = false }: { session: AdaptiveSession; final?: boolean }) {
  const { t } = useI18n();
  return final ? <ScoreRows session={session} final /> : (
    <details className="score-panel">
      <summary>{t("Scoreboard")}</summary>
      <ScoreRows session={session} />
    </details>
  );
}

function ScoreRows({ session, final = false }: { session: AdaptiveSession; final?: boolean }) {
  const { t } = useI18n();
  const players = final ? [...session.players].sort((left, right) => right.score - left.score) : session.players;
  return (
    <div className={`scoreboard${final ? " final-scoreboard" : ""}`}>
      {players.map((item, index) => (
        <div className={`score-row${item.id === session.activePlayerId && !final ? " is-active" : ""}`} key={item.id}>
          <span className="score-position">{final ? `#${index + 1}` : item.id === session.activePlayerId ? t("Turn") : ""}</span>
          <span className="score-name">
            {item.name}
            <span className="score-resources">{item.bailoutAvailable ? t("Bailout") : t("Bailout used")} | {item.doubleDownAvailable ? t("Double Down") : t("Double Down used")}</span>
          </span>
          <span className="score-points">{item.score} {item.score === 1 ? t("point") : t("points")}</span>
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
  const { level: localizeLevel, t } = useI18n();
  const [doubleDown, setDoubleDown] = useState(false);
  const mayWager = session.mode === "inner_circle" && Boolean(viewer?.doubleDownAvailable);
  return (
    <div className="level-picker">
      <p className="eyebrow">{t("Choose a challenge")}</p>
      <div className="level-actions">
        {levels.filter((level) => Object.hasOwn(session.remainingByLevel, level.id)).map((rawLevel) => {
          const level = localizeLevel(rawLevel);
          return (
          <button className="level-button" key={rawLevel.id} disabled={!session.remainingByLevel[rawLevel.id] || pending} onClick={() => onAction("choose_level", { levelId: rawLevel.id, doubleDown: mayWager && doubleDown })}>
            <strong>{points[rawLevel.id]}</strong>
            <span>{level.name}<br />{session.remainingByLevel[rawLevel.id]} {t("left")}</span>
          </button>
          );
        })}
      </div>
      {mayWager && (
        <label className="double-down">
          <input type="checkbox" checked={doubleDown} onChange={(event) => setDoubleDown(event.target.checked)} />
          <span><strong>{t("Double Down")}</strong> - {t("double their reward; lose the card's base value if they complete it.")}</span>
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
  const { level: localizeLevel, t } = useI18n();
  const level = levels.find((item) => item.id === challenge.levelId);
  const visibleLevel = level ? localizeLevel(level) : undefined;
  const value = challenge.doubled && !challenge.claimant ? challenge.basePoints * 2 : challenge.basePoints;
  const targets = session.players.filter((item) =>
    item.id !== snapshot.viewerId && item.connected && item.id !== challenge.excludedTargetId);
  return (
    <article className="points-card">
      <div className="card-meta">
        <p className="eyebrow">{visibleLevel?.name} - {value} {value === 1 ? t("point") : t("points")}{challenge.doubled ? ` - ${t("Double Down")}` : ""}</p>
        <p className="visibility-label">{!publicPrompt ? t("Only visible on your phone") : session.mode === "date_night" ? t("Visible to both partners") : t("Visible to the room")}</p>
      </div>
      <p className="points-question">{prompt.text}</p>
      <PromptFlairs prompt={prompt} />
      {session.mode === "inner_circle" && session.availableActions.includes("target_player") && (
        <div className="target-picker">
          <p>{t("Prompts are spread around the group. Cooling down players return in the next cycle.")}</p>
          <div className="target-actions">
            {targets.map((item) => {
              const allowed = session.targetablePlayerIds?.includes(item.id) || false;
              return (
                <button className={`target-button${allowed ? "" : " is-cooling"}`} key={item.id} disabled={!allowed || pending} onClick={() => onAction("target_player", { targetPlayerId: item.id })}>
                  {allowed ? item.name : `${item.name} - ${t("Cooling down")}`}
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
  const { t } = useI18n();
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
        <button className={className} key={action} disabled={pending} onClick={() => onAction(action)}>{t(label)}</button>
      ))}
      {canSave && prompt && (
        <button className={`secondary-button${saved ? " is-saved" : ""}`} onClick={onSave}>{saved ? t("Saved") : t("Save card")}</button>
      )}
    </div>
  );
}

function PromptFlairs({ prompt }: { prompt: Prompt }) {
  const { t, tag } = useI18n();
  if (!prompt.tags?.length) {
    return null;
  }
  return (
    <div className="prompt-flairs" aria-label={t("Prompt themes")}>
      {prompt.tags.map((themeTag) => <span className="prompt-flair" key={themeTag}>{tag(themeTag)}</span>)}
    </div>
  );
}

function AdaptiveResults({ session, onLeave }: { session: AdaptiveSession; onLeave: () => void }) {
  const { reward, t } = useI18n();
  let title: string;
  let copy: string;
  if (session.mode === "inner_circle") {
    const winners = (session.winnerIds || []).map((id) => session.players.find((item) => item.id === id)?.name).filter(Boolean).join(" & ");
    title = (session.winnerIds?.length || 0) > 1 ? t("{winners} tie.", { winners }) : t("{winner} wins.", { winner: winners });
    copy = session.endReason === "score_target" ? "The first player reached 21 points." : "The prompts are complete. Highest score takes the match.";
  } else if (session.mode === "date_night") {
    title = session.endReason === "milestone" ? "You reached a shared milestone." : "Thank you for meeting each other here.";
    copy = session.endReason === "milestone"
      ? "Together you reached {score} connection points and explored every depth."
      : "You reached {score} connection points before this deck ended.";
  } else {
    title = session.endReason === "score_target" ? "Your group reached the goal." : "That was a good round.";
    copy = session.endReason === "score_target"
      ? "Together you built {score} points of group connection."
      : "Your group built {score} points before the available prompts ended.";
  }
  const score = session.mode === "date_night" ? session.connectionScore || 0 : session.groupScore || 0;
  const revealedReward = session.revealedReward ? reward(session.revealedReward) : null;
  return (
    <div className="points-results">
      <p className="eyebrow">{t("Experience complete")}</p>
      <h2>{t(title)}</h2>
      <p className="lede">{t(copy, { score })}</p>
      {revealedReward && (
        <article className="reward-card">
          <p className="eyebrow">{session.endingChoice === "activity" ? t("Do Something Together") : t("One More Meaningful Question")}</p>
          <p>{revealedReward.text}</p>
        </article>
      )}
      {session.mode === "inner_circle" && <ScorePanel session={session} final />}
      <button className="primary-button" onClick={onLeave}>{t("Leave room")}</button>
    </div>
  );
}

function adaptiveGuidance(
  session: AdaptiveSession,
  active: AdaptivePlayer | undefined,
  target: AdaptivePlayer | undefined,
  hasAction: (action: string) => boolean,
  t: I18n["t"]
) {
  if (session.mode === "date_night") {
    if (session.phase === "choose_ending") return t("You reached your shared milestone. Either partner can choose how to close tonight.");
    if (session.phase === "choose_level") return hasAction("choose_level") ? t("Your turn to answer. Choose a depth that feels right.") : t("{name} is choosing a prompt to answer.", { name: active?.name || "" });
    return hasAction("complete") ? t("Share what feels true, then mark Completed. Passing is always welcome.") : t("{name} is answering this prompt.", { name: active?.name || "" });
  }
  if (session.mode === "icebreaker") {
    if (session.phase === "choose_level") return hasAction("choose_level") ? t("You are facilitating. Pick a friendly depth for the group.") : t("{name} is selecting a prompt level.", { name: active?.name || "" });
    if (session.phase === "spin_target") return hasAction("spin_target") ? t("The prompt is ready. Spin to fairly choose its responder.") : t("{name} is spinning for a responder.", { name: active?.name || "" });
    return hasAction("complete") ? t("Answer aloud, then mark Completed, or Pass with no explanation needed.") : t("{name} is responding for the group.", { name: target?.name || "" });
  }
  if (session.phase === "choose_level") return hasAction("choose_level") ? t("Your turn. Choose how deep to go and whether to risk your Double Down.") : t("{name} is choosing a challenge.", { name: active?.name || "" });
  if (["preview_card", "replacement_preview"].includes(session.phase)) {
    return hasAction("target_player")
      ? session.phase === "replacement_preview" ? t("Bailout respected. Choose a different player for this replacement prompt.") : t("Only you can see this card. Choose who receives it.")
      : t("{name} is selecting a player.", { name: active?.name || "" });
  }
  if (session.phase === "await_response") {
    if (session.currentChallenge?.claimant) return hasAction("complete") ? t("Answer the prompt, then confirm completion to claim its points.") : t("{name} chose to answer the passed prompt.", { name: active?.name || "" });
    return hasAction("complete") ? t("Answer aloud, then mark the prompt completed - or pass without explanation.") : t("{name} is responding.", { name: target?.name || "" });
  }
  if (session.phase === "await_claim") return hasAction("claim") ? t("The prompt was passed. Answer it yourself for base points or discard it.") : t("{name} may claim or discard the passed prompt.", { name: active?.name || "" });
  return "";
}

function ConversationBanner({ snapshot, host, onInvite }: { snapshot: RoomSnapshot<ConversationSession>; host: boolean; onInvite: () => void }) {
  const { t } = useI18n();
  return (
    <aside className="room-banner">
      <div className="room-heading">
        <div><p className="eyebrow">{t("Live room")}</p><p className="room-code">{snapshot.code}</p></div>
        <button className="ghost-button" onClick={onInvite}>{t("Share invite")}</button>
      </div>
      <p className="room-role">{host ? t("You control the shared deck. Invite players with this code.") : t("The host controls the shared deck. Reveals appear here live.")}</p>
      <div className="participant-list">{snapshot.participants.map((participant) => <span className="participant-chip" key={participant.id}>{participant.name}{participant.role === "host" ? ` - ${t("host")}` : ""}</span>)}</div>
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
  const { level: localizeLevel, prompt: localizePrompt, t } = useI18n();
  const level = localizeLevel(currentLevel(session) as Level);
  const card = localizePrompt(currentCard(session) as Prompt);
  const saved = savedIds.includes(card.id);
  return (
    <section className="screen game-screen" aria-live="polite">
      {activeRoom && snapshot && <ConversationBanner snapshot={snapshot} host={host} onInvite={onInvite} />}
      <div className="game-header">
        <div><p className="eyebrow">{level.number}</p><h2>{level.name}</h2></div>
        <p className="progress-copy">{currentPosition(session)} / {totalCards(session)}</p>
      </div>
      <div className="progress-track" aria-hidden="true"><span style={{ width: `${(currentPosition(session) / totalCards(session)) * 100}%` }} /></div>
      <button className={`prompt-card${session.revealed ? " is-revealed" : ""}${host ? "" : " is-readonly"}`} aria-label={session.revealed ? card.text : host ? t("Reveal prompt card") : t("Waiting for host to reveal prompt card")} onClick={() => !session.revealed && host && onReveal()}>
        <span className="card-level">{level.guidance}</span>
        {!session.revealed ? <span className="card-hidden"><strong>{t("Tap to reveal")}</strong><span>{t("Read aloud, then take your time.")}</span></span> : <span className="card-question">{card.text}</span>}
      </button>
      <p className="turn-copy">{activeRoom && !host ? t("Follow along here. The host reveals and advances the shared deck.") : t("There is no right answer. Listening counts.")}</p>
      <div className="conversation-action-dock">
        <div className="play-actions">
          <button className={`secondary-button${saved ? " is-saved" : ""}`} disabled={!session.revealed} onClick={() => onSave(card.id)}>{saved ? t("Saved") : t("Save card")}</button>
          {host && <button className="primary-button" disabled={!session.revealed || pending} onClick={onAdvance}>{t("Next card")}</button>}
        </div>
        {host && <button className="text-button pass-button" onClick={onAdvance}>{t("Pass and draw another")}</button>}
      </div>
    </section>
  );
}

function ConversationTransition({ session, roomCode, host, pending, onContinue }: { session: ConversationSession; roomCode?: string; host: boolean; pending: boolean; onContinue: () => void }) {
  const { level: localizeLevel, t } = useI18n();
  const completedLevel = localizeLevel(levels[session.levelIndex - 1]);
  const nextLevel = localizeLevel(currentLevel(session) as Level);
  return (
    <section className="screen transition-screen" aria-labelledby="transition-title">
      {roomCode && <div className="room-mini">{t("Room {code}", { code: roomCode })}</div>}
      <p className="eyebrow">{completedLevel.name} {t("complete")}</p>
      <h2 id="transition-title">{t("Take a breath.")}</h2>
      <p>{completedLevel.completion} {t("Next up: {level}.", { level: nextLevel.name })}</p>
      <button className="primary-button" disabled={!host || pending} onClick={onContinue}>{host ? t("Continue") : t("Waiting for host")}</button>
    </section>
  );
}

function ConversationResults({ session, roomCode, onNew, onReview }: { session: ConversationSession; roomCode?: string; onNew: () => void; onReview: () => void }) {
  const { t } = useI18n();
  const name = session.playerNames || "your table";
  return (
    <section className="screen results-screen" aria-labelledby="results-title">
      {roomCode && <div className="room-mini">{t("Room {code}", { code: roomCode })}</div>}
      <p className="eyebrow">{t("Conversation complete")}</p>
      <h2 id="results-title">{t("Thanks for showing up.")}</h2>
      <p className="lede">{t("You completed {count} prompts with {name}. Keep the saved cards for a later conversation.", { count: totalCards(session), name })}</p>
      <div className="results-actions">
        <button className="primary-button" onClick={onNew}>{roomCode ? t("Leave room") : t("Play again")}</button>
        <button className="secondary-button" onClick={onReview}>{t("Review saved cards")}</button>
      </div>
    </section>
  );
}

function LibraryScreen({ savedIds, onClose, onRemove, onClear }: { savedIds: string[]; onClose: () => void; onRemove: (id: string) => void; onClear: () => void }) {
  const { level: localizeLevel, prompt: localizePrompt, t } = useI18n();
  const saved = savedIds
    .map((id) => promptById(id) as Prompt | undefined)
    .filter(Boolean)
    .map((prompt) => localizePrompt(prompt as Prompt));
  return (
    <section className="screen library-screen" aria-labelledby="library-title">
      <div className="library-header">
        <div><p className="eyebrow">{t("Your collection")}</p><h2 id="library-title">{t("Saved cards")}</h2></div>
        <button className="ghost-button" onClick={onClose}>{t("Close")}</button>
      </div>
      {!saved.length && <p className="empty-state">{t("Cards you save during play will appear here.")}</p>}
      <div className="saved-grid">
        {saved.map((prompt) => (
          <article className="saved-card" key={prompt.id}>
            <p className="eyebrow">{localizeLevel(levels.find((level) => level.id === prompt.level) as Level).name}</p>
            <p>{prompt.text}</p>
            <PromptFlairs prompt={prompt} />
            <button className="text-button" onClick={() => onRemove(prompt.id)}>{t("Remove")}</button>
          </article>
        ))}
      </div>
      {Boolean(saved.length) && <button className="text-button clear-button" onClick={onClear}>{t("Clear saved cards")}</button>}
    </section>
  );
}
