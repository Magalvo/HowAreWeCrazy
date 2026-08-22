import { LEVELS, PROMPTS, promptById as rawPromptById } from "../data/prompts.js";
import { LEVEL_POINTS } from "../adaptive-engine.js";
import type { Level, Prompt } from "./types";

// The card data and the rule engines stay plain JavaScript so the server can share them.
// This module is the single place where they gain their types for the web client.
export const levels = LEVELS as Level[];
export const prompts = PROMPTS as Prompt[];
export const points = LEVEL_POINTS as Record<string, number>;

export function promptById(id: string): Prompt | undefined {
  return rawPromptById(id) as Prompt | undefined;
}

export function levelById(id: string): Level | undefined {
  return levels.find((level) => level.id === id);
}
