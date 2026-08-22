import { PromptFlairs } from "../components/PromptFlairs";
import { levelById, promptById } from "../game-data";
import { useI18n } from "../i18n-context";
import type { Level, Prompt } from "../types";

export function LibraryScreen({ savedIds, onClose, onRemove, onClear }: {
  savedIds: string[];
  onClose: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const { level: localizeLevel, prompt: localizePrompt, t } = useI18n();
  const saved = savedIds
    .map((id) => promptById(id))
    .filter((prompt): prompt is Prompt => Boolean(prompt))
    .map((prompt) => localizePrompt(prompt));
  return (
    <section className="screen library-screen" aria-labelledby="library-title">
      <div className="library-header">
        <div><p className="eyebrow">{t("Your collection")}</p><h2 id="library-title">{t("Saved cards")}</h2></div>
        <button className="ghost-button" onClick={onClose}>{t("Close")}</button>
      </div>
      {!saved.length && <p className="empty-state">{t("Cards you save during play will appear here.")}</p>}
      <div className="saved-grid">
        {saved.map((prompt) => (
          <article className="saved-card" key={prompt.id}>
            <p className="eyebrow">{localizeLevel(levelById(prompt.level) as Level).name}</p>
            <p>{prompt.text}</p>
            <PromptFlairs prompt={prompt} />
            <button className="text-button" onClick={() => onRemove(prompt.id)}>{t("Remove")}</button>
          </article>
        ))}
      </div>
      {Boolean(saved.length) && <button className="text-button clear-button" onClick={onClear}>{t("Clear saved cards")}</button>}
    </section>
  );
}
