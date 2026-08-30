import { describe, expect, it } from "vitest";
import { dateNightAvailability, dateNightThemeTags } from "./date-night";
import { levels } from "./game-data";

describe("dateNightThemeTags", () => {
  it("returns a sorted set with no repeats", () => {
    const tags = dateNightThemeTags(false);

    expect(tags.length).toBeGreaterThan(0);
    expect(new Set(tags).size).toBe(tags.length);
    expect([...tags].sort((left, right) => left.localeCompare(right))).toEqual(tags);
  });

  it("never offers fewer themes once spicy cards are opted into", () => {
    const withoutSpicy = dateNightThemeTags(false);
    const withSpicy = dateNightThemeTags(true);

    withoutSpicy.forEach((tag) => expect(withSpicy).toContain(tag));
  });
});

describe("dateNightAvailability", () => {
  it("counts every level so the setup screen can warn per level", () => {
    const counts = dateNightAvailability([], false);

    expect(Object.keys(counts).sort()).toEqual(levels.map((level) => level.id).sort());
  });

  it("offers at least two prompts per level when no theme is selected", () => {
    const counts = dateNightAvailability([], false);

    levels.forEach((level) => expect(counts[level.id]).toBeGreaterThanOrEqual(2));
  });

  it("narrows the deck when a theme is selected", () => {
    const all = dateNightAvailability([], false);
    const narrowed = dateNightAvailability([dateNightThemeTags(false)[0]], false);

    levels.forEach((level) => expect(narrowed[level.id]).toBeLessThanOrEqual(all[level.id]));
    const total = (counts: Record<string, number>) =>
      Object.values(counts).reduce((sum, count) => sum + count, 0);
    expect(total(narrowed)).toBeLessThan(total(all));
  });

  it("never shrinks the deck by opting into spicy cards", () => {
    const withoutSpicy = dateNightAvailability([], false);
    const withSpicy = dateNightAvailability([], true);

    levels.forEach((level) => expect(withSpicy[level.id]).toBeGreaterThanOrEqual(withoutSpicy[level.id]));
  });
});
