import { chapters, starterDeck, starterUnlocks } from "./content";
import type { SaveData } from "./types";

const CURRENT_KEY = "chronicle.save.v1";
const PREVIOUS_KEY = "chronicle.save.previous.v1";

export function createDefaultSave(): SaveData {
  return {
    version: 1,
    tutorialCompleted: false,
    historyInk: 0,
    unlockedCards: [...starterUnlocks],
    unlockedGenerals: ["liuBei"],
    completedChapters: [],
    settings: { music: true, haptics: true, reducedMotion: false, manualBeat: true, largeText: false },
    stats: { battlesWon: 0, runsStarted: 0, endingsSeen: 0 }
  };
}

export function createNewRun() {
  return {
    chapterIndex: 0,
    nodeIndex: 0,
    merit: 0,
    deck: [...starterDeck],
    upgradedCards: [],
    completedLevelIds: [],
    sealCount: 1
  };
}

export function loadSave(): SaveData {
  const current = read(CURRENT_KEY);
  if (current) return current;
  const previous = read(PREVIOUS_KEY);
  return previous || createDefaultSave();
}

export function writeSave(save: SaveData) {
  try {
    const existing = localStorage.getItem(CURRENT_KEY);
    if (existing) localStorage.setItem(PREVIOUS_KEY, existing);
    localStorage.setItem(CURRENT_KEY, JSON.stringify(save));
  } catch (error) {
    console.warn("Unable to persist Chronicle save", error);
  }
}

export function clearSave() {
  localStorage.removeItem(CURRENT_KEY);
  localStorage.removeItem(PREVIOUS_KEY);
}

function read(key: string): SaveData | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveData;
    if (parsed.version !== 1 || !parsed.settings || !parsed.stats) return null;
    if (parsed.run?.battle) {
      const battle = parsed.run.battle;
      const level = chapters.flatMap((chapter) => chapter.levels).find((item) => item.id === battle.levelId);
      if (level) {
        battle.playerMaxHp = level.enemyHp;
        battle.playerHp = Math.min(battle.playerHp, level.enemyHp);
      }
      battle.firstBreachGuard = battle.firstBreachGuard ?? 0;
      battle.breachThreshold = level?.battleRules?.breachThreshold ?? battle.breachThreshold ?? 9;
      battle.breachDamage = level?.battleRules?.breachDamage ?? battle.breachDamage ?? 8;
      battle.breachReset = level?.battleRules?.breachReset ?? battle.breachReset ?? 3;
      battle.strategyRecovery = level?.battleRules?.strategyRecovery ?? battle.strategyRecovery ?? 2;
    }
    return { ...parsed, tutorialCompleted: Boolean(parsed.tutorialCompleted) };
  } catch {
    return null;
  }
}
