import { levels, prompts } from "./game-data";
import type { Prompt } from "./types";

// A Table 4 Two on one phone draws from a deck the host never sees being built, so these
// prompts are pinned into it to keep the local pair experience complete.
export const LOCAL_DATE_REQUIRED_PROMPT_IDS = [
  "c01",
  "c08",
  "c09",
  "d106",
  "d108",
  "n03",
  "n12",
  "d210",
  "q118",
  "q111",
  "r07",
  "r12",
  "d311",
  "d315",
  "q121"
];

function baseDateNightPrompt(prompt: Prompt, includeSpicy: boolean): boolean {
  return prompt.audiences.includes("couple") &&
    (!prompt.experiences || prompt.experiences.includes("date_night")) &&
    (!prompt.isSpicy || includeSpicy);
}

export function matchesSelectedThemes(prompt: Prompt, selectedTags: string[]): boolean {
  return selectedTags.length === 0 || Boolean(prompt.tags?.some((tag) => selectedTags.includes(tag)));
}

export function dateNightThemeTags(includeSpicy: boolean): string[] {
  return [...new Set(prompts
    .filter((prompt) => baseDateNightPrompt(prompt, includeSpicy))
    .flatMap((prompt) => prompt.tags || []))]
    .sort((left, right) => left.localeCompare(right));
}

export function dateNightAvailability(selectedTags: string[], includeSpicy: boolean): Record<string, number> {
  return Object.fromEntries(levels.map((level) => [
    level.id,
    prompts.filter((prompt) =>
      prompt.level === level.id &&
      baseDateNightPrompt(prompt, includeSpicy) &&
      matchesSelectedThemes(prompt, selectedTags)
    ).length
  ]));
}
