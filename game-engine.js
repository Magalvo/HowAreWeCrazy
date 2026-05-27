import { LEVELS, PROMPTS, promptById } from "./data/prompts.js";

export function shuffle(items, random = Math.random) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function createSession({ audience, playerNames = "", cardsPerLevel = 6, random = Math.random }) {
  const cardsByLevel = Object.fromEntries(
    LEVELS.map((level) => {
      const available = PROMPTS.filter(
        (prompt) => prompt.level === level.id &&
          prompt.audiences.includes(audience) &&
          !prompt.isSpicy &&
          !prompt.experiences
      );
      return [level.id, shuffle(available, random).slice(0, cardsPerLevel).map((prompt) => prompt.id)];
    })
  );

  return {
    audience,
    playerNames: playerNames.trim(),
    cardsPerLevel,
    cardsByLevel,
    levelIndex: 0,
    cardIndex: 0,
    revealed: false,
    betweenLevels: false,
    completed: false,
    startedAt: new Date().toISOString()
  };
}

export function currentLevel(session) {
  return LEVELS[session.levelIndex];
}

export function currentCard(session) {
  const level = currentLevel(session);
  const id = session.cardsByLevel[level.id][session.cardIndex];
  return promptById(id);
}

export function totalCards(session) {
  return Object.values(session.cardsByLevel).reduce((total, cards) => total + cards.length, 0);
}

export function currentPosition(session) {
  const previousCards = LEVELS.slice(0, session.levelIndex).reduce(
    (total, level) => total + session.cardsByLevel[level.id].length,
    0
  );
  return previousCards + session.cardIndex + 1;
}

export function reveal(session) {
  return { ...session, revealed: true };
}

export function advance(session) {
  const level = currentLevel(session);
  const atEndOfLevel = session.cardIndex + 1 >= session.cardsByLevel[level.id].length;
  const atEndOfGame = session.levelIndex + 1 >= LEVELS.length;

  if (!atEndOfLevel) {
    return { ...session, cardIndex: session.cardIndex + 1, revealed: false };
  }

  if (atEndOfGame) {
    return { ...session, revealed: false, completed: true };
  }

  return {
    ...session,
    levelIndex: session.levelIndex + 1,
    cardIndex: 0,
    revealed: false,
    betweenLevels: true
  };
}

export function continueLevel(session) {
  return { ...session, betweenLevels: false };
}
