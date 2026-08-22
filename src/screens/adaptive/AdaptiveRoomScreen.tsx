import { useI18n } from "../../i18n-context";
import { experienceLabel } from "../../labels";
import type { AdaptiveSession, RoomSnapshot } from "../../types";
import { ActionDock, ChallengeCard, LevelPicker } from "./AdaptiveCard";
import { AdaptiveLobby } from "./AdaptiveLobby";
import { ClassicProgress, ScorePanel, SharedMeter } from "./AdaptiveProgress";
import { AdaptiveResults } from "./AdaptiveResults";
import { adaptiveGuidance } from "./guidance";

/** Phases where the prompt is on show for the whole room rather than one private phone. */
function promptIsPublic(session: AdaptiveSession): boolean {
  if (session.mode === "classic") {
    return session.phase === "classic_prompt";
  }
  if (session.mode === "inner_circle") {
    return ["await_response", "await_claim"].includes(session.phase);
  }
  return session.phase === "await_response";
}

function turnHeading(session: AdaptiveSession, activeName: string, t: ReturnType<typeof useI18n>["t"]) {
  if (session.mode === "classic") return t("Classic");
  if (session.mode === "date_night") return t("{name} responds", { name: activeName });
  if (session.mode === "icebreaker") return t("{name} facilitates", { name: activeName });
  return t("{name}'s turn", { name: activeName });
}

function targetCopy(session: AdaptiveSession, t: ReturnType<typeof useI18n>["t"]) {
  if (session.mode === "classic") return t("Guided sequence");
  if (session.mode === "date_night") return t(session.dateVariant === "free_minds" ? "Free Minds" : "Shared milestone");
  if (session.mode === "icebreaker") return t("Together to 15");
  return t("First to 21");
}

export function AdaptiveRoomScreen({
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
  const { prompt: localizePrompt, reward: localizeReward, t } = useI18n();
  const hasAction = (action: string) => session.availableActions.includes(action);
  const player = (id?: string | null) => session.players.find((item) => item.id === id);
  const active = player(session.activePlayerId);
  const target = player(session.targetPlayerId);
  const challenge = session.currentChallenge;
  const publicPrompt = promptIsPublic(session);
  const prompt = challenge?.prompt ? localizePrompt(challenge.prompt) : undefined;
  const waiting = !prompt && (
    session.mode === "icebreaker" && session.phase === "spin_target" ||
    session.mode === "inner_circle" && ["preview_card", "replacement_preview"].includes(session.phase)
  );
  const guidance = adaptiveGuidance(session, active, target, hasAction, t);
  const milestoneAction = hasAction("choose_milestone_reward") ? "choose_milestone_reward" :
    hasAction("choose_ending") ? "choose_ending" : null;
  const freeMindsReward = session.mode === "date_night" &&
    session.dateVariant === "free_minds" &&
    session.revealedReward &&
    session.phase !== "choose_milestone_reward"
    ? session.revealedReward
    : null;

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
              <h2>{turnHeading(session, active.name, t)}</h2>
            </div>
            <p className="score-target">{targetCopy(session, t)}</p>
          </div>
          {session.mode === "classic"
            ? <ClassicProgress session={session} />
            : session.mode !== "inner_circle"
              ? <SharedMeter session={session} />
              : <ScorePanel session={session} />}
          <p className="points-guidance">{guidance}</p>
          {freeMindsReward && (
            <article className="reward-card milestone-reward-card">
              <p className="eyebrow">{t("Latest milestone reward")}</p>
              <p>{localizeReward(freeMindsReward).text}</p>
            </article>
          )}
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
              pending={pending}
              onAction={onAction}
            />
          )}
          {session.mode === "date_night" && milestoneAction && (
            <div className="ending-picker">
              <p className="eyebrow">{t(session.dateVariant === "free_minds" ? "Free Minds milestone reached" : "Shared milestone reached")}</p>
              <h3>{t(session.dateVariant === "free_minds" ? "Choose your milestone reward." : "How would you like to close tonight?")}</h3>
              <div className="ending-actions">
                <button className="primary-button" disabled={pending} onClick={() => onAction(milestoneAction, { endingType: "activity" })}>{t("Do Something Together")}</button>
                <button className="secondary-button" disabled={pending} onClick={() => onAction(milestoneAction, { endingType: "question" })}>{t("One More Meaningful Question")}</button>
              </div>
            </div>
          )}
          {session.mode === "classic" && session.phase === "classic_bonus_choice" && (
            <div className="ending-picker">
              <p className="eyebrow">{t("The 36 questions are complete")}</p>
              <h3>{t("Keep going with the bonus Classic deck?")}</h3>
              <div className="ending-actions">
                <button className="primary-button" disabled={pending || !hasAction("continue_bonus")} onClick={() => onAction("continue_bonus")}>{t("Continue with bonus prompts")}</button>
                <button className="secondary-button" disabled={pending || !hasAction("end_classic")} onClick={() => onAction("end_classic")}>{t("End Classic session")}</button>
              </div>
            </div>
          )}
          <ActionDock
            actions={session.mode === "classic" && session.phase === "classic_bonus_choice" ? [] : session.availableActions}
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
