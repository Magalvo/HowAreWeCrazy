import { useI18n } from "../../i18n-context";
import type { AdaptiveSession } from "../../types";
import { ScorePanel } from "./AdaptiveProgress";

interface ResultsCopy {
  title: string;
  titleValues: Record<string, string | number>;
  copy: string;
}

function resultsCopy(session: AdaptiveSession): ResultsCopy {
  if (session.mode === "inner_circle") {
    const winners = (session.winnerIds || [])
      .map((id) => session.players.find((item) => item.id === id)?.name)
      .filter(Boolean)
      .join(" & ");
    const tied = (session.winnerIds?.length || 0) > 1;
    return {
      title: tied ? "{winners} tie." : "{winner} wins.",
      titleValues: tied ? { winners } : { winner: winners },
      copy: session.endReason === "score_target"
        ? "The first player reached 21 points."
        : "The prompts are complete. Highest score takes the match."
    };
  }
  if (session.mode === "classic") {
    return {
      title: session.endReason === "classic_complete"
        ? "You completed the Classic sequence."
        : session.endReason === "classic_arons_complete"
          ? "You completed the 36 questions."
          : "Classic session ended.",
      titleValues: {},
      copy: session.endReason === "classic_complete"
        ? "You finished the 36 questions and the bonus Classic prompts."
        : session.endReason === "classic_arons_complete"
          ? "You finished Arthur Aron's 36 questions and chose to close there."
          : "You ended after {score} Classic prompts."
    };
  }
  if (session.mode === "date_night") {
    return {
      title: session.endReason === "milestone"
        ? "You reached a shared milestone."
        : "Thank you for meeting each other here.",
      titleValues: {},
      copy: session.endReason === "milestone"
        ? "Together you reached {score} connection points and explored every depth."
        : "You reached {score} connection points before this deck ended."
    };
  }
  return {
    title: session.endReason === "score_target" ? "Your group reached the goal." : "That was a good round.",
    titleValues: {},
    copy: session.endReason === "score_target"
      ? "Together you built {score} points of group connection."
      : "Your group built {score} points before the available prompts ended."
  };
}

export function AdaptiveResults({ session, onLeave }: { session: AdaptiveSession; onLeave: () => void }) {
  const { reward, t } = useI18n();
  const { title, titleValues, copy } = resultsCopy(session);
  const score = session.mode === "classic"
    ? session.classicIndex || 0
    : session.mode === "date_night" ? session.connectionScore || 0 : session.groupScore || 0;
  const revealedReward = session.revealedReward ? reward(session.revealedReward) : null;
  return (
    <div className="points-results">
      <p className="eyebrow">{t("Experience complete")}</p>
      <h2>{t(title, titleValues)}</h2>
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
