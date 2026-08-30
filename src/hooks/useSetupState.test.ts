import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The card data happens to expose the same themes with and without spicy prompts, so it
// cannot exercise the pruning branch. Driving the theme list from here covers the hook's
// own behaviour and keeps these tests independent of the deck's contents.
const themesBySpicy = { open: ["Future", "Romance"], spicy: ["Future", "Romance", "Heat"] };
let availability = { curiosity: 6, connection: 6, reflection: 6 };

vi.mock("../date-night", () => ({
  dateNightThemeTags: (includeSpicy: boolean) =>
    includeSpicy ? themesBySpicy.spicy : themesBySpicy.open,
  dateNightAvailability: () => availability
}));

const { useSetupState } = await import("./useSetupState");

describe("useSetupState", () => {
  beforeEach(() => {
    availability = { curiosity: 6, connection: 6, reflection: 6 };
  });

  it("starts on one phone when the player arrived without an invite", () => {
    const { result } = renderHook(() => useSetupState(""));

    expect(result.current.setup.playMode).toBe("local");
    expect(result.current.setup.joinCode).toBe("");
  });

  it("opens on the join form with the code filled in when following an invite", () => {
    const { result } = renderHook(() => useSetupState("AB123"));

    expect(result.current.setup.playMode).toBe("join");
    expect(result.current.setup.joinCode).toBe("AB123");
  });

  it("drops back to conversation when a room-only experience cannot run on one phone", () => {
    const { result } = renderHook(() => useSetupState(""));

    act(() => result.current.update({ roomMode: "inner_circle" }));
    act(() => result.current.choosePlayMode("local"));

    expect(result.current.setup.roomMode).toBe("conversation");
  });

  it("keeps an experience that one phone can run", () => {
    const { result } = renderHook(() => useSetupState(""));

    act(() => result.current.update({ roomMode: "date_night" }));
    act(() => result.current.choosePlayMode("local"));

    expect(result.current.setup.roomMode).toBe("date_night");
  });

  it("keeps a room-only experience when hosting", () => {
    const { result } = renderHook(() => useSetupState(""));

    act(() => result.current.update({ roomMode: "icebreaker" }));
    act(() => result.current.choosePlayMode("host"));

    expect(result.current.setup.roomMode).toBe("icebreaker");
  });

  it("adds and removes selected themes", () => {
    const { result } = renderHook(() => useSetupState(""));

    act(() => result.current.toggleThemeTag("Future"));
    expect(result.current.setup.selectedThemeTags).toEqual(["Future"]);

    act(() => result.current.toggleThemeTag("Romance"));
    expect(result.current.setup.selectedThemeTags).toEqual(["Future", "Romance"]);

    act(() => result.current.toggleThemeTag("Future"));
    expect(result.current.setup.selectedThemeTags).toEqual(["Romance"]);
  });

  it("releases a selected theme that stops being offered", () => {
    const { result } = renderHook(() => useSetupState(""));

    act(() => result.current.update({ includeSpicy: true }));
    act(() => result.current.toggleThemeTag("Heat"));
    act(() => result.current.toggleThemeTag("Future"));
    expect(result.current.setup.selectedThemeTags).toEqual(["Heat", "Future"]);

    act(() => result.current.update({ includeSpicy: false }));

    expect(result.current.setup.selectedThemeTags).toEqual(["Future"]);
  });

  it("reports the filters as invalid when a level runs short of prompts", () => {
    const { result, rerender } = renderHook(() => useSetupState(""));
    expect(result.current.dateNightFiltersValid).toBe(true);

    availability = { curiosity: 6, connection: 1, reflection: 6 };
    act(() => result.current.update({ selectedThemeTags: ["Future"] }));
    rerender();

    expect(result.current.dateNightFiltersValid).toBe(false);
  });
});
