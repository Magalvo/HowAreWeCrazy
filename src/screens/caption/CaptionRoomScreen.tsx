import { useI18n } from "../../i18n-context";
import type { CaptionPlayer, CaptionSession } from "../../types";
import { PlayableCardFace } from "./PlayableCardFace";

type Action = (action: string, payload?: Record<string, unknown>) => void;

function nameOf(session: CaptionSession, playerId?: string | null) {
  return session.players.find((item) => item.id === playerId)?.name || "";
}

function Scoreboard({ session, final = false }: { session: CaptionSession; final?: boolean }) {
  const { t } = useI18n();
  const players = final
    ? [...session.players].sort((left, right) => right.score - left.score)
    : session.players;
  return (
    <div className={`scoreboard${final ? " final-scoreboard" : ""}`}>
      {players.map((item, index) => (
        <div className={`score-row${item.id === session.judgeId && !final ? " is-active" : ""}`} key={item.id}>
          <span className="score-position">
            {final ? `#${index + 1}` : item.id === session.judgeId ? t("Judge") : ""}
          </span>
          <span className="score-name">
            {item.name}
            {!item.connected && <span className="score-resources">{t("unavailable")}</span>}
          </span>
          <span className="score-points">{item.score} {item.score === 1 ? t("point") : t("points")}</span>
        </div>
      ))}
    </div>
  );
}

function Lobby({ session, pending, onAction }: {
  session: CaptionSession;
  pending: boolean;
  onAction: Action;
}) {
  const { t } = useI18n();
  const needed = Math.max(0, session.minPlayers - session.players.length);
  return (
    <div className="points-lobby">
      <p className="eyebrow">{t("Lobby")}</p>
      <h2>{session.judged ? t("Everyone plays. One of you judges.") : t("Just the two of you. Nobody judges.")}</h2>
      <p className="lede">
        {needed > 0
          ? t("Waiting for {count} more before you begin.", { count: needed })
          : t("{count} players are in. The host can begin.", { count: session.players.length })}
      </p>
      <p className="safety-note">
        {session.promptKind === "image"
          ? t("An image goes on the table and you answer it with a caption.")
          : t("A caption goes on the table and you answer it with an image.")}
        {" "}
        {session.judged
          ? t("The judge picks the best answer. First to {target} points wins.", { target: session.scoreTarget })
          : t("There is no score. You play until the cards run out.")}
      </p>
      {session.availableActions.includes("start_match") && (
        <button className="primary-button" disabled={pending} onClick={() => onAction("start_match")}>
          {t("Start the game")}
        </button>
      )}
    </div>
  );
}

function Hand({ session, pending, onAction }: {
  session: CaptionSession;
  pending: boolean;
  onAction: Action;
}) {
  const { t } = useI18n();
  const mayPlay = session.availableActions.includes("submit_caption");
  const imageHand = session.promptKind === "caption";
  return (
    <div className="caption-hand">
      <p className="eyebrow">{mayPlay ? t("Your hand") : t("Your hand, this round is played")}</p>
      <div className={`caption-hand-list${imageHand ? " is-image-hand" : ""}`}>
        {session.hand.map((card) => (
          <button
            className="caption-card"
            key={card.id}
            type="button"
            disabled={!mayPlay || pending}
            onClick={() => onAction("submit_caption", { cardId: card.id })}
          >
            <PlayableCardFace card={card} />
          </button>
        ))}
      </div>
    </div>
  );
}

function WaitingOn({ session }: { session: CaptionSession }) {
  const { t } = useI18n();
  const waiting = session.awaitingPlayerIds.map((id) => nameOf(session, id)).filter(Boolean);
  if (waiting.length === 0) {
    return <p className="points-guidance">{t("Everyone has played.")}</p>;
  }
  return <p className="points-guidance">{t("Waiting on {names}.", { names: waiting.join(", ") })}</p>;
}

function Judging({ session, pending, onAction }: {
  session: CaptionSession;
  pending: boolean;
  onAction: Action;
}) {
  const { t } = useI18n();
  const mayJudge = session.availableActions.includes("choose_winner");
  const imageHand = session.promptKind === "caption";
  return (
    <div className="caption-reveal">
      <p className="points-guidance">
        {mayJudge
          ? t("You are judging. Pick the answer that fits best.")
          : t("{name} is choosing a winner.", { name: nameOf(session, session.judgeId) })}
      </p>
      <div className={`caption-reveal-list${imageHand ? " is-image-hand" : ""}`}>
        {session.reveal.map((entry) => (
          <button
            className="caption-card"
            key={entry.cardId}
            type="button"
            disabled={!mayJudge || pending}
            onClick={() => onAction("choose_winner", { cardId: entry.cardId })}
          >
            <PlayableCardFace card={entry.card} />
          </button>
        ))}
      </div>
    </div>
  );
}

function RoundOver({ session, pending, onAction }: {
  session: CaptionSession;
  pending: boolean;
  onAction: Action;
}) {
  const { t } = useI18n();
  const won = session.lastRound;
  const winning = session.reveal.find((entry) => entry.cardId === won?.winningCardId);
  const others = session.reveal.filter((entry) => entry.cardId !== won?.winningCardId);
  const viewerWon = won?.winnerId === session.viewerId;
  const imageHand = session.promptKind === "caption";
  return (
    <div className="caption-round-result">
      <p className="eyebrow">{t("Round {round}", { round: session.roundNumber })}</p>
      <h2>
        {!session.judged
          ? t("Here is what you both played.")
          : viewerWon
            ? t("Your card won.")
            : t("{name} wins the round.", { name: nameOf(session, won?.winnerId) })}
      </h2>
      {winning && (
        <article className="points-card">
          <PlayableCardFace card={winning.card} size="stage" />
        </article>
      )}
      <div className={`caption-reveal-list is-resolved${imageHand ? " is-image-hand" : ""}`}>
        {others.map((entry) => (
          <div className="caption-card is-static" key={entry.cardId}>
            <span className="caption-author">{nameOf(session, entry.playerId)}</span>
            <PlayableCardFace card={entry.card} />
          </div>
        ))}
      </div>
      {session.judged && <Scoreboard session={session} />}
      {session.availableActions.includes("next_round") && (
        <button className="primary-button" disabled={pending} onClick={() => onAction("next_round")}>
          {t("Next round")}
        </button>
      )}
    </div>
  );
}

function Results({ session, onLeave }: { session: CaptionSession; onLeave: () => void }) {
  const { t } = useI18n();
  const winners = session.winnerIds.map((id) => nameOf(session, id)).filter(Boolean).join(" & ");
  return (
    <div className="points-results">
      <p className="eyebrow">{t("Game complete")}</p>
      <h2>
        {!session.judged
          ? t("That is the whole deck.")
          : session.winnerIds.length > 1
            ? t("{winners} tie.", { winners })
            : t("{winner} wins.", { winner: winners })}
      </h2>
      <p className="lede">
        {session.endReason === "prompts_exhausted"
          ? t("The cards ran out.")
          : t("First to {target} points.", { target: session.scoreTarget })}
      </p>
      {session.judged && <Scoreboard session={session} final />}
      <button className="primary-button" onClick={onLeave}>{t("Leave room")}</button>
    </div>
  );
}

export function CaptionRoomScreen({
  session,
  roomCode,
  pending,
  onInvite,
  onAction,
  onLeave
}: {
  session: CaptionSession;
  roomCode: string;
  pending: boolean;
  onInvite: () => void;
  onAction: Action;
  onLeave: () => void;
}) {
  const { t } = useI18n();
  const playing = session.status === "playing";
  return (
    <section className="screen points-screen caption-screen" aria-live="polite">
      <aside className="room-banner">
        <div className="room-heading">
          <div>
            <p className="eyebrow">{t("Caption Clash")}</p>
            <p className="room-code">{roomCode}</p>
          </div>
          <button className="ghost-button" onClick={onInvite}>{t("Share invite")}</button>
        </div>
        <div className="participant-list">
          {session.players.map((participant: CaptionPlayer) => (
            <span
              className={`participant-chip${participant.connected ? "" : " is-offline"}${
                playing && session.submittedPlayerIds.includes(participant.id) ? " is-ready" : ""}`}
              key={participant.id}
            >
              {participant.name}
              {participant.id === session.judgeId && playing ? ` - ${t("judge")}` : ""}
              {participant.connected ? "" : ` - ${t("unavailable")}`}
            </span>
          ))}
        </div>
      </aside>

      {session.status === "lobby" && <Lobby session={session} pending={pending} onAction={onAction} />}

      {playing && (
        <div className="points-match">
          <div className="points-status">
            <div>
              <p className="eyebrow">{t("Round {round}", { round: session.roundNumber })}</p>
              <h2>
                {!session.judged
                  ? t("Play your answer")
                  : session.isJudge
                    ? t("You are the judge")
                    : t("{name} is judging", { name: nameOf(session, session.judgeId) })}
              </h2>
            </div>
            <p className="score-target">
              {session.judged ? t("First to {target}", { target: session.scoreTarget }) : t("Just for fun")}
            </p>
          </div>

          <article className="prompt-stage">
            <p className="eyebrow">{session.promptKind === "image" ? t("On the table") : t("Caption on the table")}</p>
            <PlayableCardFace card={session.prompt} size="stage" />
          </article>

          {session.phase === "submitting" && (
            <>
              {session.isJudge
                ? <WaitingOn session={session} />
                : session.availableActions.includes("submit_caption")
                  ? <p className="points-guidance">
                      {session.promptKind === "image"
                        ? t("Play the caption that fits this image best.")
                        : t("Play the image that fits this caption best.")}
                    </p>
                  : <WaitingOn session={session} />}
              {!session.isJudge && <Hand session={session} pending={pending} onAction={onAction} />}
            </>
          )}

          {session.phase === "judging" && <Judging session={session} pending={pending} onAction={onAction} />}

          {session.phase === "round_over" && <RoundOver session={session} pending={pending} onAction={onAction} />}

          {session.availableActions.includes("skip_stalled_round") && (
            <button className="text-button" disabled={pending} onClick={() => onAction("skip_stalled_round")}>
              {t("Skip stalled round")}
            </button>
          )}
        </div>
      )}

      {session.status === "finished" && <Results session={session} onLeave={onLeave} />}
    </section>
  );
}
