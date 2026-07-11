export type LaneIndex = 0 | 1 | 2;
export type CardKind = "unit" | "general" | "stratagem";
export type Rarity = "basic" | "common" | "rare" | "legend";
export type CardEffect =
  | "power"
  | "guard"
  | "heal"
  | "draw"
  | "burn"
  | "wind"
  | "wet"
  | "intimidate"
  | "ambush"
  | "move"
  | "borrowArrows"
  | "chain"
  | "supply"
  | "oath"
  | "pierce";

export interface CardDefinition {
  id: string;
  name: string;
  kind: CardKind;
  rarity: Rarity;
  cost: number;
  attack: number;
  guard: number;
  speed: number;
  tags: string[];
  effect: CardEffect;
  value: number;
  description: string;
  quote: string;
  color: "ink" | "red" | "gold" | "blue" | "green";
}

export interface QueuedCard {
  instanceId: string;
  cardId: string;
  lane: LaneIndex;
}

export interface LaneState {
  momentum: number;
  playerPower: number;
  enemyPower: number;
  burn: number;
  wet: number;
  intimidated: number;
  chained: boolean;
  playerCards: QueuedCard[];
}

export interface EnemyIntent {
  lane: LaneIndex;
  power: number;
  label: string;
  kind: "attack" | "archers" | "cavalry" | "shield" | "erase" | "rain";
}

export interface BattleState {
  seed: number;
  rngCursor: number;
  levelId: string;
  beat: number;
  maxBeats: number;
  breachThreshold: number;
  breachDamage: number;
  breachReset: number;
  strategyRecovery: number;
  firstBreachGuard: number;
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  strategy: number;
  maxStrategy: number;
  wind: -1 | 0 | 1;
  hand: string[];
  drawPile: string[];
  discardPile: string[];
  lanes: [LaneState, LaneState, LaneState];
  intent: EnemyIntent[];
  objective: string;
  result: "playing" | "victory" | "defeat";
  log: string[];
  selectedCardId?: string;
  undoSnapshot?: string;
  sealAvailable: boolean;
  upgradedCards: string[];
}

export interface LevelDefinition {
  id: string;
  chapterId: string;
  order: number;
  name: string;
  type: "battle" | "elite" | "event" | "camp" | "boss";
  subtitle: string;
  enemyName: string;
  enemyHp: number;
  difficulty: number;
  maxBeats: number;
  objective: string;
  reward: number;
  background: "peach" | "changban" | "redcliff";
  battleRules?: {
    breachThreshold?: number;
    breachDamage?: number;
    breachReset?: number;
    startingStrategy?: number;
    strategyRecovery?: number;
    maxEnemyIntents?: number;
  };
  modifier?: "oath" | "escort" | "nameless" | "wind" | "fire" | "boss";
}

export interface ChapterDefinition {
  id: string;
  name: string;
  subtitle: string;
  intro: string;
  color: string;
  levels: LevelDefinition[];
}

export interface RunState {
  chapterIndex: number;
  nodeIndex: number;
  merit: number;
  deck: string[];
  upgradedCards: string[];
  completedLevelIds: string[];
  sealCount: number;
  annotation?: string;
  battle?: BattleState;
}

export interface SaveData {
  version: 1;
  tutorialCompleted: boolean;
  historyInk: number;
  unlockedCards: string[];
  unlockedGenerals: string[];
  completedChapters: string[];
  run?: RunState;
  settings: {
    music: boolean;
    haptics: boolean;
    reducedMotion: boolean;
    manualBeat: boolean;
    largeText: boolean;
  };
  stats: {
    battlesWon: number;
    runsStarted: number;
    endingsSeen: number;
  };
}

export type GameScreen = "title" | "desk" | "map" | "deck" | "battle" | "reward" | "camp" | "story" | "codex" | "settings" | "ending";
