import { describe, expect, it } from "vitest";
import { CAPTION_CARDS } from "../data/caption-cards.js";
import { hasCaptionTranslation, localizeCaption, translate } from "./i18n";
import type { CaptionCard } from "./types";

const captions = CAPTION_CARDS as CaptionCard[];

describe("caption translations", () => {
  // Adding a card without its translation is silent: the game keeps working and simply
  // shows English to a Portuguese player. This is the guard against that drift.
  it("covers every caption card in the deck", () => {
    const untranslated = captions
      .filter((card) => !hasCaptionTranslation(card.id, "pt-PT"))
      .map((card) => card.id);

    expect(untranslated).toEqual([]);
  });

  it("swaps the text and leaves the card's identity alone", () => {
    const card = captions[0];
    const translated = localizeCaption(card, "pt-PT");

    expect(translated.id).toBe(card.id);
    expect(translated.text).not.toBe(card.text);
    expect(translated.text.length).toBeGreaterThan(0);
  });

  it("leaves English alone", () => {
    const card = captions[0];

    expect(localizeCaption(card, "en")).toEqual(card);
  });

  it("keeps an unknown card readable rather than blanking it", () => {
    const unknown = { id: "cap-not-written-yet", text: "Untranslated line." };

    expect(localizeCaption(unknown, "pt-PT").text).toBe("Untranslated line.");
    expect(hasCaptionTranslation(unknown.id, "pt-PT")).toBe(false);
  });
});

describe("translate", () => {
  it("falls back to the English key when a phrase has no translation", () => {
    expect(translate("A phrase nobody has translated", "pt-PT")).toBe("A phrase nobody has translated");
  });

  it("fills placeholders in both languages", () => {
    expect(translate("Round {round}", "en", { round: 3 })).toBe("Round 3");
    expect(translate("Round {round}", "pt-PT", { round: 3 })).toBe("Ronda 3");
  });
});
