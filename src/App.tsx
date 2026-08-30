import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  advance,
  continueLevel,
  createSession,
  currentPosition,
  reveal,
  totalCards
} from "../game-engine.js";
import { adaptiveView, createAdaptiveMatch, performAdaptiveAction } from "../adaptive-engine.js";
import { requestJson } from "./api";
import { Header } from "./components/Header";
import { InviteSheet } from "./components/InviteSheet";
import { LOCAL_DATE_REQUIRED_PROMPT_IDS } from "./date-night";
import { useRoomStream } from "./hooks/useRoomStream";
import { useSetupState } from "./hooks/useSetupState";
import { useToast } from "./hooks/useToast";
import { createI18n, type Language } from "./i18n";
import { I18nContext } from "./i18n-context";
import {
  audienceLabel,
  experienceLabel,
  isSeatedRoom,
  localAdaptiveViewerId,
  normalizeExperience,
  pairNames
} from "./labels";
import {
  adoptLegacyStorage,
  clearKey,
  LANGUAGE_KEY,
  loadJson,
  ROOM_KEY,
  SAVED_KEY,
  saveJson,
  SESSION_KEY
} from "./storage";
import {
  ConversationGame,
  ConversationResults,
  ConversationTransition
} from "./screens/ConversationScreens";
import { LibraryScreen } from "./screens/LibraryScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { AdaptiveRoomScreen } from "./screens/adaptive/AdaptiveRoomScreen";
import { CaptionRoomScreen } from "./screens/caption/CaptionRoomScreen";
import type {
  ActiveRoom,
  AdaptiveSession,
  CaptionSession,
  ConversationSession,
  RoomConnection,
  RoomSnapshot,
  ScreenName
} from "./types";

// Icebreaker resolves its responder on the server; hold the reveal for the wheel.
const SPIN_REVEAL_MS = 480;

adoptLegacyStorage();

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export function App() {
  const invitedCode = new URLSearchParams(window.location.search).get("room")?.toUpperCase().slice(0, 5) || "";
  const [session, setSession] = useState<ConversationSession | AdaptiveSession | CaptionSession | null>(() =>
    loadJson<ConversationSession>(SESSION_KEY));
  const [language, setLanguage] = useState<Language>(() =>
    loadJson<Language>(LANGUAGE_KEY) || (navigator.language === "pt-PT" ? "pt-PT" : "en"));
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(() => loadJson<ActiveRoom>(ROOM_KEY));
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>(() => loadJson<string[]>(SAVED_KEY) ?? []);
  const [screen, setScreen] = useState<ScreenName>("setup");
  const returnScreenRef = useRef<ScreenName>("setup");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const { toast, notice } = useToast();
  const {
    setup,
    update,
    choosePlayMode,
    toggleThemeTag,
    dateNightTags,
    dateNightCounts,
    dateNightFiltersValid
  } = useSetupState(invitedCode);
  const i18n = useMemo(() => createI18n(language), [language]);

  const { spinning, beginSpin, endSpin, resolveSnapshot, closeStream } = useRoomStream(activeRoom, {
    onSnapshot: (room) => {
      setSnapshot(room);
      setSession(room.session);
    },
    onLost: () => {
      leaveRoom();
      notice(i18n.t("That room is no longer active"));
    },
    onReconnecting: () => notice(i18n.t("Reconnecting to live room..."))
  });

  const caption = session && "mode" in session && session.mode === "caption"
    ? session as CaptionSession
    : null;
  const adaptiveMatch = session && !caption && "mode" in session ? session as AdaptiveSession : null;
  const adaptive = adaptiveMatch
    ? activeRoom
      ? adaptiveMatch
      : adaptiveView(adaptiveMatch, localAdaptiveViewerId(adaptiveMatch)) as AdaptiveSession
    : null;
  const conversation = !adaptive && !caption && session ? session as ConversationSession : null;
  const host = !activeRoom || activeRoom.role === "host";

  useEffect(() => {
    const theme = caption?.mode || adaptive?.mode ||
      (screen === "setup" && setup.playMode !== "join" ? normalizeExperience(setup.roomMode) : "conversation");
    if (document.body.dataset.experience === theme) {
      return;
    }
    // A theme swap rewrites every colour token at once. Elements mid-transition on a
    // property fed by one of those tokens can keep the old value rather than move to the
    // new one, so transitions are held off for the frame the swap lands on.
    const root = document.documentElement;
    root.classList.add("theme-switching");
    document.body.dataset.experience = theme;
    void root.offsetHeight;
    const frame = window.requestAnimationFrame(() => root.classList.remove("theme-switching"));
    return () => {
      window.cancelAnimationFrame(frame);
      root.classList.remove("theme-switching");
    };
  }, [adaptive?.mode, caption?.mode, screen, setup.playMode, setup.roomMode]);

  useEffect(() => {
    // Only an unfinished single-phone conversation is worth resuming; a live room is
    // rebuilt from the server, and an adaptive match belongs to its room.
    if (session && !activeRoom && !("mode" in session)) {
      saveJson(SESSION_KEY, session);
    } else {
      clearKey(SESSION_KEY);
    }
    if (activeRoom) {
      saveJson(ROOM_KEY, activeRoom);
    } else {
      clearKey(ROOM_KEY);
    }
    saveJson(SAVED_KEY, savedIds);
    saveJson(LANGUAGE_KEY, language);
  }, [activeRoom, language, savedIds, session]);

  useEffect(() => {
    if (!activeRoom || adaptive || caption || !conversation || !["game", "transition", "results"].includes(screen)) {
      return;
    }
    const expected = conversation.completed ? "results" : conversation.betweenLevels ? "transition" : "game";
    if (screen !== expected) {
      setScreen(expected);
    }
  }, [activeRoom, adaptive, caption, conversation, screen]);

  useEffect(() => {
    if (screen !== "library") {
      returnScreenRef.current = screen;
    }
  }, [screen]);

  function openCurrentSession(nextSession: ConversationSession | AdaptiveSession | CaptionSession | null = session) {
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
    setScreen(next);
    window.scrollTo(0, 0);
  }

  // Saved cards open over whatever was on screen, so closing them returns there. Play
  // screens are opened straight through setScreen, which is why the screen to come back
  // to is recorded on every change rather than by one entry point.
  function closeLibrary() {
    const target = returnScreenRef.current;
    goTo(target !== "setup" && !session ? "setup" : target);
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
    setScreen(isSeatedRoom(room) ? "adaptive" : "game");
  }

  function leaveRoom() {
    closeStream();
    setInviteOpen(false);
    setActiveRoom(null);
    setSnapshot(null);
    setSession(null);
  }

  function startLocalPair(mode: "classic" | "date_night") {
    const [firstName, secondName] = pairNames(setup.playerNames);
    const lobby = createAdaptiveMatch({
      mode,
      participants: [
        { id: "local-1", name: firstName, role: "host" },
        { id: "local-2", name: secondName, role: "player" }
      ],
      ...(mode === "date_night"
        ? {
            promptFilters: { tags: setup.selectedThemeTags, includeSpicy: setup.includeSpicy },
            dateVariant: setup.dateVariant,
            includePromptIds: [...LOCAL_DATE_REQUIRED_PROMPT_IDS]
          }
        : {})
    });
    setSession(performAdaptiveAction(lobby, "local-1", "start_match") as AdaptiveSession);
    setScreen("adaptive");
  }

  async function handleSetupSubmit(event: FormEvent) {
    event.preventDefault();
    const options = {
      audience: setup.audience,
      playerNames: setup.playerNames,
      cardsPerLevel: setup.cardsPerLevel
    };
    if (setup.playMode === "host") {
      try {
        const experienceOptions = setup.roomMode === "date_night"
          ? {
              promptFilters: { tags: setup.selectedThemeTags, includeSpicy: setup.includeSpicy },
              dateVariant: setup.dateVariant
            }
          : setup.roomMode === "caption"
            ? { promptKind: setup.captionPromptKind, judged: setup.captionJudged }
            : {};
        const connection = await requestJson<RoomConnection>("/api/rooms", {
          method: "POST",
          body: JSON.stringify({ ...options, mode: setup.roomMode, hostName: setup.hostName, ...experienceOptions })
        });
        enterRoom(connection, "host");
        notice(setup.roomMode === "conversation"
          ? i18n.t("Room {code} is live", { code: connection.room.code })
          : i18n.t("{experience} room {code} is open", {
              experience: experienceLabel(setup.roomMode),
              code: connection.room.code
            }));
      } catch (error) {
        notice((error as Error).message);
      }
      return;
    }
    leaveRoom();
    if (setup.roomMode === "classic" || setup.roomMode === "date_night") {
      startLocalPair(setup.roomMode);
      return;
    }
    setSession(createSession(options) as ConversationSession);
    setScreen("game");
  }

  async function handleJoinSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const code = setup.joinCode.replace(/\s+/g, "").toUpperCase();
      const connection = await requestJson<RoomConnection>(`/api/rooms/${code}/join`, {
        method: "POST",
        body: JSON.stringify({ name: setup.joinName })
      });
      enterRoom(connection, "player");
      notice(i18n.t("Joined room {code}", { code: connection.room.code }));
    } catch (error) {
      notice((error as Error).message);
    }
  }

  async function sendRoomAction(action: string, payload: Record<string, unknown> = {}) {
    // A single-phone adaptive match runs the same engine the server would run.
    if (adaptiveMatch && !activeRoom) {
      if (pending) {
        return;
      }
      setPending(true);
      try {
        const actorId = localAdaptiveViewerId(adaptiveMatch);
        setSession(performAdaptiveAction(adaptiveMatch, actorId, action, payload) as AdaptiveSession);
      } catch (error) {
        notice((error as Error).message);
      } finally {
        setPending(false);
      }
      return;
    }
    if (!activeRoom || pending || (!isSeatedRoom(activeRoom) && !host)) {
      return;
    }
    const spin = action === "spin_target";
    setPending(true);
    if (spin) {
      beginSpin();
    }
    try {
      const authorization = isSeatedRoom(activeRoom)
        ? { participantToken: activeRoom.participantToken }
        : { hostToken: activeRoom.hostToken };
      const request = requestJson<RoomSnapshot>(`/api/rooms/${activeRoom.code}/actions`, {
        method: "POST",
        body: JSON.stringify({ action, ...authorization, ...payload })
      });
      const response = spin ? (await Promise.all([request, delay(SPIN_REVEAL_MS)]))[0] : await request;
      const next = resolveSnapshot(response);
      setSnapshot(next);
      setSession(next.session);
    } catch (error) {
      notice((error as Error).message);
    } finally {
      endSpin();
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
    return activeRoom ? `${window.location.origin}/?room=${activeRoom.code}` : "";
  }

  async function copyInvite() {
    if (!activeRoom) {
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteUrl());
      notice(i18n.t("Invite link copied"));
    } catch {
      notice(`Invite code: ${activeRoom.code}`);
    }
  }

  async function shareInvite() {
    if (!activeRoom) {
      return;
    }
    const label = experienceLabel(activeRoom.mode);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${label} on How Are We Crazy`,
          text: `Join my ${label} room: ${activeRoom.code}`,
          url: inviteUrl()
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
            setup={setup}
            sessionActive={Boolean(session)}
            resumeText={resumeText}
            dateNightTags={dateNightTags}
            dateNightCounts={dateNightCounts}
            dateNightFiltersValid={dateNightFiltersValid}
            onChange={update}
            onPlayMode={choosePlayMode}
            onThemeTag={toggleThemeTag}
            onResume={() => openCurrentSession()}
            onDiscard={() => { leaveRoom(); setSession(null); }}
            onSubmit={(event) => void handleSetupSubmit(event)}
            onJoin={(event) => void handleJoinSubmit(event)}
          />
        )}
        {screen === "adaptive" && caption && activeRoom && (
          <CaptionRoomScreen
            session={caption}
            roomCode={activeRoom.code}
            pending={pending}
            onInvite={() => setInviteOpen(true)}
            onAction={(action, payload) => void sendRoomAction(action, payload)}
            onLeave={() => { leaveRoom(); goTo("setup"); }}
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
            onClose={closeLibrary}
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
