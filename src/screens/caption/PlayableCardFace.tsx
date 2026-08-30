import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n-context";
import { isImageCard, type PlayableCard } from "../../types";

/**
 * One card, whichever way round the game is being played.
 *
 * The image is deliberately not lazy-loaded. It is hidden with display:none until it
 * arrives, and a lazy image inside a hidden box is never considered near the viewport, so
 * the browser would wait for a reveal that only its own arrival can trigger.
 *
 * A caption card is text the project owns and can render instantly. An image card is
 * fetched from a third-party host while the round is in progress, so it carries its
 * loading and failed states rather than leaving a blank frame: a card nobody can see is a
 * card nobody can play.
 */
export function PlayableCardFace({ card, size = "hand" }: {
  card: PlayableCard | null;
  size?: "hand" | "stage";
}) {
  const { caption, t } = useI18n();
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const imageRef = useRef<HTMLImageElement | null>(null);
  const url = isImageCard(card) ? card.url : null;

  useEffect(() => {
    // A cached image can finish before this effect resets the state, so its load event is
    // missed and the card sits on "loading" forever. Asking the element whether it is
    // already complete closes that race.
    const node = imageRef.current;
    if (node?.complete) {
      setState(node.naturalWidth > 0 ? "ready" : "failed");
      return;
    }
    setState("loading");
  }, [url]);

  if (!card) {
    return null;
  }

  if (!isImageCard(card)) {
    return <span className={`card-face is-text is-${size}`}>{caption(card).text}</span>;
  }

  return (
    <span className={`card-face is-image is-${size} is-${state}`}>
      {state !== "failed" && (
        <img
          ref={imageRef}
          src={card.url}
          alt={t("Meme image: {name}", { name: card.name })}
          width={card.width}
          height={card.height}
          onLoad={() => setState("ready")}
          onError={() => setState("failed")}
        />
      )}
      {state === "loading" && <span className="card-face-note">{t("Loading the image...")}</span>}
      {state === "failed" && (
        <span className="card-face-note is-failed">
          {t("Image unavailable")}
          <strong>{card.name}</strong>
        </span>
      )}
    </span>
  );
}
