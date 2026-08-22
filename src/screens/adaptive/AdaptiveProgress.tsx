import { levels } from "../../game-data";
import { useI18n } from "../../i18n-context";
import type { AdaptiveSession } from "../../types";

function classicAronSetName(index: number) {
  if (index <= 12) return "Set I";
  if (index <= 24) return "Set II";
  return "Set III";
}

export function ClassicProgress({ session }: { session: AdaptiveSession }) {
  const { t } = useI18n();
  const total = session.classicStage === "bonus"
    ? (session.classicIndex || 0) + (session.remainingByLevel?.bonus || 0)
    : 36;
  const current = Math.min(session.classicIndex || 0, total);
  const label = session.classicStage === "bonus" ? "Bonus prompts" : "Arthur Aron's 36 questions";
  return (
    <div className="shared-meter classic-progress">
      <div className="meter-copy">
        <span>{t(label)}</span>
        <strong>{current} / {total}</strong>
      </div>
      <div className="meter-track" aria-hidden="true"><span style={{ width: `${Math.min(100, (current / total) * 100)}%` }} /></div>
      <div className="level-progress">
        <span>{t("Section: {section}", { section: t(session.classicStage === "bonus" ? "Bonus" : classicAronSetName(current)) })}</span>
      </div>
    </div>
  );
}

export function SharedMeter({ session }: { session: AdaptiveSession }) {
  const { level: localizeLevel, t } = useI18n();
  const score = session.mode === "date_night" ? session.connectionScore || 0 : session.groupScore || 0;
  const target = session.mode === "date_night" && session.dateVariant === "free_minds"
    ? session.nextMilestoneScore || session.scoreTarget
    : session.scoreTarget;
  return (
    <div className="shared-meter">
      <div className="meter-copy">
        <span>{session.mode === "date_night" ? t("Connection Meter") : t("Group progress")}</span>
        <strong>{score} / {target}</strong>
      </div>
      <div className="meter-track" aria-hidden="true"><span style={{ width: `${Math.min(100, (score / target) * 100)}%` }} /></div>
      {session.mode === "date_night" && (
        <div className="level-progress">
          {levels.map((level) => <span key={level.id}>{localizeLevel(level).name}: {session.completedByLevel?.[level.id] || 0} / 2</span>)}
        </div>
      )}
    </div>
  );
}

export function ScorePanel({ session, final = false }: { session: AdaptiveSession; final?: boolean }) {
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
