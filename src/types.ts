export type Audience = "couple" | "friends" | "group";
export type PlayMode = "local" | "host" | "join";
export type AdaptiveMode = "classic" | "date_night" | "inner_circle" | "icebreaker";
export type RoomMode = "conversation" | AdaptiveMode | "caption";
export type ScreenName = "setup" | "adaptive" | "game" | "transition" | "results" | "library";
export type DateVariant = "classic" | "free_minds";

/** Everything the setup screen collects before a session or a room exists. */
export interface SetupState {
  playMode: PlayMode;
  roomMode: RoomMode;
  audience: Audience;
  playerNames: string;
  hostName: string;
  cardsPerLevel: number;
  selectedThemeTags: string[];
  includeSpicy: boolean;
  dateVariant: DateVariant;
  agreement: boolean;
  joinCode: string;
  joinName: string;
  joinAgreement: boolean;
}

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
  dateVariant?: DateVariant;
  status: "lobby" | "playing" | "finished";
  phase: string;
  players: AdaptivePlayer[];
  availableActions: string[];
  activePlayerId?: string;
  targetPlayerId?: string | null;
  currentResponderId?: string | null;
  turnNumber: number;
  scoreTarget: number;
  remainingByLevel: Record<string, number>;
  currentChallenge?: Challenge | null;
  targetablePlayerIds?: string[];
  promptFilters?: PromptFilters;
  classicStage?: "aron" | "bonus" | "finished";
  classicIndex?: number;
  classicBonusOffered?: boolean;
  classicCompletedAron?: boolean;
  connectionScore?: number;
  nextMilestoneScore?: number;
  groupScore?: number;
  completedByLevel?: Record<string, number>;
  winnerIds?: string[];
  endReason?: string;
  endingChoice?: "activity" | "question";
  revealedReward?: { id: string; text: string; type?: "activity" | "question" };
  milestoneRewards?: Array<{ id: string; text: string; type?: "activity" | "question" }>;
}

export interface CaptionCard {
  id: string;
  text: string;
}

export interface MemeImage {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
}

export interface CaptionPlayer {
  id: string;
  name: string;
  role: "host" | "player";
  connected: boolean;
  score: number;
  handCount: number;
}

/** A played caption. Its author is withheld until the round has been judged. */
export interface CaptionReveal {
  cardId: string;
  text: string;
  playerId?: string;
}

export interface CaptionRoundResult {
  imageId: string;
  winnerId: string;
  winningCardId: string;
  judgeId: string;
}

export interface CaptionSession {
  mode: "caption";
  status: "lobby" | "playing" | "finished";
  phase: "submitting" | "judging" | "round_won" | null;
  roundNumber: number;
  scoreTarget: number;
  judgeId: string | null;
  viewerId: string;
  isJudge: boolean;
  players: CaptionPlayer[];
  hand: CaptionCard[];
  image: MemeImage | null;
  submittedPlayerIds: string[];
  awaitingPlayerIds: string[];
  reveal: CaptionReveal[];
  lastRound: CaptionRoundResult | null;
  winnerIds: string[];
  endReason: string | null;
  captionsRemaining: number;
  imagesRemaining: number;
  availableActions: string[];
}

export interface Participant {
  id: string;
  name: string;
  role: "host" | "player";
  connected?: boolean;
}

export interface RoomSnapshot<T = ConversationSession | AdaptiveSession | CaptionSession> {
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
