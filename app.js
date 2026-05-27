import {
  advance,
  continueLevel,
  createSession,
  currentCard,
  currentLevel,
  currentPosition,
  reveal,
  totalCards
} from "./game-engine.js";
import { LEVELS, promptById } from "./data/prompts.js";
import { LEVEL_POINTS } from "./adaptive-engine.js";

const SESSION_KEY = "open-thread.session";
const ROOM_KEY = "open-thread.room";
const SAVED_KEY = "open-thread.saved";

const elements = {
  setup: document.querySelector("#setup-screen"),
  points: document.querySelector("#points-screen"),
  game: document.querySelector("#game-screen"),
  transition: document.querySelector("#transition-screen"),
  results: document.querySelector("#results-screen"),
  library: document.querySelector("#library-screen"),
  form: document.querySelector("#setup-form"),
  joinForm: document.querySelector("#join-form"),
  startButton: document.querySelector("#start-button"),
  hostNameField: document.querySelector("#host-name-field"),
  roomRulesField: document.querySelector("#room-rules-field"),
  experienceHelper: document.querySelector("#experience-helper"),
  audienceField: document.querySelector("#audience-field"),
  cardsPerLevelField: document.querySelector("#cards-per-level-field"),
  resumeCard: document.querySelector("#resume-card"),
  resumeDetails: document.querySelector("#resume-details"),
  savedCount: document.querySelector("#saved-count"),
  savedGrid: document.querySelector("#saved-grid"),
  emptyLibrary: document.querySelector("#empty-library"),
  clearSaved: document.querySelector("#clear-saved-button"),
  install: document.querySelector("#install-button"),
  toast: document.querySelector("#toast"),
  roomBanner: document.querySelector("#room-banner"),
  roomCode: document.querySelector("#room-code"),
  roomRole: document.querySelector("#room-role"),
  participantList: document.querySelector("#participant-list"),
  transitionRoom: document.querySelector("#transition-room"),
  resultsRoom: document.querySelector("#results-room"),
  pointsRoomCode: document.querySelector("#points-room-code"),
  pointsRoomLabel: document.querySelector("#points-room-label"),
  pointsParticipantList: document.querySelector("#points-participant-list"),
  pointsLobby: document.querySelector("#points-lobby"),
  pointsLobbyTitle: document.querySelector("#points-lobby-title"),
  pointsLobbyCopy: document.querySelector("#points-lobby-copy"),
  pointsStart: document.querySelector("#points-start-match-button"),
  pointsMatch: document.querySelector("#points-match"),
  pointsResults: document.querySelector("#points-results"),
  pointsTurnLabel: document.querySelector("#points-turn-label"),
  pointsTurnName: document.querySelector("#points-turn-name"),
  pointsGoalCopy: document.querySelector("#points-goal-copy"),
  pointsSharedMeter: document.querySelector("#points-shared-meter"),
  pointsMeterLabel: document.querySelector("#points-meter-label"),
  pointsMeterValue: document.querySelector("#points-meter-value"),
  pointsMeterBar: document.querySelector("#points-meter-bar"),
  pointsLevelProgress: document.querySelector("#points-level-progress"),
  pointsScorePanel: document.querySelector("#points-score-panel"),
  pointsScoreboard: document.querySelector("#points-scoreboard"),
  pointsGuidance: document.querySelector("#points-guidance"),
  pointsLevelPicker: document.querySelector("#points-level-picker"),
  pointsLevelActions: document.querySelector("#points-level-actions"),
  doubleDownOption: document.querySelector("#double-down-option"),
  doubleDownToggle: document.querySelector("#double-down-toggle"),
  pointsCard: document.querySelector("#points-card"),
  pointsCardLabel: document.querySelector("#points-card-label"),
  pointsVisibilityLabel: document.querySelector("#points-visibility-label"),
  pointsQuestion: document.querySelector("#points-question"),
  pointsTargetPicker: document.querySelector("#points-target-picker"),
  pointsTargetCopy: document.querySelector("#points-target-copy"),
  pointsTargetActions: document.querySelector("#points-target-actions"),
  pointsWaitingStage: document.querySelector("#points-waiting-stage"),
  pointsWaitingLabel: document.querySelector("#points-waiting-label"),
  pointsWaitingCopy: document.querySelector("#points-waiting-copy"),
  pointsEndingPicker: document.querySelector("#points-ending-picker"),
  pointsActivity: document.querySelector("#points-activity-button"),
  pointsQuestionEnding: document.querySelector("#points-question-button"),
  pointsSpin: document.querySelector("#points-spin-button"),
  pointsComplete: document.querySelector("#points-complete-button"),
  pointsPass: document.querySelector("#points-pass-button"),
  pointsBailout: document.querySelector("#points-bailout-button"),
  pointsClaim: document.querySelector("#points-claim-button"),
  pointsDiscard: document.querySelector("#points-discard-button"),
  pointsSave: document.querySelector("#points-save-button"),
  pointsSkip: document.querySelector("#points-skip-button"),
  pointsActions: document.querySelector("#points-actions"),
  pointsResultEyebrow: document.querySelector("#points-result-eyebrow"),
  pointsResultTitle: document.querySelector("#points-result-title"),
  pointsResultCopy: document.querySelector("#points-result-copy"),
  pointsFinalScoreboard: document.querySelector("#points-final-scoreboard"),
  pointsRewardCard: document.querySelector("#points-reward-card"),
  pointsRewardLabel: document.querySelector("#points-reward-label"),
  pointsRewardCopy: document.querySelector("#points-reward-copy")
};

let session = loadJson(SESSION_KEY);
let activeRoom = loadJson(ROOM_KEY);
let roomSnapshot;
let roomEvents;
let savedIds = loadJson(SAVED_KEY) ?? [];
let previousScreen = "setup";
let visibleScreen = "setup";
let installPrompt;
let roomActionPending = false;
let pendingSpinSnapshot = null;

function loadJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function isAdaptiveRoom() {
  return ["date_night", "inner_circle", "icebreaker", "competitive"].includes(activeRoom?.mode);
}

function experienceLabel(mode = activeRoom?.mode) {
  return {
    date_night: "Date Night",
    inner_circle: "Inner Circle",
    competitive: "Inner Circle",
    icebreaker: "Icebreaker"
  }[mode] || "Conversation";
}

function normalizedExperience(mode) {
  return mode === "competitive" ? "inner_circle" : mode || "conversation";
}

function applyExperienceTheme(mode) {
  document.body.dataset.experience = normalizedExperience(mode);
}

function isHost() {
  return !activeRoom || activeRoom.role === "host";
}

function persist() {
  if (session && !activeRoom) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
  if (activeRoom) {
    localStorage.setItem(ROOM_KEY, JSON.stringify(activeRoom));
  } else {
    localStorage.removeItem(ROOM_KEY);
  }
  localStorage.setItem(SAVED_KEY, JSON.stringify(savedIds));
}

function showScreen(name) {
  ["setup", "points", "game", "transition", "results", "library"].forEach((screenName) => {
    elements[screenName].hidden = screenName !== name;
  });
  if (visibleScreen !== name) {
    window.scrollTo(0, 0);
  }
  visibleScreen = name;
  if (name !== "library") {
    previousScreen = name;
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2500);
}

function audienceLabel(audience) {
  return { couple: "two people", friends: "friends", group: "a group" }[audience];
}

function selectedPlayMode() {
  return document.querySelector('input[name="playMode"]:checked').value;
}

function selectedRoomMode() {
  return document.querySelector('input[name="roomMode"]:checked').value;
}

function updateRoomModeFields() {
  const adaptive = selectedPlayMode() === "host" && selectedRoomMode() !== "conversation";
  const selectedMode = selectedRoomMode();
  elements.audienceField.hidden = adaptive;
  elements.cardsPerLevelField.hidden = adaptive;
  elements.startButton.textContent = adaptive ? `Create ${experienceLabel(selectedRoomMode())} room` : selectedPlayMode() === "host"
    ? "Create live room"
    : "Start the conversation";
  elements.experienceHelper.textContent = {
    conversation: "Everyone follows one shared deck. No scores, only space to answer or pass.",
    date_night: "Work together toward a shared milestone, then choose a closing moment.",
    inner_circle: "Private draws and points stay playful through balanced target cooldowns.",
    icebreaker: "A fair spin chooses responders while everyone builds group progress."
  }[selectedMode];
  applyExperienceTheme(selectedPlayMode() === "host" ? selectedMode : "conversation");
}

function setPlayMode(mode) {
  const choice = document.querySelector(`input[name="playMode"][value="${mode}"]`);
  if (choice) {
    choice.checked = true;
  }
  elements.form.hidden = mode === "join";
  elements.joinForm.hidden = mode !== "join";
  elements.hostNameField.hidden = mode !== "host";
  elements.roomRulesField.hidden = mode !== "host";
  updateRoomModeFields();
}

function updateSetup() {
  if (activeRoom && isAdaptiveRoom() && session) {
    applyExperienceTheme(session.mode);
  }
  const canResume = Boolean(activeRoom ? session : session && !session.completed);
  elements.resumeCard.hidden = !canResume;
  if (!canResume) {
    return;
  }
  if (isAdaptiveRoom()) {
    const state = session.status === "lobby" ? "waiting in the lobby" :
      session.status === "finished" ? "ready to review results" :
        `playing turn ${session.turnNumber}`;
    elements.resumeDetails.textContent = `${experienceLabel()} room ${activeRoom.code} is ${state}.`;
  } else if (activeRoom) {
    const role = activeRoom.role === "host" ? "Hosting" : "Joined";
    elements.resumeDetails.textContent =
      `${role} room ${activeRoom.code}: card ${currentPosition(session)} of ${totalCards(session)} is waiting.`;
  } else {
    const name = session.playerNames || audienceLabel(session.audience);
    elements.resumeDetails.textContent =
      `${name}: card ${currentPosition(session)} of ${totalCards(session)} is waiting.`;
  }
}

function updateSaved() {
  elements.savedCount.textContent = String(savedIds.length);
  elements.savedGrid.replaceChildren();
  elements.emptyLibrary.hidden = savedIds.length > 0;
  elements.clearSaved.hidden = savedIds.length === 0;

  savedIds.map(promptById).filter(Boolean).forEach((prompt) => {
    const level = LEVELS.find((item) => item.id === prompt.level);
    const article = document.createElement("article");
    article.className = "saved-card";
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = level.name;
    const question = document.createElement("p");
    question.textContent = prompt.text;
    const remove = document.createElement("button");
    remove.className = "text-button";
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => toggleSaved(prompt.id));
    article.append(eyebrow, question, remove);
    elements.savedGrid.append(article);
  });
}

function updateConversationRoomDetails() {
  const live = Boolean(activeRoom && roomSnapshot);
  elements.roomBanner.hidden = !live;
  elements.transitionRoom.hidden = !live;
  elements.resultsRoom.hidden = !live;
  if (!live) {
    return;
  }
  elements.roomCode.textContent = roomSnapshot.code;
  elements.roomRole.textContent = isHost()
    ? "You control the shared deck. Invite players with this code."
    : "The host controls the shared deck. Reveals appear here live.";
  elements.participantList.replaceChildren();
  roomSnapshot.participants.forEach((participant) => {
    const chip = document.createElement("span");
    chip.className = "participant-chip";
    chip.textContent = participant.role === "host" ? `${participant.name} - host` : participant.name;
    elements.participantList.append(chip);
  });
  elements.transitionRoom.textContent = `Room ${roomSnapshot.code}`;
  elements.resultsRoom.textContent = `Room ${roomSnapshot.code}`;
}

function updateConversationGame() {
  applyExperienceTheme("conversation");
  const level = currentLevel(session);
  const card = currentCard(session);
  const position = currentPosition(session);
  const count = totalCards(session);
  const saved = savedIds.includes(card.id);
  const deckControls = isHost();

  document.querySelector("#level-number").textContent = level.number;
  document.querySelector("#level-name").textContent = level.name;
  document.querySelector("#card-level").textContent = level.guidance;
  document.querySelector("#progress-copy").textContent = `${position} / ${count}`;
  document.querySelector("#progress-bar").style.width = `${(position / count) * 100}%`;
  document.querySelector("#card-hidden").hidden = session.revealed;
  document.querySelector("#card-question").hidden = !session.revealed;
  document.querySelector("#card-question").textContent = card.text;
  const promptCard = document.querySelector("#prompt-card");
  promptCard.classList.toggle("is-revealed", session.revealed);
  promptCard.classList.toggle("is-readonly", !deckControls);
  promptCard.setAttribute("aria-label",
    session.revealed ? card.text : deckControls ? "Reveal prompt card" : "Waiting for host to reveal prompt card");
  const saveButton = document.querySelector("#save-button");
  const nextButton = document.querySelector("#next-button");
  saveButton.disabled = !session.revealed;
  saveButton.textContent = saved ? "Saved" : "Save card";
  saveButton.classList.toggle("is-saved", saved);
  nextButton.hidden = !deckControls;
  nextButton.disabled = !session.revealed || roomActionPending;
  document.querySelector("#pass-button").hidden = !deckControls;
  document.querySelector("#turn-copy").textContent = activeRoom && !deckControls
    ? "Follow along here. The host reveals and advances the shared deck."
    : "There is no right answer. Listening counts.";
  updateConversationRoomDetails();
}

function updateConversationTransition() {
  applyExperienceTheme("conversation");
  const completedLevel = LEVELS[session.levelIndex - 1];
  const nextLevel = currentLevel(session);
  document.querySelector("#completed-level").textContent = `${completedLevel.name} complete`;
  document.querySelector("#transition-copy").textContent =
    `${completedLevel.completion} Next up: ${nextLevel.name}.`;
  const button = document.querySelector("#continue-button");
  button.disabled = !isHost() || roomActionPending;
  button.textContent = isHost() ? "Continue" : "Waiting for host";
  updateConversationRoomDetails();
}

function finishConversation() {
  applyExperienceTheme("conversation");
  const name = session.playerNames || "your table";
  document.querySelector("#results-copy").textContent =
    `You completed ${totalCards(session)} prompts with ${name}. Keep the saved cards for a later conversation.`;
  document.querySelector("#new-game-button").textContent = activeRoom ? "Leave room" : "Play again";
  updateConversationRoomDetails();
  showScreen("results");
}

function hasPointsAction(action) {
  return session.availableActions.includes(action);
}

function pointsPlayer(id) {
  return session.players.find((item) => item.id === id);
}

function renderPlayerChips() {
  elements.pointsParticipantList.replaceChildren();
  session.players.forEach((participant) => {
    const chip = document.createElement("span");
    chip.className = `participant-chip${participant.connected ? "" : " is-offline"}`;
    chip.textContent = `${participant.name}${participant.role === "host" ? " - host" : ""}${participant.connected ? "" : " - unavailable"}`;
    elements.pointsParticipantList.append(chip);
  });
}

function renderScores(container, final = false) {
  container.replaceChildren();
  const players = final ? [...session.players].sort((left, right) => right.score - left.score) : session.players;
  players.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = `score-row${item.id === session.activePlayerId && !final ? " is-active" : ""}`;
    const position = document.createElement("span");
    position.className = "score-position";
    position.textContent = final ? `#${index + 1}` : item.id === session.activePlayerId ? "Turn" : "";
    const name = document.createElement("span");
    name.className = "score-name";
    name.textContent = item.name;
    const resources = document.createElement("span");
    resources.className = "score-resources";
    resources.textContent = `${item.bailoutAvailable ? "Bailout" : "Bailout used"} | ${item.doubleDownAvailable ? "Double Down" : "Double Down used"}`;
    name.append(resources);
    const score = document.createElement("span");
    score.className = "score-points";
    score.textContent = `${item.score} pt${item.score === 1 ? "" : "s"}`;
    row.append(position, name, score);
    container.append(row);
  });
}

function renderSharedMeter() {
  const shared = session.mode !== "inner_circle";
  elements.pointsSharedMeter.hidden = !shared;
  elements.pointsScorePanel.hidden = shared;
  if (!shared) {
    elements.pointsGoalCopy.textContent = "First to 21";
    return;
  }
  const score = session.mode === "date_night" ? session.connectionScore : session.groupScore;
  elements.pointsMeterLabel.textContent = session.mode === "date_night" ? "Connection Meter" : "Group progress";
  elements.pointsMeterValue.textContent = `${score} / ${session.scoreTarget}`;
  elements.pointsMeterBar.style.width = `${Math.min(100, (score / session.scoreTarget) * 100)}%`;
  elements.pointsGoalCopy.textContent = session.mode === "date_night" ? "Shared milestone" : "Together to 15";
  elements.pointsLevelProgress.replaceChildren();
  if (session.mode === "date_night") {
    LEVELS.forEach((level) => {
      const progress = document.createElement("span");
      progress.textContent = `${level.name}: ${session.completedByLevel[level.id]} / 2`;
      elements.pointsLevelProgress.append(progress);
    });
  }
}

function renderLevelPicker() {
  const visible = hasPointsAction("choose_level");
  elements.pointsLevelPicker.hidden = !visible;
  if (!visible) {
    return;
  }
  const viewer = pointsPlayer(roomSnapshot.viewerId);
  elements.doubleDownToggle.checked = false;
  elements.doubleDownToggle.disabled = session.mode !== "inner_circle" || !viewer.doubleDownAvailable;
  elements.doubleDownOption.hidden = session.mode !== "inner_circle" || !viewer.doubleDownAvailable;
  elements.pointsLevelActions.replaceChildren();
  LEVELS.filter((level) => Object.hasOwn(session.remainingByLevel, level.id)).forEach((level) => {
    const button = document.createElement("button");
    const count = session.remainingByLevel[level.id];
    button.className = "level-button";
    button.type = "button";
    button.disabled = count === 0 || roomActionPending;
    button.innerHTML = `<strong>${LEVEL_POINTS[level.id]}</strong><span>${level.name}<br>${count} left</span>`;
    button.addEventListener("click", () => {
      sendRoomAction("choose_level", { levelId: level.id, doubleDown: elements.doubleDownToggle.checked });
    });
    elements.pointsLevelActions.append(button);
  });
}

function pointsGuidance() {
  const active = pointsPlayer(session.activePlayerId);
  const target = pointsPlayer(session.targetPlayerId);
  if (session.mode === "date_night") {
    if (session.phase === "choose_ending") {
      return "You reached your shared milestone. Either partner can choose how to close tonight.";
    }
    if (session.phase === "choose_level") {
      return hasPointsAction("choose_level")
        ? "Your turn to answer. Choose a depth that feels right."
        : `${active.name} is choosing a prompt to answer.`;
    }
    return hasPointsAction("complete")
      ? "Share what feels true, then mark Completed. Passing is always welcome."
      : `${active.name} is answering this prompt.`;
  }
  if (session.mode === "icebreaker") {
    if (session.phase === "choose_level") {
      return hasPointsAction("choose_level")
        ? "You are facilitating. Pick a friendly depth for the group."
        : `${active.name} is selecting a prompt level.`;
    }
    if (session.phase === "spin_target") {
      return hasPointsAction("spin_target")
        ? "The prompt is ready. Spin to fairly choose its responder."
        : `${active.name} is spinning for a responder.`;
    }
    return hasPointsAction("complete")
      ? "Answer aloud, then mark Completed, or Pass with no explanation needed."
      : `${target.name} is responding for the group.`;
  }
  if (session.phase === "choose_level") {
    return hasPointsAction("choose_level")
      ? "Your turn. Choose how deep to go and whether to risk your Double Down."
      : `${active.name} is choosing a challenge.`;
  }
  if (["preview_card", "replacement_preview"].includes(session.phase)) {
    if (hasPointsAction("target_player")) {
      return session.phase === "replacement_preview"
        ? "Bailout respected. Choose a different player for this replacement prompt."
        : "Only you can see this card. Choose who receives it.";
    }
    return `${active.name} is selecting a player.`;
  }
  if (session.phase === "await_response") {
    if (session.currentChallenge.claimant) {
      return hasPointsAction("complete") ? "Answer the prompt, then confirm completion to claim its points." :
        `${active.name} chose to answer the passed prompt.`;
    }
    return hasPointsAction("complete") ? "Answer aloud, then mark the prompt completed - or pass without explanation." :
      `${target.name} is responding.`;
  }
  if (session.phase === "await_claim") {
    return hasPointsAction("claim") ? "The prompt was passed. Answer it yourself for base points or discard it." :
      `${active.name} may claim or discard the passed prompt.`;
  }
  return "";
}

function promptIsPublic() {
  if (session.mode === "inner_circle") {
    return ["await_response", "await_claim"].includes(session.phase);
  }
  return session.phase === "await_response";
}

function renderWaitingStage() {
  const waitingForReveal = !session.currentChallenge?.prompt &&
    (session.mode === "icebreaker" && session.phase === "spin_target" ||
      session.mode === "inner_circle" && ["preview_card", "replacement_preview"].includes(session.phase));
  elements.pointsWaitingStage.hidden = !waitingForReveal;
  if (!waitingForReveal) {
    return;
  }
  if (session.mode === "icebreaker") {
    elements.pointsWaitingLabel.textContent = "Prompt concealed";
    elements.pointsWaitingCopy.textContent = hasPointsAction("spin_target")
      ? "Spin when the room is ready. The prompt appears once a responder is chosen."
      : "The facilitator is spinning for a responder.";
    return;
  }
  elements.pointsWaitingLabel.textContent = "Private preview";
  elements.pointsWaitingCopy.textContent = "The active player is choosing who receives this prompt.";
}

function renderPointsCard() {
  const challenge = session.currentChallenge;
  const prompt = challenge?.prompt;
  const publicPrompt = promptIsPublic();
  elements.pointsCard.hidden = !prompt;
  elements.pointsTargetPicker.hidden = true;
  elements.pointsSave.hidden = true;
  elements.pointsTargetActions.replaceChildren();
  if (!prompt) {
    return;
  }
  const level = LEVELS.find((item) => item.id === challenge.levelId);
  const value = challenge.doubled && !challenge.claimant ? challenge.basePoints * 2 : challenge.basePoints;
  elements.pointsCardLabel.textContent =
    `${level.name} - ${value} point${value === 1 ? "" : "s"}${challenge.doubled ? " - Double Down" : ""}`;
  elements.pointsVisibilityLabel.textContent = !publicPrompt
    ? "Only visible on your phone"
    : session.mode === "date_night" ? "Visible to both partners"
      : "Visible to the room";
  elements.pointsQuestion.textContent = prompt.text;
  if (session.mode === "inner_circle" && hasPointsAction("target_player")) {
    elements.pointsTargetPicker.hidden = false;
    elements.pointsTargetCopy.textContent = "Prompts are spread around the group. Cooling down players return in the next cycle.";
    session.players
      .filter((item) => item.id !== roomSnapshot.viewerId && item.connected && item.id !== challenge.excludedTargetId)
      .forEach((item) => {
        const button = document.createElement("button");
        const allowed = session.targetablePlayerIds.includes(item.id);
        button.className = `target-button${allowed ? "" : " is-cooling"}`;
        button.type = "button";
        button.disabled = !allowed || roomActionPending;
        button.textContent = allowed ? item.name : `${item.name} - Cooling down`;
        button.addEventListener("click", () => sendRoomAction("target_player", { targetPlayerId: item.id }));
        elements.pointsTargetActions.append(button);
      });
  }
  const saved = publicPrompt && savedIds.includes(prompt.id);
  elements.pointsSave.hidden = !publicPrompt;
  elements.pointsSave.textContent = saved ? "Saved" : "Save card";
  elements.pointsSave.classList.toggle("is-saved", saved);
}

function renderPointsActions() {
  const actionButtons = [
    [elements.pointsSpin, "spin_target"],
    [elements.pointsComplete, "complete"],
    [elements.pointsPass, "pass"],
    [elements.pointsBailout, "bailout"],
    [elements.pointsClaim, "claim"],
    [elements.pointsDiscard, "discard"],
    [elements.pointsSkip, "skip_stalled_turn"]
  ];
  actionButtons.forEach(([button, action]) => {
    button.hidden = !hasPointsAction(action);
    button.disabled = roomActionPending;
  });
  elements.pointsActions.hidden = actionButtons.every(([button]) => button.hidden) && elements.pointsSave.hidden;
}

function renderEndingPicker() {
  const choosing = session.mode === "date_night" && session.phase === "choose_ending";
  elements.pointsEndingPicker.hidden = !choosing;
  elements.pointsActivity.disabled = roomActionPending || !hasPointsAction("choose_ending");
  elements.pointsQuestionEnding.disabled = roomActionPending || !hasPointsAction("choose_ending");
}

function renderAdaptiveResults() {
  elements.pointsFinalScoreboard.hidden = session.mode !== "inner_circle";
  elements.pointsRewardCard.hidden = true;
  elements.pointsResultEyebrow.textContent = "Experience complete";
  if (session.mode === "inner_circle") {
    const winners = session.winnerIds.map((id) => pointsPlayer(id).name).join(" & ");
    elements.pointsResultTitle.textContent = session.winnerIds.length > 1 ? `${winners} tie.` : `${winners} wins.`;
    elements.pointsResultCopy.textContent = session.endReason === "score_target"
      ? "The first player reached 21 points."
      : "The prompts are complete. Highest score takes the match.";
    renderScores(elements.pointsFinalScoreboard, true);
    return;
  }
  if (session.mode === "date_night") {
    elements.pointsResultTitle.textContent = session.endReason === "milestone"
      ? "You reached a shared milestone."
      : "Thank you for meeting each other here.";
    elements.pointsResultCopy.textContent = session.endReason === "milestone"
      ? `Together you reached ${session.connectionScore} connection points and explored every depth.`
      : `You reached ${session.connectionScore} connection points before this deck ended.`;
    if (session.revealedReward) {
      elements.pointsRewardCard.hidden = false;
      elements.pointsRewardLabel.textContent = session.endingChoice === "activity"
        ? "Do Something Together"
        : "One More Meaningful Question";
      elements.pointsRewardCopy.textContent = session.revealedReward.text;
    }
    return;
  }
  elements.pointsResultTitle.textContent = session.endReason === "score_target"
    ? "Your group reached the goal."
    : "That was a good round.";
  elements.pointsResultCopy.textContent = session.endReason === "score_target"
    ? `Together you built ${session.groupScore} points of group connection.`
    : `Your group built ${session.groupScore} points before the available prompts ended.`;
}

function renderAdaptiveMode() {
  applyExperienceTheme(session.mode);
  elements.pointsRoomCode.textContent = roomSnapshot.code;
  elements.pointsRoomLabel.textContent = experienceLabel(session.mode);
  renderPlayerChips();
  elements.pointsLobby.hidden = session.status !== "lobby";
  elements.pointsMatch.hidden = session.status !== "playing";
  elements.pointsResults.hidden = session.status !== "finished";

  if (session.status === "lobby") {
    if (session.mode === "date_night") {
      elements.pointsLobbyTitle.textContent = "An evening for two.";
      elements.pointsLobbyCopy.textContent = session.players.length === 1
        ? "Waiting for one partner to join this shared Date Night."
        : "Both partners are here. The host can begin when you are comfortable.";
      elements.pointsStart.textContent = "Start Date Night";
    } else {
      const needed = Math.max(0, 3 - session.players.length);
      const group = session.mode === "inner_circle" ? "friends" : "players";
      elements.pointsLobbyTitle.textContent = session.mode === "inner_circle"
        ? "Gather your inner circle."
        : "Open the room gently.";
      elements.pointsLobbyCopy.textContent = needed > 0
        ? `Waiting for ${needed} more ${group === "friends" ? "friend" : "player"}${needed === 1 ? "" : "s"} before you begin.`
        : `${session.players.length} ${group} are ready. The host can begin when everyone is settled.`;
      elements.pointsStart.textContent = session.mode === "inner_circle" ? "Start Inner Circle" : "Start Icebreaker";
    }
    elements.pointsStart.hidden = !hasPointsAction("start_match");
  }

  if (session.status === "playing") {
    const active = pointsPlayer(session.activePlayerId);
    elements.pointsTurnLabel.textContent = `Turn ${session.turnNumber}`;
    elements.pointsTurnName.textContent = session.mode === "date_night"
      ? `${active.name} responds`
      : session.mode === "icebreaker" ? `${active.name} facilitates` : `${active.name}'s turn`;
    renderSharedMeter();
    if (session.mode === "inner_circle") {
      renderScores(elements.pointsScoreboard);
    }
    elements.pointsGuidance.textContent = pointsGuidance();
    renderLevelPicker();
    renderWaitingStage();
    renderPointsCard();
    renderPointsActions();
    renderEndingPicker();
    if (!session.currentChallenge?.prompt || !promptIsPublic()) {
      elements.pointsSave.hidden = true;
    }
  }

  if (session.status === "finished") {
    renderAdaptiveResults();
  }
  showScreen("points");
}

function renderSession() {
  persist();
  updateSetup();
  updateSaved();
  if (isAdaptiveRoom() && session) {
    renderAdaptiveMode();
  } else if (!session) {
    showScreen("setup");
  } else if (session.completed) {
    finishConversation();
  } else if (session.betweenLevels) {
    updateConversationTransition();
    showScreen("transition");
  } else {
    updateConversationGame();
    showScreen("game");
  }
}

function toggleSaved(id) {
  if (savedIds.includes(id)) {
    savedIds = savedIds.filter((savedId) => savedId !== id);
    showToast("Removed from saved cards");
  } else {
    savedIds = [id, ...savedIds];
    showToast("Saved for later");
  }
  persist();
  updateSaved();
  if (isAdaptiveRoom()) {
    renderAdaptiveMode();
  } else if (session && !session.completed && !session.betweenLevels) {
    updateConversationGame();
  }
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Room request failed");
  }
  return body;
}

function stopRoomEvents() {
  if (roomEvents) {
    roomEvents.close();
    roomEvents = null;
  }
}

function applyRoomSnapshot(snapshot, { openGame = !["setup", "library"].includes(visibleScreen) } = {}) {
  if (roomActionPending && elements.pointsMatch.classList.contains("is-spinning") &&
    snapshot.session?.phase === "await_response") {
    pendingSpinSnapshot = snapshot;
    return;
  }
  roomSnapshot = snapshot;
  session = snapshot.session;
  if (openGame) {
    renderSession();
  } else {
    persist();
    updateSetup();
    updateSaved();
  }
}

function roomAccessQuery() {
  return isAdaptiveRoom() ? `?participantToken=${encodeURIComponent(activeRoom.participantToken)}` : "";
}

function connectRoomEvents() {
  stopRoomEvents();
  roomEvents = new EventSource(`/api/rooms/${activeRoom.code}/events${roomAccessQuery()}`);
  roomEvents.addEventListener("room", (event) => applyRoomSnapshot(JSON.parse(event.data)));
  roomEvents.onerror = () => {
    if (activeRoom) {
      showToast("Reconnecting to live room...");
    }
  };
}

async function enterRoom(connection, role) {
  activeRoom = {
    code: connection.room.code,
    mode: connection.room.mode || "conversation",
    participantId: connection.participantId,
    role,
    ...(connection.hostToken ? { hostToken: connection.hostToken } : {}),
    ...(connection.participantToken ? { participantToken: connection.participantToken } : {})
  };
  session = connection.room.session;
  roomSnapshot = connection.room;
  persist();
  connectRoomEvents();
  renderSession();
}

function leaveRoom() {
  stopRoomEvents();
  activeRoom = null;
  roomSnapshot = null;
  session = null;
  persist();
}

async function restoreRoom() {
  if (!activeRoom) {
    return;
  }
  try {
    applyRoomSnapshot(await requestJson(`/api/rooms/${activeRoom.code}${roomAccessQuery()}`), { openGame: false });
    connectRoomEvents();
  } catch {
    leaveRoom();
    showToast("That room is no longer active");
    renderSession();
  }
}

async function sendRoomAction(action, payload = {}) {
  if (!activeRoom || roomActionPending || (!isAdaptiveRoom() && !isHost())) {
    return;
  }
  roomActionPending = true;
  const spinning = action === "spin_target";
  if (spinning) {
    elements.pointsMatch.classList.add("is-spinning");
  }
  try {
    const authorization = isAdaptiveRoom()
      ? { participantToken: activeRoom.participantToken }
      : { hostToken: activeRoom.hostToken };
    const request = requestJson(`/api/rooms/${activeRoom.code}/actions`, {
      method: "POST",
      body: JSON.stringify({ action, ...authorization, ...payload })
    });
    const snapshot = spinning
      ? (await Promise.all([request, new Promise((resolve) => window.setTimeout(resolve, 480))]))[0]
      : await request;
    if (spinning) {
      elements.pointsMatch.classList.remove("is-spinning");
    }
    applyRoomSnapshot(pendingSpinSnapshot || snapshot);
  } catch (error) {
    showToast(error.message);
  } finally {
    roomActionPending = false;
    pendingSpinSnapshot = null;
    elements.pointsMatch.classList.remove("is-spinning");
    renderSession();
  }
}

async function copyInvite() {
  if (!activeRoom) {
    return;
  }
  const inviteUrl = `${window.location.origin}/?room=${activeRoom.code}`;
  if (navigator.share) {
    try {
      await navigator.share({
        title: `${experienceLabel()} on Open Thread`,
        text: `Join my ${experienceLabel()} room: ${activeRoom.code}`,
        url: inviteUrl
      });
      showToast("Invite shared");
      return;
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
    }
  }
  try {
    await navigator.clipboard.writeText(inviteUrl);
    showToast("Invite link copied");
  } catch {
    showToast(`Invite code: ${activeRoom.code}`);
  }
}

document.querySelectorAll('input[name="playMode"]').forEach((choice) => {
  choice.addEventListener("change", () => setPlayMode(selectedPlayMode()));
});
document.querySelectorAll('input[name="roomMode"]').forEach((choice) => {
  choice.addEventListener("change", updateRoomModeFields);
});

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(elements.form);
  const options = {
    audience: data.get("audience"),
    playerNames: data.get("playerNames"),
    cardsPerLevel: Number(data.get("cardsPerLevel"))
  };
  if (selectedPlayMode() === "host") {
    try {
      const mode = selectedRoomMode();
      const connection = await requestJson("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ ...options, mode, hostName: data.get("hostName") })
      });
      await enterRoom(connection, "host");
      showToast(mode === "conversation"
        ? `Room ${connection.room.code} is live`
        : `${experienceLabel(mode)} room ${connection.room.code} is open`);
    } catch (error) {
      showToast(error.message);
    }
    return;
  }
  leaveRoom();
  session = createSession(options);
  renderSession();
});

elements.joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(elements.joinForm);
  const code = String(data.get("roomCode")).replace(/\s+/g, "").toUpperCase();
  try {
    const connection = await requestJson(`/api/rooms/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ name: data.get("name") })
    });
    await enterRoom(connection, "player");
    showToast(`Joined room ${connection.room.code}`);
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelector("#prompt-card").addEventListener("click", () => {
  if (session.revealed || !isHost() || isAdaptiveRoom()) {
    return;
  }
  if (activeRoom) {
    sendRoomAction("reveal");
  } else {
    session = reveal(session);
    persist();
    updateConversationGame();
  }
});
document.querySelector("#save-button").addEventListener("click", () => toggleSaved(currentCard(session).id));
document.querySelector("#next-button").addEventListener("click", () => {
  if (activeRoom) {
    sendRoomAction("advance");
  } else {
    session = advance(session);
    renderSession();
  }
});
document.querySelector("#pass-button").addEventListener("click", () => {
  if (activeRoom) {
    sendRoomAction("advance");
  } else {
    session = advance(session);
    renderSession();
  }
});
document.querySelector("#continue-button").addEventListener("click", () => {
  if (activeRoom) {
    sendRoomAction("continue");
  } else {
    session = continueLevel(session);
    renderSession();
  }
});

elements.pointsStart.addEventListener("click", () => sendRoomAction("start_match"));
elements.pointsSpin.addEventListener("click", () => sendRoomAction("spin_target"));
elements.pointsComplete.addEventListener("click", () => sendRoomAction("complete"));
elements.pointsPass.addEventListener("click", () => sendRoomAction("pass"));
elements.pointsBailout.addEventListener("click", () => sendRoomAction("bailout"));
elements.pointsClaim.addEventListener("click", () => sendRoomAction("claim"));
elements.pointsDiscard.addEventListener("click", () => sendRoomAction("discard"));
elements.pointsSkip.addEventListener("click", () => sendRoomAction("skip_stalled_turn"));
elements.pointsActivity.addEventListener("click", () => sendRoomAction("choose_ending", { endingType: "activity" }));
elements.pointsQuestionEnding.addEventListener("click", () => sendRoomAction("choose_ending", { endingType: "question" }));
elements.pointsSave.addEventListener("click", () => {
  const prompt = session.currentChallenge?.prompt;
  if (prompt && promptIsPublic()) {
    toggleSaved(prompt.id);
  }
});

document.querySelector("#resume-button").addEventListener("click", renderSession);
document.querySelector("#discard-button").addEventListener("click", () => {
  leaveRoom();
  session = null;
  persist();
  updateSetup();
});
document.querySelector("#new-game-button").addEventListener("click", () => {
  leaveRoom();
  showScreen("setup");
  updateSetup();
});
document.querySelector("#points-leave-button").addEventListener("click", () => {
  leaveRoom();
  showScreen("setup");
  updateSetup();
});
document.querySelector("#review-button").addEventListener("click", () => {
  updateSaved();
  showScreen("library");
});
document.querySelector("#library-button").addEventListener("click", () => {
  updateSaved();
  showScreen("library");
});
document.querySelector("#close-library-button").addEventListener("click", () => {
  if (session && previousScreen !== "setup") {
    renderSession();
  } else {
    showScreen(previousScreen);
  }
});
document.querySelector("#home-button").addEventListener("click", () => {
  updateSetup();
  showScreen("setup");
});
document.querySelector("#copy-invite-button").addEventListener("click", copyInvite);
document.querySelector("#points-copy-invite-button").addEventListener("click", copyInvite);
elements.clearSaved.addEventListener("click", () => {
  savedIds = [];
  persist();
  updateSaved();
  showToast("Saved cards cleared");
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  elements.install.hidden = false;
});
elements.install.addEventListener("click", async () => {
  if (!installPrompt) {
    return;
  }
  installPrompt.prompt();
  await installPrompt.userChoice;
  elements.install.hidden = true;
  installPrompt = null;
});
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}

const invitedRoom = new URLSearchParams(window.location.search).get("room");
if (invitedRoom) {
  setPlayMode("join");
  document.querySelector("#join-code").value = invitedRoom.toUpperCase().slice(0, 5);
} else {
  setPlayMode("local");
}
updateSetup();
updateSaved();
showScreen("setup");
restoreRoom();
