export type Audience = "couple" | "friends" | "group";
export type PlayMode = "local" | "host" | "join";
export type RoomMode = "conversation" | "date_night" | "inner_circle" | "icebreaker";
export type AdaptiveMode = Exclude<RoomMode, "conversation">;
export type ScreenName = "setup" | "adaptive" | "game" | "transition" | "results" | "library";

export interface Prompt {
  id: string;
  level: string;
  audiences: Audience[];
  experiences?: AdaptiveMode[];
  isSpicy?: boolean;
  tags?: string[];
  text: string;
}

export interface PromptFilters {
  tags: string[];
  includeSpicy: boolean;
}

export interface Level {
  id: string;
  name: string;
  number: string;
  guidance: string;
  completion: string;
}

export interface ConversationSession {
  audience: Audience;
  playerNames: string;
  cardsPerLevel: number;
  cardsByLevel: Record<string, string[]>;
  levelIndex: number;
  cardIndex: number;
  revealed: boolean;
  betweenLevels: boolean;
  completed: boolean;
}

export interface AdaptivePlayer {
  id: string;
  name: string;
  role: "host" | "player";
  connected: boolean;
  score: number;
  bailoutAvailable?: boolean;
  doubleDownAvailable?: boolean;
}

export interface Challenge {
  levelId: string;
  basePoints: number;
  doubled: boolean;
  excludedTargetId?: string | null;
  claimant?: boolean;
  prompt?: Prompt;
}

export interface AdaptiveSession {
  mode: AdaptiveMode;
  status: "lobby" | "playing" | "finished";
  phase: string;
  players: AdaptivePlayer[];
  availableActions: string[];
  activePlayerId?: string;
  targetPlayerId?: string | null;
  turnNumber: number;
  scoreTarget: number;
  remainingByLevel: Record<string, number>;
  currentChallenge?: Challenge | null;
  targetablePlayerIds?: string[];
  promptFilters?: PromptFilters;
  connectionScore?: number;
  groupScore?: number;
  completedByLevel?: Record<string, number>;
  winnerIds?: string[];
  endReason?: string;
  endingChoice?: "activity" | "question";
  revealedReward?: { id: string; text: string };
}

export interface Participant {
  id: string;
  name: string;
  role: "host" | "player";
  connected?: boolean;
}

export interface RoomSnapshot<T = ConversationSession | AdaptiveSession> {
  code: string;
  mode: RoomMode;
  participants: Participant[];
  session: T;
  viewerId?: string;
}

export interface ActiveRoom {
  code: string;
  mode: RoomMode | "competitive";
  participantId: string;
  role: "host" | "player";
  hostToken?: string;
  participantToken?: string;
}

export interface RoomConnection {
  room: RoomSnapshot;
  participantId: string;
  hostToken?: string;
  participantToken?: string;
}
