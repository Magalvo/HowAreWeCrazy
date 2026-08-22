import {
  currentCard,
  currentLevel,
  currentPosition,
  totalCards
} from "../../game-engine.js";
import { levels } from "../game-data";
import { useI18n } from "../i18n-context";
import type { ActiveRoom, ConversationSession, Level, Prompt, RoomSnapshot } from "../types";

function ConversationBanner({ snapshot, host, onInvite }: {
  snapshot: RoomSnapshot<ConversationSession>;
  host: boolean;
  onInvite: () => void;
}) {
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

export function ConversationGame({ session, snapshot, activeRoom, host, pending, savedIds, onInvite, onReveal, onAdvance, onSave }: {
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

export function ConversationTransition({ session, roomCode, host, pending, onContinue }: {
  session: ConversationSession;
  roomCode?: string;
  host: boolean;
  pending: boolean;
  onContinue: () => void;
}) {
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

export function ConversationResults({ session, roomCode, onNew, onReview }: {
  session: ConversationSession;
  roomCode?: string;
  onNew: () => void;
  onReview: () => void;
}) {
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
