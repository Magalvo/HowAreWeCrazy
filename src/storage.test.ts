import { describe, expect, it, vi } from "vitest";
import { adoptLegacyStorage, loadJson, SAVED_KEY, saveJson } from "./storage";

describe("adoptLegacyStorage", () => {
  it("carries saved cards filed under the previous product name", () => {
    localStorage.setItem("open-thread.saved", JSON.stringify(["c01", "n03"]));

    adoptLegacyStorage();

    expect(loadJson<string[]>(SAVED_KEY)).toEqual(["c01", "n03"]);
    expect(localStorage.getItem("open-thread.saved")).toBeNull();
  });

  it("keeps what is already stored under the current name", () => {
    localStorage.setItem("open-thread.saved", JSON.stringify(["old"]));
    saveJson(SAVED_KEY, ["current"]);

    adoptLegacyStorage();

    expect(loadJson<string[]>(SAVED_KEY)).toEqual(["current"]);
    expect(localStorage.getItem("open-thread.saved")).toBeNull();
  });

  it("does nothing when there is nothing to carry", () => {
    adoptLegacyStorage();

    expect(localStorage.length).toBe(0);
  });

  it("survives storage being unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    expect(() => adoptLegacyStorage()).not.toThrow();
  });
});

describe("loadJson", () => {
  it("returns null rather than throwing on unreadable values", () => {
    localStorage.setItem(SAVED_KEY, "{not json");

    expect(loadJson(SAVED_KEY)).toBeNull();
  });
});
