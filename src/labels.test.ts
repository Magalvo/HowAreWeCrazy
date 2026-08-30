import { describe, expect, it } from "vitest";
import {
  audienceLabel,
  experienceLabel,
  isSeatedRoom,
  localAdaptiveViewerId,
  normalizeExperience,
  pairNames
} from "./labels";
import type { ActiveRoom, AdaptiveSession } from "./types";

function room(mode: ActiveRoom["mode"]): ActiveRoom {
  return { code: "PLAY5", mode, participantId: "p1", role: "host" };
}

describe("normalizeExperience", () => {
  it("maps the retired competitive name onto Inner Circle", () => {
    expect(normalizeExperience("competitive")).toBe("inner_circle");
  });

  it("falls back to conversation when no mode is given", () => {
    expect(normalizeExperience()).toBe("conversation");
    expect(normalizeExperience("")).toBe("conversation");
  });

  it("passes a known mode through untouched", () => {
    expect(normalizeExperience("date_night")).toBe("date_night");
  });
});

describe("experienceLabel", () => {
  it("labels both names Inner Circle shipped under the same way", () => {
    expect(experienceLabel("competitive")).toBe("Inner Circle");
    expect(experienceLabel("inner_circle")).toBe("Inner Circle");
  });

  it("falls back to Conversation for anything unrecognised", () => {
    expect(experienceLabel("something-else")).toBe("Conversation");
    expect(experienceLabel()).toBe("Conversation");
  });
});

describe("isSeatedRoom", () => {
  it("treats a conversation room and no room as unseated", () => {
    expect(isSeatedRoom(room("conversation"))).toBe(false);
    expect(isSeatedRoom(null)).toBe(false);
  });

  // A mode missing here authenticates as the host and the server refuses it, which is a
  // silent 403 rather than a type error, so every seated mode is named explicitly.
  it("recognises every seated mode, including caption and the retired name", () => {
    (["classic", "date_night", "inner_circle", "icebreaker", "competitive", "caption"] as const)
      .forEach((mode) => expect(isSeatedRoom(room(mode))).toBe(true));
  });
});

describe("pairNames", () => {
  it("splits on any of the separators players actually type", () => {
    expect(pairNames("Maya + Jordan")).toEqual(["Maya", "Jordan"]);
    expect(pairNames("Ana, Rui")).toEqual(["Ana", "Rui"]);
    expect(pairNames("Sam & Lee")).toEqual(["Sam", "Lee"]);
    expect(pairNames("Kim/Tom")).toEqual(["Kim", "Tom"]);
  });

  it("fills in the partners that were not named", () => {
    expect(pairNames("")).toEqual(["Partner 1", "Partner 2"]);
    expect(pairNames("Solo")).toEqual(["Solo", "Partner 2"]);
  });

  it("keeps only the first two names", () => {
    expect(pairNames("A + B + C")).toEqual(["A", "B"]);
  });
});

describe("localAdaptiveViewerId", () => {
  const players = [{ id: "one" }, { id: "two" }] as AdaptiveSession["players"];

  it("prefers the current responder, then the active player, then the first seat", () => {
    expect(localAdaptiveViewerId({ players, currentResponderId: "two", activePlayerId: "one" } as AdaptiveSession))
      .toBe("two");
    expect(localAdaptiveViewerId({ players, activePlayerId: "one" } as AdaptiveSession)).toBe("one");
    expect(localAdaptiveViewerId({ players } as AdaptiveSession)).toBe("one");
  });

  it("returns an empty id when there is nobody to view as", () => {
    expect(localAdaptiveViewerId({ players: [] } as unknown as AdaptiveSession)).toBe("");
  });
});

describe("audienceLabel", () => {
  it("names each audience", () => {
    expect(audienceLabel("couple")).toBe("two people");
    expect(audienceLabel("friends")).toBe("friends");
    expect(audienceLabel("group")).toBe("a group");
  });
});
