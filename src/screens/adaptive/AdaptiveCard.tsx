import { useState } from "react";
import { PromptFlairs } from "../../components/PromptFlairs";
import { levelById, levels, points } from "../../game-data";
import { useI18n } from "../../i18n-context";
import type { AdaptivePlayer, AdaptiveSession, Prompt, RoomSnapshot } from "../../types";

const ACTION_CONTROLS: Array<[string, string, string]> = [
  ["next_prompt", "Next prompt", "primary-button"],
  ["spin_target", "Spin for responder", "primary-button"],
  ["complete", "Completed", "primary-button"],
  ["pass", "Pass", "secondary-button"],
  ["continue_bonus", "Continue with bonus prompts", "primary-button"],
  ["end_classic", "End Classic session", "secondary-button"],
  ["bailout", "Bailout", "text-button bailout-button"],
  ["claim", "Claim this prompt", "primary-button"],
  ["discard", "Discard", "secondary-button"],
  ["skip_stalled_turn", "Skip stalled turn", "text-button"]
];

export function LevelPicker({ session, viewer, pending, onAction }: {
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

export function ChallengeCard({ session, snapshot, publicPrompt, prompt, challenge, pending, onAction }: {
  session: AdaptiveSession;
  snapshot: RoomSnapshot<AdaptiveSession>;
  publicPrompt: boolean;
  prompt: Prompt;
  challenge: NonNullable<AdaptiveSession["currentChallenge"]>;
  pending: boolean;
  onAction: (action: string, payload?: Record<string, unknown>) => void;
}) {
  const { level: localizeLevel, t } = useI18n();
  const level = levelById(challenge.levelId);
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

export function ActionDock({ actions, prompt, canSave, saved, pending, onAction, onSave }: {
  actions: string[];
  prompt?: Prompt;
  canSave: boolean;
  saved: boolean;
  pending: boolean;
  onAction: (action: string) => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  if (!ACTION_CONTROLS.some(([action]) => actions.includes(action)) && !canSave) return null;
  return (
    <div className="points-actions action-dock">
      {ACTION_CONTROLS.filter(([action]) => actions.includes(action)).map(([action, label, className]) => (
        <button className={className} key={action} disabled={pending} onClick={() => onAction(action)}>{t(label)}</button>
      ))}
      {canSave && prompt && (
        <button className={`secondary-button${saved ? " is-saved" : ""}`} onClick={onSave}>{saved ? t("Saved") : t("Save card")}</button>
      )}
    </div>
  );
}
