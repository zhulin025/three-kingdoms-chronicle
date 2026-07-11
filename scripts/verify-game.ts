import assert from "node:assert/strict";
import { cardById, cards, chapters, starterDeck } from "../src/game/content";
import { battleHash, createBattle, endBeat, playCard, undoLastPlay } from "../src/game/engine";

assert.equal(cards.length, 30, "MVP must contain exactly 30 cards");
assert.equal(chapters.length, 3, "MVP must contain three chapters");
assert.deepEqual(chapters.map((chapter) => chapter.levels.length), [6, 6, 6], "each chapter must expose six visited nodes");
assert.equal(starterDeck.length, 12, "starter deck must contain 12 cards");
assert.equal(new Set(cards.map((card) => card.id)).size, cards.length, "card ids must be unique");
assert.equal(new Set(chapters.flatMap((chapter) => chapter.levels.map((level) => level.id))).size, 18, "level ids must be unique");
starterDeck.forEach((id) => assert.ok(cardById.has(id), `starter card ${id} must exist`));

const level = chapters[0].levels[0];
const first = createBattle(level, starterDeck, [], true, undefined, 20260710);
const second = createBattle(level, starterDeck, [], true, undefined, 20260710);
assert.equal(battleHash(first), battleHash(second), "same seed must create identical battles");
assert.equal(first.breachThreshold, 6, "tutorial battle must use a shorter breach track");
assert.equal(first.breachDamage, 10, "tutorial battle must end after one clean breach");
assert.equal(first.enemyHp, 10, "tutorial enemy must fall after demonstrating one full breach");
assert.equal(first.strategy, 3, "tutorial battle must let the player combine cards immediately");
assert.equal(first.intent.length, 1, "tutorial battle must present one enemy decision at a time");
const resilient = createBattle(level, starterDeck, [], true, "坚心", 20260710);
assert.equal(resilient.playerHp, resilient.enemyHp, "each battle must begin with equal command health");
assert.equal(resilient.playerMaxHp, resilient.enemyMaxHp, "both sides must use the same health cap");
assert.equal(resilient.firstBreachGuard, 3, "resilient annotation must reduce the first breach instead of adding health");
for (const chapter of chapters) {
  for (const combat of chapter.levels.filter((item) => item.type !== "camp")) {
    const battle = createBattle(combat, starterDeck, [], true, undefined, 20260710);
    assert.equal(battle.playerHp, battle.enemyHp, `${combat.id} must start with equal health`);
    assert.equal(battle.playerMaxHp, battle.enemyMaxHp, `${combat.id} must use equal health caps`);
  }
}
const guardedBreach = structuredClone(resilient);
guardedBreach.intent = [];
guardedBreach.lanes[0].momentum = -guardedBreach.breachThreshold;
const afterGuardedBreach = endBeat(guardedBreach, level);
assert.equal(afterGuardedBreach.playerHp, 3, "resilient annotation must reduce the first 10-damage breach to 7");
assert.equal(afterGuardedBreach.firstBreachGuard, 0, "resilient guard must be consumed after the first breach");

let firstReplay = structuredClone(first);
let secondReplay = structuredClone(second);
for (let beat = 0; beat < 4; beat += 1) {
  firstReplay = endBeat(firstReplay, level);
  secondReplay = endBeat(secondReplay, level);
  assert.equal(battleHash(firstReplay), battleHash(secondReplay), `replay diverged at beat ${beat + 1}`);
}

const playable = structuredClone(first);
playable.hand = ["fireAttack", "eastWind", "militia", "shield", "scout"];
playable.strategy = 5;
const afterWind = playCard(playable, "eastWind", 1);
assert.equal(afterWind.wind, 1, "east wind must set wind state");
const afterFire = playCard(afterWind, "fireAttack", 1);
assert.ok(afterFire.lanes[1].burn >= 3, "fire under east wind must apply at least three burn");
assert.ok(afterFire.undoSnapshot, "playing a card must create an undo snapshot");
const restored = undoLastPlay(afterFire);
assert.equal(restored.sealAvailable, false, "undo must consume the seal");
assert.ok(restored.hand.includes("fireAttack"), "undo must return the last card to hand");

const exhausted = structuredClone(first);
exhausted.strategy = 0;
exhausted.hand = ["fireAttack"];
assert.strictEqual(playCard(exhausted, "fireAttack", 0), exhausted, "cards cannot be played without enough strategy");

let overtime = structuredClone(first);
overtime.enemyHp = 3;
overtime.beat = overtime.maxBeats;
overtime = endBeat(overtime, level);
assert.equal(overtime.enemyHp, 0, "overtime must damage the enemy to accelerate battle resolution");
assert.equal(overtime.playerHp, 7, "overtime must apply the same damage to the player");
assert.equal(overtime.result, "victory", "overtime may end a battle when enemy HP reaches zero");
assert.ok(overtime.log.some((entry) => entry.includes("超时消耗使敌方主帐生命归零")), "overtime victory must explain its cause in the battle report");

console.log("Game verification passed: 30 cards, 18 nodes, deterministic replay, card costs, wind/fire and seal undo.");
