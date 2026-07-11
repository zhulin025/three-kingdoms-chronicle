import { cardById } from "./content";
import type { BattleState, CardDefinition, EnemyIntent, LaneIndex, LaneState, LevelDefinition } from "./types";

function nextRandom(seed: number, cursor: number) {
  let value = (seed + cursor * 0x6d2b79f5) | 0;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function shuffle<T>(items: T[], seed: number, cursor = 0): { items: T[]; cursor: number } {
  const result = [...items];
  let nextCursor = cursor;
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = nextRandom(seed, nextCursor++);
    const target = Math.floor(random * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return { items: result, cursor: nextCursor };
}

const emptyLane = (): LaneState => ({ momentum: 0, playerPower: 0, enemyPower: 0, burn: 0, wet: 0, intimidated: 0, chained: false, playerCards: [] });
const defaultBreachThreshold = 9;
const defaultBreachDamage = 8;
const defaultBreachReset = 3;
const timeoutPressureDamage = 3;

function generateIntents(state: Pick<BattleState, "seed" | "rngCursor" | "beat" | "enemyHp" | "enemyMaxHp">, level: LevelDefinition) {
  const rawCount = level.type === "boss" ? (state.beat % 3 === 0 ? 3 : 2) : level.type === "elite" ? 2 : state.beat % 3 === 0 ? 2 : 1;
  const count = Math.min(rawCount, level.battleRules?.maxEnemyIntents ?? rawCount);
  const intents: EnemyIntent[] = [];
  let cursor = state.rngCursor;
  const bossPhase = level.type === "boss" ? Math.min(2, Math.floor((1 - state.enemyHp / Math.max(1, state.enemyMaxHp)) * 3)) : 0;
  for (let index = 0; index < count; index += 1) {
    const lane = Math.floor(nextRandom(state.seed, cursor++) * 3) as LaneIndex;
    const kindRoll = nextRandom(state.seed, cursor++);
    const kind: EnemyIntent["kind"] = level.modifier === "nameless" && kindRoll > 0.62
      ? "erase"
      : level.background === "redcliff" && kindRoll > 0.72
        ? "rain"
        : kindRoll > 0.72
          ? "cavalry"
          : kindRoll > 0.48
            ? "archers"
            : kindRoll > 0.25
              ? "shield"
              : "attack";
    const variance = Math.floor(nextRandom(state.seed, cursor++) * 3);
    const power = Math.max(2, 2 + level.difficulty + bossPhase + variance + (kind === "cavalry" ? 1 : 0));
    const label = kind === "erase" ? "涂名" : kind === "rain" ? "墨雨" : kind === "cavalry" ? "骑阵冲锋" : kind === "archers" ? "箭阵" : kind === "shield" ? "盾阵" : "进军";
    intents.push({ lane, power, kind, label });
  }
  return { intents, cursor };
}

function drawCards(state: BattleState, count: number) {
  for (let index = 0; index < count; index += 1) {
    if (state.hand.length >= 7) return;
    if (!state.drawPile.length) {
      if (!state.discardPile.length) return;
      const shuffled = shuffle(state.discardPile, state.seed, state.rngCursor);
      state.drawPile = shuffled.items;
      state.discardPile = [];
      state.rngCursor = shuffled.cursor;
    }
    const next = state.drawPile.shift();
    if (next) state.hand.push(next);
  }
}

export function createBattle(level: LevelDefinition, deck: string[], upgradedCards: string[], sealAvailable = true, annotation?: string, seedOverride?: number): BattleState {
  const seed = seedOverride ?? Math.abs(hashString(`${level.id}:${Date.now()}:${deck.join(",")}`));
  const shuffled = shuffle(deck, seed);
  const state: BattleState = {
    seed,
    rngCursor: shuffled.cursor,
    levelId: level.id,
    beat: 1,
    maxBeats: level.maxBeats,
    breachThreshold: level.battleRules?.breachThreshold ?? defaultBreachThreshold,
    breachDamage: level.battleRules?.breachDamage ?? defaultBreachDamage,
    breachReset: level.battleRules?.breachReset ?? defaultBreachReset,
    strategyRecovery: level.battleRules?.strategyRecovery ?? 2,
    firstBreachGuard: annotation === "坚心" ? 3 : 0,
    playerHp: level.enemyHp,
    playerMaxHp: level.enemyHp,
    enemyHp: level.enemyHp,
    enemyMaxHp: level.enemyHp,
    strategy: Math.min(5, (level.battleRules?.startingStrategy ?? 2) + (annotation === "足智" ? 1 : 0)),
    maxStrategy: 5,
    wind: 0,
    hand: [],
    drawPile: shuffled.items,
    discardPile: [],
    lanes: [emptyLane(), emptyLane(), emptyLane()],
    intent: [],
    objective: level.objective,
    result: "playing",
    log: [`进入「${level.name}」：${level.objective}`],
    sealAvailable,
    upgradedCards
  };
  drawCards(state, annotation === "博闻" ? 6 : 5);
  const generated = generateIntents(state, level);
  state.intent = generated.intents;
  state.rngCursor = generated.cursor;
  return state;
}

export function playCard(input: BattleState, cardId: string, laneIndex: LaneIndex): BattleState {
  if (input.result !== "playing") return input;
  const state = structuredClone(input);
  const card = cardById.get(cardId);
  if (!card || !state.hand.includes(cardId)) return input;
  const upgraded = state.upgradedCards.includes(cardId);
  const cost = Math.max(0, card.cost - (upgraded && card.kind === "stratagem" ? 0 : 0));
  if (state.strategy < cost) return input;
  state.undoSnapshot = JSON.stringify({ ...input, undoSnapshot: undefined });
  state.strategy -= cost;
  state.hand.splice(state.hand.indexOf(cardId), 1);
  state.discardPile.push(cardId);
  const lane = state.lanes[laneIndex];
  const bonus = upgraded ? 1 : 0;
  const hasGeneral = lane.playerCards.some((queued) => cardById.get(queued.cardId)?.kind === "general");
  const basePower = card.attack + Math.floor(card.guard / 2) + bonus;
  lane.playerPower += basePower;
  lane.playerCards.push({ instanceId: `${state.beat}-${laneIndex}-${state.discardPile.length}-${cardId}`, cardId, lane: laneIndex });
  applyEffect(state, card, laneIndex, card.value + bonus, hasGeneral);
  state.log.unshift(`第 ${state.beat} 拍：${card.name}入${["上", "中", "下"][laneIndex]}路`);
  return state;
}

function applyEffect(state: BattleState, card: CardDefinition, laneIndex: LaneIndex, value: number, hadGeneral: boolean) {
  const lane = state.lanes[laneIndex];
  switch (card.effect) {
    case "power":
      if (card.id === "arrowStorm") state.lanes.forEach((item) => { item.playerPower += value; });
      else if (card.id === "militia") lane.playerPower += hadGeneral ? value : 0;
      else if (card.id === "crossbow") lane.playerPower += lane.wet ? value : 0;
      else lane.playerPower += value;
      break;
    case "guard":
      lane.intimidated += value;
      if (lane.momentum < 0) lane.playerPower += 1;
      break;
    case "heal":
      state.playerHp = Math.min(state.playerMaxHp, state.playerHp + value);
      lane.enemyPower = Math.max(0, lane.enemyPower - 1);
      if (card.id === "liuBei") adjacent(laneIndex).forEach((index) => { state.lanes[index].playerPower += 1; });
      break;
    case "draw":
      drawCards(state, value);
      break;
    case "burn":
      lane.burn = Math.min(6, lane.burn + value + (state.wind ? 1 : 0));
      if ((lane.chained || card.id === "zhouYu") && lane.burn >= 2) adjacent(laneIndex).forEach((index) => { state.lanes[index].burn = Math.min(6, state.lanes[index].burn + 1); });
      break;
    case "wind":
      state.wind = 1;
      state.lanes.forEach((item) => { if (item.burn) item.burn = Math.min(6, item.burn + 1); });
      if (card.id === "zhugeLiang") drawCards(state, 1);
      break;
    case "wet":
      lane.wet = 2;
      lane.burn = 0;
      lane.playerPower += 1;
      break;
    case "intimidate":
      lane.intimidated += value;
      break;
    case "ambush":
      if (state.intent.some((intent) => intent.lane === laneIndex)) lane.playerPower += value;
      break;
    case "move":
      adjacent(laneIndex).forEach((index) => {
        const moved = Math.min(value, state.lanes[index].playerPower);
        if (card.id === "rescue") {
          state.lanes[index].playerPower -= moved;
          lane.playerPower += moved;
        } else {
          state.lanes[index].playerPower += value;
        }
      });
      break;
    case "borrowArrows":
      lane.wet = 2;
      lane.burn = 0;
      if (state.intent.some((intent) => intent.lane === laneIndex && intent.kind === "archers")) {
        lane.playerPower += value;
        drawCards(state, 1);
      }
      break;
    case "chain":
      lane.chained = true;
      break;
    case "supply":
      state.strategy = Math.min(state.maxStrategy, state.strategy + value);
      break;
    case "oath":
      lane.playerPower += value;
      if (lane.playerCards.some((queued) => cardById.get(queued.cardId)?.tags.includes("结义"))) state.lanes.forEach((item) => { item.playerPower += 1; });
      break;
    case "pierce":
      if (lane.momentum <= 0) lane.playerPower += value;
      break;
  }
  if (card.id === "zhangFei" && state.playerHp <= state.playerMaxHp / 2) lane.playerPower += 2;
}

export function endBeat(input: BattleState, level: LevelDefinition): BattleState {
  if (input.result !== "playing") return input;
  const state = structuredClone(input);
  state.undoSnapshot = undefined;
  state.lanes.forEach((lane) => { lane.enemyPower = 0; });
  state.intent.forEach((intent) => {
    const lane = state.lanes[intent.lane];
    if (intent.kind === "rain") {
      lane.wet = 2;
      lane.burn = 0;
    }
    lane.enemyPower += intent.power;
  });
  state.lanes.forEach((lane, laneIndex) => {
    lane.enemyPower = Math.max(0, lane.enemyPower - lane.intimidated);
    if (lane.burn > 0 && lane.wet === 0) {
      lane.playerPower += lane.burn;
      if (lane.chained || state.wind) adjacent(laneIndex as LaneIndex).forEach((index) => { state.lanes[index].burn = Math.min(6, state.lanes[index].burn + 1); });
    }
    const delta = Math.max(-5, Math.min(5, lane.playerPower - lane.enemyPower));
    lane.momentum += delta;
    if (delta !== 0) state.log.unshift(`第 ${state.beat} 拍·${["上", "中", "下"][laneIndex]}路：战力差 ${delta > 0 ? "+" : ""}${delta}，军势 ${lane.momentum > 0 ? "+" : ""}${lane.momentum}`);
    if (lane.momentum >= state.breachThreshold) {
      const ramBonus = lane.playerCards.some((queued) => queued.cardId === "ram") ? 3 : 0;
      state.enemyHp = Math.max(0, state.enemyHp - state.breachDamage - ramBonus);
      lane.momentum = state.breachReset;
      state.log.unshift(`第 ${state.beat} 拍·${["上", "中", "下"][laneIndex]}路破阵：敌帐 -${state.breachDamage + ramBonus}`);
    }
    if (lane.momentum <= -state.breachThreshold) {
      const guard = Math.min(state.firstBreachGuard, state.breachDamage);
      const damage = state.breachDamage - guard;
      state.playerHp = Math.max(0, state.playerHp - damage);
      state.firstBreachGuard = 0;
      lane.momentum = -state.breachReset;
      state.log.unshift(`第 ${state.beat} 拍·${["上", "中", "下"][laneIndex]}路失守：我方主帐 -${damage}${guard ? `（坚心减免 ${guard}）` : ""}`);
    }
    lane.playerPower = 0;
    lane.enemyPower = 0;
    lane.intimidated = 0;
    lane.playerCards = [];
    lane.burn = Math.max(0, lane.burn - 1);
    lane.wet = Math.max(0, lane.wet - 1);
  });
  if (state.enemyHp <= 0) {
    state.result = "victory";
    state.log.unshift(`胜利：敌方主帐生命归零（第 ${state.beat} 拍）`);
  }
  if (state.playerHp <= 0) state.result = "defeat";
  if (state.result === "playing" && state.beat >= state.maxBeats) {
    state.playerHp = Math.max(0, state.playerHp - timeoutPressureDamage);
    state.enemyHp = Math.max(0, state.enemyHp - timeoutPressureDamage);
    state.log.unshift(`第 ${state.beat} 拍·超时消耗：敌方主帐 -${timeoutPressureDamage}（剩余 ${state.enemyHp}）`);
    state.log.unshift(`第 ${state.beat} 拍·超时消耗：我方主帐 -${timeoutPressureDamage}（剩余 ${state.playerHp}）`);
    if (state.enemyHp <= 0) {
      state.result = "victory";
      state.log.unshift(`胜利：超时消耗使敌方主帐生命归零（第 ${state.beat} 拍）`);
    } else if (state.playerHp <= 0) {
      state.result = "defeat";
      state.log.unshift(`战败：超时消耗使我方主帐生命归零（第 ${state.beat} 拍）`);
    }
  }
  if (state.result === "playing") {
    state.beat += 1;
    state.strategy = Math.min(state.maxStrategy, state.strategy + state.strategyRecovery);
    if (state.beat % 3 === 0) state.wind = 0;
    drawCards(state, 1);
    const generated = generateIntents(state, level);
    state.intent = generated.intents;
    state.rngCursor = generated.cursor;
  }
  return state;
}

export function undoLastPlay(input: BattleState): BattleState {
  if (!input.sealAvailable || !input.undoSnapshot) return input;
  try {
    const restored = JSON.parse(input.undoSnapshot) as BattleState;
    restored.firstBreachGuard ??= input.firstBreachGuard ?? 0;
    restored.sealAvailable = false;
    restored.undoSnapshot = undefined;
    restored.log.unshift("朱批：撤回上一道军令");
    return restored;
  } catch {
    return input;
  }
}

export function battleHash(state: BattleState) {
  return hashString(JSON.stringify({ beat: state.beat, hp: [state.playerHp, state.enemyHp], guard: state.firstBreachGuard, strategy: state.strategy, hand: state.hand, draw: state.drawPile, lanes: state.lanes.map((lane) => [lane.momentum, lane.burn, lane.wet]), cursor: state.rngCursor, result: state.result }));
}

export function pickDeterministic<T>(items: T[], seed: number, count: number) {
  return shuffle(items, seed).items.slice(0, count);
}

function adjacent(index: LaneIndex): LaneIndex[] {
  if (index === 0) return [1];
  if (index === 2) return [1];
  return [0, 2];
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash | 0;
}
