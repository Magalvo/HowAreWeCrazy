import { useEffect, useState } from "react";
import { useI18n } from "../../i18n-context";
import type { MemeImage } from "../../types";

/**
 * The image card on the table.
 *
 * Unlike every other card in this project, this one is fetched from a third-party host at
 * play time, so it can be slow or simply not arrive. Both states are shown rather than
 * left as an empty frame: a round is unplayable until everyone can see the picture.
 */
export function MemeStage({ image }: { image: MemeImage | null }) {
  const { t } = useI18n();
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    setState("loading");
  }, [image?.url]);

  if (!image) {
    return null;
  }

  return (
    <div className={`meme-stage is-${state}`}>
      {state !== "failed" && (
        <img
          src={image.url}
          alt={t("Meme image: {name}", { name: image.name })}
          width={image.width}
          height={image.height}
          onLoad={() => setState("ready")}
          onError={() => setState("failed")}
        />
      )}
      {state === "loading" && (
        <p className="meme-stage-note" role="status">{t("Loading the image...")}</p>
      )}
      {state === "failed" && (
        <div className="meme-stage-fallback">
          <p className="eyebrow">{t("Image unavailable")}</p>
          <p>{image.name}</p>
          <p className="meme-stage-note">{t("Play the round on the title, or skip to the next image.")}</p>
        </div>
      )}
    </div>
  );
}
