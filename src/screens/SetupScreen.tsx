import type { FormEvent } from "react";
import { levels } from "../game-data";
import { useI18n } from "../i18n-context";
import { experienceLabel } from "../labels";
import type { PlayMode, SetupState } from "../types";

const LOCAL_FORMATS = [
  ["conversation", "Unscored", "Conversation", "A gentle shared deck for open conversation."],
  ["classic", "2 players | Guided", "Classic", "The 36 questions, then an optional deeper bonus set."],
  ["date_night", "2 players | Shared goal", "A Table 4 Two", "Build a connection milestone together."]
] as const;

const ROOM_EXPERIENCES = [
  ["conversation", "Any group | Unscored", "Conversation", "A gentle shared deck for open conversation."],
  ["classic", "2 players | Guided", "Classic", "The 36 questions, then an optional deeper bonus set."],
  ["date_night", "2 players | Shared goal", "A Table 4 Two", "Build a connection milestone together."],
  ["inner_circle", "3-6 friends | Points", "Inner Circle", "Playfully compete with balanced targeting."],
  ["icebreaker", "3-6 players | Shared goal", "Icebreaker", "Meet the room through fair roulette."],
  ["caption", "2-8 players | Your rules", "Caption Clash", "Match images to captions, judged or just for fun."]
] as const;

const CAPTION_DIRECTIONS = [
  ["image", "Caption the image", "An image goes on the table. Everyone answers with a caption card."],
  ["caption", "Match the caption", "A caption goes on the table. Everyone answers with an image card."]
] as const;

const CAPTION_FORMATS = [
  ["judged", "With a judge", "3-8 players. A rotating judge picks the best answer and scores it."],
  ["free", "Just for fun", "From 2 players. Nobody judges, nothing is scored, you just show each other."]
] as const;

const DATE_VARIANTS = [
  ["classic", "Shared milestone", "Reach 20 points, choose a closing reward, and end on that moment."],
  ["free_minds", "Free Minds", "Unlock rewards at milestones, then keep playing until the questions run out."]
] as const;

export function SetupScreen({
  setup,
  sessionActive,
  resumeText,
  dateNightTags,
  dateNightCounts,
  dateNightFiltersValid,
  onChange,
  onPlayMode,
  onThemeTag,
  onResume,
  onDiscard,
  onSubmit,
  onJoin
}: {
  setup: SetupState;
  sessionActive: boolean;
  resumeText: string;
  dateNightTags: string[];
  dateNightCounts: Record<string, number>;
  dateNightFiltersValid: boolean;
  onChange: (patch: Partial<SetupState>) => void;
  onPlayMode: (value: PlayMode) => void;
  onThemeTag: (value: string) => void;
  onResume: () => void;
  onDiscard: () => void;
  onSubmit: (event: FormEvent) => void;
  onJoin: (event: FormEvent) => void;
}) {
  const { t, tag } = useI18n();
  const adaptive = setup.playMode === "host" && setup.roomMode !== "conversation" ||
    setup.playMode === "local" && ["classic", "date_night"].includes(setup.roomMode);
  const helper = {
    conversation: "Everyone follows one shared deck. No scores, only space to answer or pass.",
    classic: "The 36 questions, then an optional deeper bonus set.",
    date_night: setup.dateVariant === "free_minds"
      ? "Milestones unlock rewards, then the questions keep going until the deck is complete."
      : "Work together toward a shared milestone, then choose a closing moment.",
    inner_circle: "Private draws and points stay playful through balanced target cooldowns.",
    icebreaker: "A fair spin chooses responders while everyone builds group progress.",
    caption: setup.captionJudged
      ? "A rotating judge picks the best answer each round. Images load from the internet."
      : "Nobody judges and nothing is scored. Images load from the internet."
  }[setup.roomMode];
  const startText = adaptive
    ? setup.playMode === "host"
      ? t("Create {experience} room", { experience: experienceLabel(setup.roomMode) })
      : t("Start {experience}", { experience: experienceLabel(setup.roomMode) })
    : setup.playMode === "host" ? t("Create live room") : t("Start the conversation");
  const dateNightThemeInvalid = setup.playMode !== "join" &&
    setup.roomMode === "date_night" &&
    !dateNightFiltersValid;
  const showDateNightPanels = (setup.playMode === "host" || setup.playMode === "local") &&
    setup.roomMode === "date_night";

  return (
    <section className="screen setup-screen" aria-labelledby="welcome-title">
      <p className="eyebrow">{t("Conversation card game")}</p>
      <h1 id="welcome-title">{t("Get closer, one honest question at a time.")}</h1>
      <p className="lede">{t("Play from one phone or create a room so every player can follow along on their own screen across three levels.")}</p>
      {sessionActive && (
        <div className="resume-card">
          <p className="eyebrow">{t("Session in progress")}</p>
          <p>{resumeText}</p>
          <div className="button-row">
            <button className="primary-button" onClick={onResume}>{t("Resume game")}</button>
            <button className="text-button" onClick={onDiscard}>{t("Start over")}</button>
          </div>
        </div>
      )}
      <fieldset className="play-mode">
        <legend>{t("How are you playing?")}</legend>
        <div className="mode-grid">
          {([["local", "One phone"], ["host", "Host room"], ["join", "Join room"]] as const).map(([value, label]) => (
            <label className="mode-choice" key={value}>
              <input type="radio" name="playMode" checked={setup.playMode === value} onChange={() => onPlayMode(value)} />
              <span>{t(label)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {setup.playMode !== "join" ? (
        <form className="setup-form" onSubmit={onSubmit}>
          {!adaptive && (
            <fieldset>
              <legend>{t("Who is playing?")}</legend>
              <div className="choice-grid">
                {([["couple", "Two people", "Dates or partners"], ["friends", "Friends", "New or longtime"], ["group", "Group", "Three or more"]] as const).map(([value, title, copy]) => (
                  <label className="choice" key={value}>
                    <input type="radio" checked={setup.audience === value} onChange={() => onChange({ audience: value })} />
                    <span className="choice-title">{t(title)}</span>
                    <span className="choice-copy">{t(copy)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <label className="field">
            <span>{t("Names or table name")} <small>({t("optional")})</small></span>
            <input value={setup.playerNames} onChange={(event) => onChange({ playerNames: event.target.value })} maxLength={42} placeholder="Maya + Jordan" />
          </label>
          {setup.playMode === "host" && (
            <label className="field">
              <span>{t("Your name")} <small>({t("shown in the room")})</small></span>
              <input value={setup.hostName} onChange={(event) => onChange({ hostName: event.target.value })} maxLength={28} placeholder="Maya" />
            </label>
          )}
          {setup.playMode === "local" && (
            <fieldset>
              <legend>{t("Choose a format")}</legend>
              <div className="rule-grid">
                {LOCAL_FORMATS.map(([value, meta, title, copy]) => (
                  <label className="rule-choice" key={value}>
                    <input type="radio" checked={setup.roomMode === value} onChange={() => onChange({ roomMode: value })} />
                    <span className="rule-meta">{t(meta)}</span>
                    <span className="choice-title">{t(title)}</span>
                    <span className="choice-copy">{t(copy)}</span>
                  </label>
                ))}
              </div>
              <p className="experience-helper">{t(helper)}</p>
            </fieldset>
          )}
          {setup.playMode === "host" && (
            <fieldset>
              <legend>{t("Choose an experience")}</legend>
              <div className="rule-grid">
                {ROOM_EXPERIENCES.map(([value, meta, title, copy]) => (
                  <label className="rule-choice" key={value}>
                    <input type="radio" checked={setup.roomMode === value} onChange={() => onChange({ roomMode: value })} />
                    <span className="rule-meta">{t(meta)}</span>
                    <span className="choice-title">{t(title)}</span>
                    <span className="choice-copy">{t(copy)}</span>
                  </label>
                ))}
              </div>
              <p className="experience-helper">{t(helper)}</p>
            </fieldset>
          )}
          {setup.playMode === "host" && setup.roomMode === "caption" && (
            <fieldset className="date-variant-panel">
              <legend>{t("Which way round?")}</legend>
              <div className="rule-grid compact">
                {CAPTION_DIRECTIONS.map(([value, title, copy]) => (
                  <label className="rule-choice" key={value}>
                    <input
                      type="radio"
                      checked={setup.captionPromptKind === value}
                      onChange={() => onChange({ captionPromptKind: value })}
                    />
                    <span className="choice-title">{t(title)}</span>
                    <span className="choice-copy">{t(copy)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {setup.playMode === "host" && setup.roomMode === "caption" && (
            <fieldset className="date-variant-panel">
              <legend>{t("How are you keeping score?")}</legend>
              <div className="rule-grid compact">
                {CAPTION_FORMATS.map(([value, title, copy]) => (
                  <label className="rule-choice" key={value}>
                    <input
                      type="radio"
                      checked={setup.captionJudged === (value === "judged")}
                      onChange={() => onChange({ captionJudged: value === "judged" })}
                    />
                    <span className="choice-title">{t(title)}</span>
                    <span className="choice-copy">{t(copy)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {showDateNightPanels && (
            <fieldset className="date-variant-panel">
              <legend>{t("A Table 4 Two style")}</legend>
              <div className="rule-grid compact">
                {DATE_VARIANTS.map(([value, title, copy]) => (
                  <label className="rule-choice" key={value}>
                    <input
                      type="radio"
                      checked={setup.dateVariant === value}
                      onChange={() => onChange({ dateVariant: value })}
                    />
                    <span className="choice-title">{t(title)}</span>
                    <span className="choice-copy">{t(copy)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {showDateNightPanels && (
            <fieldset className="theme-panel">
              <legend>{t("Choose your themes")}</legend>
              <div className="theme-heading">
                <p>{t("Leave everything open, or pick any themes you want this A Table 4 Two deck to include.")}</p>
                {setup.selectedThemeTags.length > 0 && (
                  <button className="text-button" type="button" onClick={() => onChange({ selectedThemeTags: [] })}>{t("All themes")}</button>
                )}
              </div>
              <div className="theme-chip-list" aria-label="A Table 4 Two themes">
                {dateNightTags.map((themeTag) => {
                  const selected = setup.selectedThemeTags.includes(themeTag);
                  return (
                    <button
                      className={`theme-chip${selected ? " is-selected" : ""}`}
                      key={themeTag}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onThemeTag(themeTag)}
                    >
                      {tag(themeTag)}
                    </button>
                  );
                })}
              </div>
              <label className="spicy-toggle">
                <input
                  type="checkbox"
                  checked={setup.includeSpicy}
                  onChange={(event) => onChange({ includeSpicy: event.target.checked })}
                />
                <span>
                  {t("Spicy cards")}
                  <small>{t("Opt-in only. These are more provocative and are still pass-friendly.")}</small>
                </span>
              </label>
              <div className="theme-counts" aria-label={t("Available prompts by level")}>
                {levels.map((level) => {
                  const count = dateNightCounts[level.id] || 0;
                  return <span className={count < 2 ? "is-low" : ""} key={level.id}>{t(level.name)}: {count}</span>;
                })}
              </div>
              <p className="theme-status">
                {setup.selectedThemeTags.length === 0
                  ? t("All themes selected.")
                  : t("Selected: {themes}.", { themes: setup.selectedThemeTags.map((item) => tag(item)).join(", ") })}
              </p>
              {dateNightThemeInvalid && (
                <p className="theme-warning">{t("Choose broader themes. A Table 4 Two needs at least 2 prompts in every level.")}</p>
              )}
            </fieldset>
          )}
          {!adaptive && (
            <label className="field">
              <span>{t("Cards per level")}</span>
              <select value={setup.cardsPerLevel} onChange={(event) => onChange({ cardsPerLevel: Number(event.target.value) })}>
                <option value={4}>{t("Quick round - 12 cards")}</option>
                <option value={6}>{t("Full round - 18 cards")}</option>
                <option value={8}>{t("Long round - 24 cards")}</option>
              </select>
            </label>
          )}
          <label className="agreement">
            <input type="checkbox" required checked={setup.agreement} onChange={(event) => onChange({ agreement: event.target.checked })} />
            <span>{t("We agree anyone can pass on a card, without explaining why.")}</span>
          </label>
          <button className="primary-button start-button" type="submit" disabled={dateNightThemeInvalid}>{startText}</button>
        </form>
      ) : (
        <form className="setup-form join-form" onSubmit={onJoin}>
          <label className="field">
            <span>{t("Room code")}</span>
            <input value={setup.joinCode} onChange={(event) => onChange({ joinCode: event.target.value })} maxLength={5} placeholder="AB123" required />
          </label>
          <label className="field">
            <span>{t("Your name")} <small>({t("optional")})</small></span>
            <input value={setup.joinName} onChange={(event) => onChange({ joinName: event.target.value })} maxLength={28} placeholder="Jordan" />
          </label>
          <label className="agreement">
            <input type="checkbox" required checked={setup.joinAgreement} onChange={(event) => onChange({ joinAgreement: event.target.checked })} />
            <span>{t("I agree anyone can pass on a card, without explaining why.")}</span>
          </label>
          <button className="primary-button start-button" type="submit">{t("Join conversation")}</button>
        </form>
      )}
    </section>
  );
}
