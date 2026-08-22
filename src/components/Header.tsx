import { useState } from "react";
import TwotoneBookmarkIcon from "@iconify-react/ic/twotone-bookmark";
import FlagPortugalIcon from "@iconify-react/twemoji/flag-portugal";
import FlagUnitedKingdomIcon from "@iconify-react/twemoji/flag-united-kingdom";
import { useI18n } from "../i18n-context";
import { LANGUAGES, type Language } from "../i18n";

export function Header({
  savedCount,
  language,
  onHome,
  onLibrary,
  onLanguage
}: {
  savedCount: number;
  language: Language;
  onHome: () => void;
  onLibrary: () => void;
  onLanguage: (language: Language) => void;
}) {
  const { t } = useI18n();
  const [languageOpen, setLanguageOpen] = useState(false);
  const CurrentFlagIcon = language === "pt-PT" ? FlagPortugalIcon : FlagUnitedKingdomIcon;
  return (
    <header className="topbar">
      <button className="brand" aria-label="Return to setup" onClick={onHome}>
        <span className="brand-mark" aria-hidden="true" />
        <span>How Are We Crazy</span>
      </button>
      <div className="topbar-actions">
        <div className="language-menu">
          <button
            className="language-trigger"
            type="button"
            aria-expanded={languageOpen}
            aria-haspopup="menu"
            aria-label="Language"
            onClick={() => setLanguageOpen((open) => !open)}
          >
            <CurrentFlagIcon className="language-flag" aria-hidden="true" />
            <span>{language === "pt-PT" ? "PT" : "EN"}</span>
            <span className="language-chevron" aria-hidden="true" />
          </button>
          {languageOpen && (
            <div className="language-popover" role="menu">
              {LANGUAGES.map((item) => {
                const selected = language === item.code;
                const FlagIcon = item.code === "pt-PT" ? FlagPortugalIcon : FlagUnitedKingdomIcon;
                return (
                  <button
                    className={`language-option${selected ? " is-selected" : ""}`}
                    key={item.code}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => {
                      onLanguage(item.code);
                      setLanguageOpen(false);
                    }}
                  >
                    <FlagIcon className="language-flag" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <button className="saved-button" aria-label={t("Open saved cards")} title={t("Saved cards")} onClick={onLibrary}>
          <TwotoneBookmarkIcon className="bookmark-icon" aria-hidden="true" />
          <span className="saved-count" aria-hidden="true">{savedCount}</span>
        </button>
      </div>
    </header>
  );
}
