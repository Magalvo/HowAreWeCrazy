import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { dateNightAvailability, dateNightThemeTags } from "./date-night";
import { levels } from "./game-data";
import { SAVED_KEY, SESSION_KEY } from "./storage";
import type { ConversationSession } from "./types";

async function startConversationOnOnePhone() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("checkbox", { name: /anyone can pass on a card/i }));
  await user.click(screen.getByRole("button", { name: "Start the conversation" }));
  return user;
}

// Before it is revealed the card is labelled for the action; afterwards its label is the
// prompt itself, which is how a test reads the text a player is looking at.
function faceDownCard() {
  return screen.getByRole("button", { name: "Reveal prompt card" });
}

beforeEach(() => {
  vi.stubGlobal("EventSource", class {
    addEventListener() {}
    close() {}
  });
});

describe("starting a conversation on one phone", () => {
  it("moves from setup to the first card", async () => {
    await startConversationOnOnePhone();

    expect(screen.getByText("Curiosity")).toBeInTheDocument();
    expect(screen.getByText("1 / 18")).toBeInTheDocument();
    expect(screen.getByText("Tap to reveal")).toBeInTheDocument();
  });

  it("reveals a card and advances to the next one", async () => {
    const user = await startConversationOnOnePhone();

    await user.click(faceDownCard());
    expect(screen.queryByText("Tap to reveal")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next card" }));

    expect(screen.getByText("2 / 18")).toBeInTheDocument();
    expect(screen.getByText("Tap to reveal")).toBeInTheDocument();
  });

  it("keeps the unfinished session so it can be resumed", async () => {
    const user = await startConversationOnOnePhone();
    await user.click(faceDownCard());
    await user.click(screen.getByRole("button", { name: "Next card" }));

    const stored = JSON.parse(localStorage.getItem(SESSION_KEY) || "null") as ConversationSession;

    expect(stored.cardIndex).toBe(1);
    expect(stored.completed).toBe(false);
  });

  it("cannot start without agreeing that anyone may pass", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Start the conversation" }));

    expect(screen.getByRole("button", { name: "Start the conversation" })).toBeInTheDocument();
    expect(screen.queryByText("Tap to reveal")).not.toBeInTheDocument();
  });
});

describe("saved cards", () => {
  it("saves the card on show and lists it in the collection", async () => {
    const user = await startConversationOnOnePhone();
    const card = faceDownCard();
    await user.click(card);
    const cardText = card.getAttribute("aria-label") as string;

    await user.click(screen.getByRole("button", { name: "Save card" }));
    await user.click(screen.getByRole("button", { name: "Open saved cards" }));

    expect(screen.getByRole("heading", { name: "Saved cards" })).toBeInTheDocument();
    expect(screen.getByText(cardText)).toBeInTheDocument();
  });

  it("returns to the game when the collection is closed", async () => {
    const user = await startConversationOnOnePhone();
    await user.click(faceDownCard());
    await user.click(screen.getByRole("button", { name: "Save card" }));

    await user.click(screen.getByRole("button", { name: "Open saved cards" }));
    expect(screen.getByRole("heading", { name: "Saved cards" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.getByText("1 / 18")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Saved cards" })).not.toBeInTheDocument();
  });

  it("returns to setup when the collection is opened from setup", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open saved cards" }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.getByRole("button", { name: "Start the conversation" })).toBeInTheDocument();
  });

  it("counts saved cards in the header and forgets them on request", async () => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(["c01", "n03"]));
    const user = userEvent.setup();
    render(<App />);

    const savedButton = screen.getByRole("button", { name: "Open saved cards" });
    expect(within(savedButton).getByText("2")).toBeInTheDocument();

    await user.click(savedButton);
    await user.click(screen.getByRole("button", { name: "Clear saved cards" }));

    expect(screen.getByText("Cards you save during play will appear here.")).toBeInTheDocument();
  });
});

describe("choosing A Table 4 Two on one phone", () => {
  // Which themes starve a level depends on the deck, so the test asks the data rather
  // than naming a theme that a future card could rescue.
  const starvingTheme = dateNightThemeTags(false).find((tag) => {
    const counts = dateNightAvailability([tag], false);
    return levels.some((level) => (counts[level.id] || 0) < 2);
  });

  async function chooseTableForTwo() {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("radio", { name: /A Table 4 Two/ }));
    return user;
  }

  it("offers the style and theme panels the format needs", async () => {
    await chooseTableForTwo();

    expect(screen.getByText("A Table 4 Two style")).toBeInTheDocument();
    expect(screen.getByText("Choose your themes")).toBeInTheDocument();
    expect(screen.getByText("All themes selected.")).toBeInTheDocument();
  });

  it("starts the match and asks the first partner to choose a depth", async () => {
    const user = await chooseTableForTwo();

    await user.click(screen.getByRole("checkbox", { name: /anyone can pass on a card/i }));
    await user.click(screen.getByRole("button", { name: "Start A Table 4 Two" }));

    expect(screen.getByText("Choose a challenge")).toBeInTheDocument();
    expect(screen.getByText("Connection Meter")).toBeInTheDocument();
  });

  it.skipIf(!starvingTheme)("refuses to start on a theme that starves a level", async () => {
    const user = await chooseTableForTwo();

    await user.click(screen.getByRole("button", { name: starvingTheme as string }));

    expect(screen.getByText(/needs at least 2 prompts in every level/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start A Table 4 Two" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "All themes" }));

    expect(screen.queryByText(/needs at least 2 prompts in every level/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start A Table 4 Two" })).toBeEnabled();
  });
});

describe("resuming", () => {
  it("offers to resume a session left unfinished", async () => {
    const user = await startConversationOnOnePhone();
    await user.click(faceDownCard());
    await user.click(screen.getByRole("button", { name: "Next card" }));
    await user.click(screen.getByRole("button", { name: "Return to setup" }));

    expect(screen.getByText("Session in progress")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Resume game" }));

    expect(screen.getByText("2 / 18")).toBeInTheDocument();
  });

  it("discards the session when starting over", async () => {
    const user = await startConversationOnOnePhone();
    await user.click(screen.getByRole("button", { name: "Return to setup" }));

    await user.click(screen.getByRole("button", { name: "Start over" }));

    expect(screen.queryByText("Session in progress")).not.toBeInTheDocument();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});
