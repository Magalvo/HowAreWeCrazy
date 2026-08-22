import { useI18n } from "../i18n-context";
import type { Prompt } from "../types";

export function PromptFlairs({ prompt }: { prompt: Prompt }) {
  const { t, tag } = useI18n();
  if (!prompt.tags?.length) {
    return null;
  }
  return (
    <div className="prompt-flairs" aria-label={t("Prompt themes")}>
      {prompt.tags.map((themeTag) => <span className="prompt-flair" key={themeTag}>{tag(themeTag)}</span>)}
    </div>
  );
}
