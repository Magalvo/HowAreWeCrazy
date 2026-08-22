import { useI18n } from "../../i18n-context";
import type { AdaptiveSession } from "../../types";

export function AdaptiveLobby({ session, hasAction, pending, onAction }: {
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
  if (session.mode === "classic") {
    title = "The classic two-person sequence.";
    copy = session.players.length === 1
      ? "Waiting for one partner to join the 36 questions."
      : "Both partners are here. The host can begin the Classic sequence.";
    action = "Start Classic";
  } else if (session.mode !== "date_night") {
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
          <span>{t("Style: {style}", { style: t(session.dateVariant === "free_minds" ? "Free Minds" : "Shared milestone") })}</span>
          <span>{t("Themes: {themes}", { themes: selectedThemes })}</span>
          <span>{t(session.promptFilters?.includeSpicy ? "Spicy prompts ON" : "Spicy prompts off")}</span>
        </div>
      )}
      <p className="safety-note">{t("Passing is always welcome. No explanation needed.")}</p>
      {hasAction("start_match") && <button className="primary-button" disabled={pending} onClick={() => onAction("start_match")}>{t(action)}</button>}
    </div>
  );
}
