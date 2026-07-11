import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { ArrowLeft, BookOpen, Check, ChevronRight, Flame, Heart, Info, Pause, Play, RotateCcw, ScrollText, Settings, Shield, Sparkles, Swords, Volume2, VolumeX, Wind, X } from "lucide-react";
import { cardById, cards, chapters, rewardPools } from "./content";
import { createBattle, endBeat, pickDeterministic, playCard, undoLastPlay } from "./engine";
import { Battlefield3D } from "./Battlefield3D";
import { clearSave, createDefaultSave, createNewRun, loadSave, writeSave } from "./save";
import type { BattleState, CardDefinition, GameScreen, LaneIndex, LevelDefinition, SaveData } from "./types";

const annotations = [
  { id: "博闻", title: "博闻强记", detail: "下一次战役起始手牌 +1" },
  { id: "足智", title: "谋定后动", detail: "下一次战役起始谋略 +1" },
  { id: "坚心", title: "败而不馁", detail: "下一次战役首次失守伤害 -3" }
];

export function GameApp() {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [screen, setScreen] = useState<GameScreen>(() => {
    const stored = loadSave();
    return stored.run?.battle ? "battle" : stored.run ? "desk" : "title";
  });
  const [toast, setToast] = useState("");
  const [storyMode, setStoryMode] = useState<"intro" | "event">("intro");
  const [battleResultHandled, setBattleResultHandled] = useState(false);
  const [selectedReward, setSelectedReward] = useState<string[]>([]);

  const run = save.run;
  const chapter = run ? chapters[Math.min(run.chapterIndex, chapters.length - 1)] : chapters[0];
  const activeLevel = run ? chapter.levels[Math.min(run.nodeIndex, chapter.levels.length - 1)] : chapter.levels[0];
  const awaitingBattleAdvance = Boolean(run?.battle?.result === "victory" && run.completedLevelIds.includes(run.battle.levelId));

  useEffect(() => writeSave(save), [save]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const updateSave = (updater: (current: SaveData) => SaveData) => setSave((current) => updater(structuredClone(current)));
  const feedback = (kind: "light" | "success" | "error" = "light") => {
    if (!save.settings.haptics) return;
    if (kind === "success") void Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
    else if (kind === "error") void Haptics.notification({ type: NotificationType.Error }).catch(() => undefined);
    else void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  };

  const startNewRun = (annotation?: string) => {
    updateSave((next) => {
      next.run = { ...createNewRun(), annotation };
      next.stats.runsStarted += 1;
      return next;
    });
    setStoryMode("intro");
    setScreen("story");
    feedback("success");
  };

  const enterNode = () => {
    if (!run) return;
    if (run.completedLevelIds.includes(activeLevel.id)) {
      advanceNode();
      return;
    }
    if (run.battle?.levelId === activeLevel.id && run.battle.result === "playing") {
      setBattleResultHandled(false);
      setScreen("battle");
      return;
    }
    if (activeLevel.type === "camp") {
      setScreen("camp");
      return;
    }
    if (activeLevel.type === "event") {
      setStoryMode("event");
      setScreen("story");
      return;
    }
    beginBattle(activeLevel);
  };

  const beginBattle = (level: LevelDefinition) => {
    if (!save.run) return;
    updateSave((next) => {
      if (!next.run) return next;
      next.run.battle = createBattle(level, next.run.deck, next.run.upgradedCards, next.run.sealCount > 0, next.run.annotation);
      next.run.annotation = undefined;
      return next;
    });
    setBattleResultHandled(false);
    setScreen("battle");
    feedback();
  };

  const updateBattle = (battle: BattleState) => updateSave((next) => {
    if (next.run) next.run.battle = battle;
    return next;
  });

  const finishBattle = () => {
    if (!run?.battle || battleResultHandled) return;
    setBattleResultHandled(true);
    if (run.battle.result === "victory") {
      feedback("success");
      updateSave((next) => {
        if (!next.run?.battle) return next;
        next.run.merit += activeLevel.reward;
        next.run.completedLevelIds.push(activeLevel.id);
        if (!next.run.battle.sealAvailable) next.run.sealCount = Math.max(0, next.run.sealCount - 1);
        next.stats.battlesWon += 1;
        next.historyInk += activeLevel.type === "boss" ? 30 : 8;
        return next;
      });
      const pool = rewardPools[chapter.id] || [];
      setSelectedReward(pickDeterministic(pool, run.battle.seed + run.battle.beat, 3));
      setScreen("reward");
    } else {
      feedback("error");
    }
  };

  const advanceNode = () => {
    let nextScreen: GameScreen = "map";
    updateSave((next) => {
      if (!next.run) return next;
      next.run.battle = undefined;
      if (next.run.nodeIndex >= chapters[next.run.chapterIndex].levels.length - 1) {
        const finishedChapter = chapters[next.run.chapterIndex];
        if (!next.completedChapters.includes(finishedChapter.id)) next.completedChapters.push(finishedChapter.id);
        next.run.chapterIndex += 1;
        next.run.nodeIndex = 0;
        next.run.sealCount = 1;
        if (finishedChapter.id === "peach") unlock(next, ["guanYu", "zhangFei"], ["guanYu", "zhangFei", "roar"]);
        if (finishedChapter.id === "changban") unlock(next, ["zhaoYun"], ["zhaoYun", "rescue"]);
        if (finishedChapter.id === "redcliff") unlock(next, ["zhugeLiang", "zhouYu"], ["zhugeLiang", "zhouYu", "eastWind", "fireAttack"]);
        if (next.run.chapterIndex >= chapters.length) {
          next.stats.endingsSeen += 1;
          next.run = undefined;
          nextScreen = "ending";
        } else {
          nextScreen = "story";
          setStoryMode("intro");
        }
      } else {
        next.run.nodeIndex += 1;
      }
      return next;
    });
    setScreen(nextScreen);
  };

  const takeReward = (cardId?: string) => {
    if (cardId) {
      updateSave((next) => {
        if (!next.run) return next;
        next.run.deck.push(cardId);
        if (!next.unlockedCards.includes(cardId)) next.unlockedCards.push(cardId);
        const card = cardById.get(cardId);
        if (card?.kind === "general" && !next.unlockedGenerals.includes(cardId)) next.unlockedGenerals.push(cardId);
        return next;
      });
      setToast(`已将「${cardById.get(cardId)?.name}」收入牌组`);
    }
    if (cardId && (run?.deck.length || 0) >= 12) {
      setScreen("deck");
    } else {
      advanceNode();
    }
  };

  const finishDeckEdit = () => {
    if (!save.run) return;
    if (save.run.deck.length !== 12) {
      setToast(`牌组必须恰好 12 张，当前 ${save.run.deck.length} 张`);
      return;
    }
    advanceNode();
  };

  const eventChoice = (choice: "safe" | "risk") => {
    updateSave((next) => {
      if (!next.run) return next;
      if (choice === "safe") {
        next.run.sealCount = Math.min(2, next.run.sealCount + 1);
      } else {
        const pool = rewardPools[chapter.id];
        const reward = pickDeterministic(pool, next.run.chapterIndex * 100 + next.run.nodeIndex, 1)[0];
        if (reward && !next.run.deck.includes(reward)) {
          const duplicateIndex = next.run.deck.findIndex((id, index, deck) => deck.indexOf(id) !== index);
          next.run.deck.splice(duplicateIndex >= 0 ? duplicateIndex : 0, 1, reward);
          if (!next.unlockedCards.includes(reward)) next.unlockedCards.push(reward);
        } else {
          const upgrade = next.run.deck.find((id) => !next.run!.upgradedCards.includes(id));
          if (upgrade) next.run.upgradedCards.push(upgrade);
        }
      }
      return next;
    });
    beginBattle(activeLevel);
  };

  const finishCamp = () => {
    updateSave((next) => {
      if (next.run) next.run.completedLevelIds.push(activeLevel.id);
      return next;
    });
    advanceNode();
  };

  const resetAll = () => {
    clearSave();
    setSave(createDefaultSave());
    setScreen("title");
  };

  return (
    <div className={`chronicle-app ${save.settings.reducedMotion ? "reduce-motion" : ""} ${save.settings.largeText ? "large-text" : ""}`}>
      <div className="paper-noise" aria-hidden="true" />
      {screen === "title" && <TitleScreen hasRun={Boolean(run)} onContinue={() => setScreen("desk")} onNew={() => startNewRun()} onSettings={() => setScreen("settings")} />}
      {screen === "desk" && <DeskScreen save={save} onContinue={() => run ? setScreen("map") : startNewRun()} onCodex={() => setScreen("codex")} onSettings={() => setScreen("settings")} />}
      {screen === "map" && run && <MapScreen chapter={chapter} run={run} activeLevel={activeLevel} onBack={() => setScreen("desk")} onEnter={enterNode} onDeck={() => setScreen("deck")} />}
      {screen === "deck" && run && <DeckScreen save={save} mode="run" onBack={() => run.deck.length > 12 ? setToast("请先将牌组整理为 12 张") : awaitingBattleAdvance ? advanceNode() : activeLevel.type === "camp" ? setScreen("camp") : setScreen("map")} onRemove={(index) => updateSave((next) => { next.run?.deck.splice(index, 1); return next; })} onFinish={run.deck.length > 12 || awaitingBattleAdvance ? finishDeckEdit : undefined} />}
      {screen === "codex" && <DeckScreen save={save} mode="codex" onBack={() => setScreen("desk")} />}
      {screen === "story" && <StoryScreen chapter={chapter} level={activeLevel} mode={storyMode} onBack={() => setScreen(run ? "map" : "title")} onContinue={() => storyMode === "intro" ? setScreen("map") : eventChoice("safe")} onRisk={() => eventChoice("risk")} />}
      {screen === "battle" && run?.battle && <BattleScreen battle={run.battle} level={activeLevel} settings={save.settings} tutorialCompleted={save.tutorialCompleted} onTutorialComplete={() => updateSave((next) => { next.tutorialCompleted = true; return next; })} onBattle={updateBattle} onFinish={finishBattle} onRetreat={() => setScreen("map")} onDefeat={(annotation) => startNewRun(annotation)} feedback={feedback} />}
      {screen === "reward" && <RewardScreen level={activeLevel} battle={run?.battle} rewards={selectedReward} onPick={takeReward} />}
      {screen === "camp" && run && <CampScreen run={run} onRestoreSeal={() => updateSave((next) => { if (next.run && next.run.merit >= 30 && next.run.sealCount < 2) { next.run.merit -= 30; next.run.sealCount += 1; } return next; })} onUpgrade={() => updateSave((next) => { if (!next.run || next.run.merit < 40) return next; const target = next.run.deck.find((id) => !next.run!.upgradedCards.includes(id)); if (target) { next.run.merit -= 40; next.run.upgradedCards.push(target); } return next; })} onDeck={() => setScreen("deck")} onLeave={finishCamp} />}
      {screen === "settings" && <SettingsScreen save={save} onBack={() => setScreen(run ? "desk" : "title")} onChange={(key) => updateSave((next) => { next.settings[key] = !next.settings[key]; return next; })} onReset={resetAll} />}
      {screen === "ending" && <EndingScreen onDesk={() => setScreen("desk")} onAgain={() => startNewRun()} />}
      {toast && <div className="game-toast" role="status">{toast}</div>}
    </div>
  );
}

function TitleScreen({ hasRun, onContinue, onNew, onSettings }: { hasRun: boolean; onContinue: () => void; onNew: () => void; onSettings: () => void }) {
  return <main className="title-screen game-screen">
    <div className="title-sun" />
    <div className="mountain mountain-a" /><div className="mountain mountain-b" />
    <div className="title-copy">
      <span className="eyebrow">章回式军阵构筑</span>
      <h1><small>三国</small>残卷<br />定乾坤</h1>
      <p>名场面正在从演义中消失。执朱批，召将魂，在三路军阵上夺回被抹去的因果。</p>
    </div>
    <div className="title-actions">
      {hasRun && <button className="gold-button" onClick={onContinue}><Play size={18} />继续残卷</button>}
      <button className={hasRun ? "ink-button" : "gold-button"} onClick={onNew}>{hasRun ? "重开一卷" : "提笔入卷"}</button>
      <button className="icon-button" aria-label="设置" onClick={onSettings}><Settings size={20} /></button>
    </div>
    <span className="version-mark">MVP · iOS</span>
  </main>;
}

function DeskScreen({ save, onContinue, onCodex, onSettings }: { save: SaveData; onContinue: () => void; onCodex: () => void; onSettings: () => void }) {
  return <main className="desk-screen game-screen">
    <Header title="司史书案" right={<button className="icon-button" onClick={onSettings}><Settings size={20} /></button>} />
    <section className="desk-hero">
      <span className="seal">史</span>
      <div><span className="eyebrow">演义原卷</span><h2>{save.run ? chapters[save.run.chapterIndex]?.name || "原卷已复" : "等待落笔"}</h2><p>{save.run ? `当前来到第 ${save.run.nodeIndex + 1} 节，每场战斗双方主帐重新整备` : "三枚原文印仍散落在崩坏的章回中。"}</p></div>
    </section>
    <button className="scroll-entry primary-scroll" onClick={onContinue}><div><strong>{save.run ? "继续战役" : "新开残卷"}</strong><span>{save.run ? "回到九章战图" : "从桃园残誓开始"}</span></div><ChevronRight /></button>
    <div className="desk-grid">
      <button className="desk-tile" onClick={onCodex}><BookOpen /><strong>将魂与卡牌簿</strong><span>{save.unlockedCards.length} / {cards.length} 已录</span></button>
      <div className="desk-tile static"><ScrollText /><strong>原文印</strong><span>{save.completedChapters.length} / 3 已复</span></div>
      <div className="desk-tile static"><Sparkles /><strong>史墨</strong><span>{save.historyInk} 点</span></div>
      <div className="desk-tile static"><Swords /><strong>战绩</strong><span>{save.stats.battlesWon} 胜</span></div>
    </div>
    <blockquote>“记录不是替英雄辩护，而是不让选择被遗忘。”</blockquote>
  </main>;
}

function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return <header className="game-header">{onBack ? <button className="icon-button" onClick={onBack}><ArrowLeft /></button> : <span />}<strong>{title}</strong>{right || <span />}</header>;
}

function MapScreen({ chapter, run, activeLevel, onBack, onEnter, onDeck }: { chapter: typeof chapters[number]; run: NonNullable<SaveData["run"]>; activeLevel: LevelDefinition; onBack: () => void; onEnter: () => void; onDeck: () => void }) {
  return <main className={`map-screen game-screen theme-${chapter.id}`}>
    <Header title={chapter.name} onBack={onBack} right={<button className="resource-pill" onClick={onDeck}>牌组 {run.deck.length}</button>} />
    <div className="run-status"><span><Heart size={15} />{activeLevel.type === "camp" ? "本节点整备" : `本关敌我 ${activeLevel.enemyHp}/${activeLevel.enemyHp}`}</span><span>军功 {run.merit}</span><span>朱批 {run.sealCount}</span></div>
    <section className="chapter-intro"><span>{chapter.subtitle}</span><p>{chapter.intro}</p></section>
    <div className="node-path">
      {chapter.levels.map((level, index) => {
        const state = run.completedLevelIds.includes(level.id) ? "done" : index === run.nodeIndex ? "active" : index < run.nodeIndex ? "done" : "locked";
        return <div className={`map-node ${state} type-${level.type}`} key={level.id}>
          <span className="path-line" />
          <div className="node-medallion">{state === "done" ? <Check /> : level.type === "camp" ? <Flame /> : level.type === "boss" ? <Swords /> : index + 1}</div>
          <div className="node-copy"><small>{labelLevelType(level.type)}</small><strong>{level.name}</strong><span>{level.subtitle}</span></div>
        </div>;
      })}
    </div>
    <section className="active-node-sheet"><div><small>当前节点 · {labelLevelType(activeLevel.type)}</small><h3>{activeLevel.name}</h3><p>{activeLevel.objective}</p></div><button className="gold-button" onClick={onEnter}>{run.completedLevelIds.includes(activeLevel.id) ? "前往下一节" : activeLevel.type === "camp" ? "进入营帐" : activeLevel.type === "event" ? "查看抉择" : "列阵出征"}<ChevronRight size={18} /></button></section>
  </main>;
}

function StoryScreen({ chapter, level, mode, onBack, onContinue, onRisk }: { chapter: typeof chapters[number]; level: LevelDefinition; mode: "intro" | "event"; onBack: () => void; onContinue: () => void; onRisk: () => void }) {
  const eventText = chapter.id === "peach" ? "破损的誓书落在饥民营中。你可以先护住百姓，换取一枚朱批；也可以冒险追查墨迹，夺回一页残章。" : chapter.id === "changban" ? "渡口只剩一条船。先送百姓可以获得一枚朱批；断桥迎敌，则能从敌阵夺回一页强力残章。" : "黄盖把火种放在你面前。稳住军心可以获得一枚朱批；执行险计，则可能换来火攻残章。";
  return <main className={`story-screen game-screen theme-${chapter.id}`}>
    <Header title={mode === "intro" ? chapter.name : level.name} onBack={onBack} />
    <div className="story-ink" aria-hidden="true"><span>卷</span></div>
    <article className="story-paper"><span className="eyebrow">{mode === "intro" ? "章回开篇" : "残页抉择"}</span><h2>{mode === "intro" ? chapter.subtitle : level.subtitle}</h2><p>{mode === "intro" ? chapter.intro : eventText}</p>{mode === "intro" ? <button className="gold-button" onClick={onContinue}>展开战图</button> : <div className="choice-list"><button onClick={onContinue}><strong>稳妥行事</strong><span>朱批 +1，最多持有 2 枚</span></button><button onClick={onRisk}><strong>冒险取页</strong><span>获得或升级一张本卷卡牌</span></button></div>}</article>
  </main>;
}

function BattleScreen({ battle, level, settings, tutorialCompleted, onTutorialComplete, onBattle, onFinish, onRetreat, onDefeat, feedback }: { battle: BattleState; level: LevelDefinition; settings: SaveData["settings"]; tutorialCompleted: boolean; onTutorialComplete: () => void; onBattle: (battle: BattleState) => void; onFinish: () => void; onRetreat: () => void; onDefeat: (annotation: string) => void; feedback: (kind?: "light" | "success" | "error") => void }) {
  const [selected, setSelected] = useState<string | undefined>();
  const [showPause, setShowPause] = useState(false);
  const [showInfo, setShowInfo] = useState<string | undefined>();
  const [countdown, setCountdown] = useState(3);
  const [tutorialStep, setTutorialStep] = useState<number | null>(() => level.id === "C1-01" && !tutorialCompleted ? 0 : null);
  const selectedCard = selected ? cardById.get(selected) : undefined;

  useEffect(() => { if (battle.result !== "playing") onFinish(); }, [battle.result, onFinish]);
  useEffect(() => {
    if (settings.manualBeat || showPause || tutorialStep !== null || battle.result !== "playing") return;
    setCountdown(3);
    const timer = window.setInterval(() => setCountdown((value) => {
      if (value <= 1) {
        window.clearInterval(timer);
        onBattle(endBeat(battle, level));
        return 3;
      }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [battle.beat, battle.result, level, onBattle, settings.manualBeat, showPause, tutorialStep]);

  const deploy = (lane: LaneIndex) => {
    if (!selected) return;
    const next = playCard(battle, selected, lane);
    if (next === battle) {
      feedback("error");
      return;
    }
    feedback();
    onBattle(next);
    setSelected(undefined);
    if (tutorialStep === 2) setTutorialStep(3);
  };

  const dropCard = (cardId: string, lane: LaneIndex) => {
    const next = playCard(battle, cardId, lane);
    if (next === battle) {
      feedback("error");
      return;
    }
    feedback();
    onBattle(next);
    setSelected(undefined);
    if (tutorialStep === 2) setTutorialStep(3);
  };

  const resolveBeat = () => {
    feedback();
    onBattle(endBeat(battle, level));
    if (tutorialStep === 3) setTutorialStep(4);
  };

  const finishTutorial = () => {
    setTutorialStep(null);
    onTutorialComplete();
  };

  return <main className={`battle-screen game-screen battle-${level.background}`}>
    <header className="battle-top"><div className="enemy-title"><small>{level.type === "boss" ? "章回首领" : "敌军"}</small><strong>{level.enemyName}</strong></div><HealthBar value={battle.enemyHp} max={battle.enemyMaxHp} enemy /><div className="battle-top-actions"><button className="icon-button tutorial-replay" aria-label="重播战斗引导" onClick={() => setTutorialStep(0)}><Info /></button><button className="icon-button" aria-label="暂停战斗" onClick={() => setShowPause(true)}><Pause /></button></div></header>
    <div className={`battle-meta ${battle.beat >= battle.maxBeats ? "overtime" : ""}`}><span>{battle.beat >= battle.maxBeats ? battle.beat === battle.maxBeats ? "本拍进入超时" : `超时第 ${battle.beat - battle.maxBeats + 1} 拍` : `第 ${battle.beat}/${battle.maxBeats} 拍`}</span><span>{battle.wind ? <><Wind size={14} />东风</> : "无风"}</span><span>{settings.manualBeat ? "手动军令" : `${countdown} 秒`}</span></div>
    {battle.beat >= battle.maxBeats && <div className="overtime-warning" role="alert"><Flame size={17} /><div><strong>{battle.beat === battle.maxBeats ? "本拍结算后进入超时消耗" : "战事正在超时消耗"}</strong><span>每次结算，双方主帐生命各减少 3 点</span></div></div>}
    <Battlefield3D battle={battle} selectedCardId={selected} tutorialStep={tutorialStep} reducedMotion={settings.reducedMotion} onLaneSelect={deploy} onCardDrop={dropCard} />
    <section className="player-command"><div className="player-health"><HealthBar value={battle.playerHp} max={battle.playerMaxHp} /><span className="strategy-orb">谋 {battle.strategy}/{battle.maxStrategy}</span>{battle.sealAvailable && battle.undoSnapshot && <button className="seal-button" onClick={() => onBattle(undoLastPlay(battle))}>朱批撤回</button>}</div><div className={`hand-scroll ${tutorialStep === 1 ? "tutorial-hand-target" : ""}`}>{battle.hand.map((cardId, index) => { const definition = cardById.get(cardId)!; return <button draggable key={`${cardId}-${index}`} onDragStart={(event) => event.dataTransfer.setData("text/card", cardId)} onClick={() => { if (definition.cost > battle.strategy) { feedback("error"); return; } setSelected(selected === cardId ? undefined : cardId); if (tutorialStep === 1) setTutorialStep(2); }} onDoubleClick={() => setShowInfo(cardId)} className={`battle-card card-${definition.color} ${selected === cardId ? "selected" : ""} ${definition.cost > battle.strategy ? "disabled" : ""}`}><span className="card-cost">{definition.cost}</span><small>{definition.kind === "general" ? "将魂" : definition.kind === "stratagem" ? "计策" : definition.tags[0]}</small><strong>{definition.name}</strong>{definition.kind !== "stratagem" && <span className="card-stats">攻 {definition.attack} · 守 {definition.guard}</span>}<p>{definition.description}</p></button>; })}</div><div className="battle-actions"><span>牌堆 {battle.drawPile.length} · 弃牌 {battle.discardPile.length}</span><button className={`gold-button ${tutorialStep === 3 ? "tutorial-command-target" : ""}`} onClick={resolveBeat}>下达军令<ChevronRight size={17} /></button></div></section>
    {selectedCard && <div className="selection-hint">将「{selectedCard.name}」投向一条军路 <button onClick={() => setShowInfo(selectedCard.id)}><Info size={15} />详情</button></div>}
    {showPause && <Modal title="战事暂停" onClose={() => setShowPause(false)}><button className="gold-button" onClick={() => setShowPause(false)}>继续战斗</button><button className="ink-button" onClick={onRetreat}>退回战图</button></Modal>}
    {showInfo && <CardDetail card={cardById.get(showInfo)!} upgraded={battle.upgradedCards.includes(showInfo)} onClose={() => setShowInfo(undefined)} />}
    {battle.result === "defeat" && <Modal title="此页成了败笔" locked><p>失败不会被抹去。选择一条注疏，带到下一次战役。</p><div className="annotation-list">{annotations.map((item) => <button key={item.id} onClick={() => onDefeat(item.id)}><strong>{item.title}</strong><span>{item.detail}</span></button>)}</div></Modal>}
    {tutorialStep !== null && battle.result === "playing" && <BattleTutorial battle={battle} step={tutorialStep} onNext={() => setTutorialStep(1)} onFinish={finishTutorial} onSkip={finishTutorial} />}
  </main>;
}

function BattleTutorial({ battle, step, onNext, onFinish, onSkip }: { battle: BattleState; step: number; onNext: () => void; onFinish: () => void; onSkip: () => void }) {
  const copy = [
    { title: "先看敌方军令", body: "每条军路顶部会预告敌人下一拍的行动和战力。先找出敌人准备进攻的军路。", action: "我看见了" },
    { title: "选择一张手牌", body: "卡牌左上角是谋略费用。现在点击底部一张亮起、费用足够的卡牌。" },
    { title: "把牌投入军路", body: "选中的牌会抬起。点击上、中、下任意一路，把它部署到战场。" },
    { title: "下达本拍军令", body: "还可以继续出牌，也可以点击右下角“下达军令”，让双方开始结算。" },
    { title: "推动军势，击破主帐", body: `本关刻度推到 +${battle.breachThreshold} 会攻击敌方主帐 ${battle.breachDamage} 点；退到 -${battle.breachThreshold} 则我方受伤 ${battle.breachDamage} 点。把顶部红色生命打到 0 就能获胜。`, action: "开始独立指挥" }
  ][step];
  return <aside className={`battle-tutorial tutorial-step-${step}`} role="dialog" aria-label={`战斗引导 ${step + 1}/5`}><div className="tutorial-progress"><span style={{ width: `${(step + 1) * 20}%` }} /></div><small>新手军令 · {step + 1}/5</small><strong>{copy.title}</strong><p>{copy.body}</p>{copy.action && <button className="gold-button" onClick={step === 4 ? onFinish : onNext}>{copy.action}</button>}<button className="tutorial-skip" onClick={onSkip}>跳过引导</button></aside>;
}

function HealthBar({ value, max, enemy = false }: { value: number; max: number; enemy?: boolean }) {
  return <div className={`health-bar ${enemy ? "enemy" : ""}`}><div style={{ width: `${Math.max(0, Math.min(100, value / max * 100))}%` }} /><span>{value}/{max}</span></div>;
}

function RewardScreen({ level, battle, rewards, onPick }: { level: LevelDefinition; battle?: BattleState; rewards: string[]; onPick: (cardId?: string) => void }) {
  const [showReport, setShowReport] = useState(false);
  const breachCount = battle?.log.filter((entry) => entry.includes("路破阵：")).length ?? 0;
  return <main className="reward-screen game-screen"><span className="seal success">胜</span><span className="eyebrow">战事已定</span><h2>{level.name}</h2><p>{battle ? `第 ${battle.beat} 拍获胜 · 完成 ${breachCount} 次破阵 · 我方主帐 ${battle.playerHp}/${battle.playerMaxHp}` : "敌方主帐生命已归零。"}</p>{battle && <button className="ink-button battle-report-button" onClick={() => setShowReport(true)}><ScrollText size={17} />查看本局战报</button>}<p>获得军功 {level.reward}。从残页中选择一张牌，或保持牌组精简。</p><div className="reward-cards">{rewards.map((id) => <CardTile key={id} card={cardById.get(id)!} onClick={() => onPick(id)} />)}</div><button className="text-button" onClick={() => onPick()}>不取残页，继续前行</button>{showReport && battle && <Modal title={`${level.name} · 战报`} onClose={() => setShowReport(false)}><div className="battle-report-summary"><strong>胜利原因</strong><p>敌方主帐从 {battle.enemyMaxHp} 降至 {battle.enemyHp}，生命归零后获胜。</p><strong>逐拍记录</strong><ol>{battle.log.map((entry, index) => <li key={`${index}-${entry}`}>{entry}</li>)}</ol></div></Modal>}</main>;
}

function CampScreen({ run, onRestoreSeal, onUpgrade, onDeck, onLeave }: { run: NonNullable<SaveData["run"]>; onRestoreSeal: () => void; onUpgrade: () => void; onDeck: () => void; onLeave: () => void }) {
  return <main className="camp-screen game-screen"><Header title="营帐整备" /><div className="campfire"><Flame /></div><h2>火未熄，卷未尽</h2><p>军功 {run.merit} · 朱批 {run.sealCount}/2</p><div className="service-list"><button disabled={run.merit < 30 || run.sealCount >= 2} onClick={onRestoreSeal}><ScrollText /><div><strong>重整军令</strong><span>30 军功 · 恢复 1 枚朱批</span></div></button><button disabled={run.merit < 40 || run.upgradedCards.length >= new Set(run.deck).size} onClick={onUpgrade}><Sparkles /><div><strong>研习残章</strong><span>40 军功 · 升级一张未升级卡</span></div></button><button onClick={onDeck}><BookOpen /><div><strong>整理牌组</strong><span>查看、删除和确认 12 张出战牌</span></div></button></div><button className="gold-button" onClick={onLeave}>收帐启程</button></main>;
}

function DeckScreen({ save, mode, onBack, onRemove, onFinish }: { save: SaveData; mode: "run" | "codex"; onBack: () => void; onRemove?: (index: number) => void; onFinish?: () => void }) {
  const deck = save.run?.deck || [];
  const list = mode === "run" ? deck.map((id, index) => ({ id, index })) : cards.map((item, index) => ({ id: item.id, index }));
  return <main className="deck-screen game-screen"><Header title={mode === "run" ? `出战牌组 ${deck.length}/12` : "将魂与卡牌簿"} onBack={onBack} right={onFinish ? <button className="resource-pill" onClick={onFinish}>确认</button> : undefined} /><p className="screen-lead">{mode === "run" ? "每次出战必须保留恰好 12 张牌。点击多余卡牌右上角移除。" : `已经记录 ${save.unlockedCards.length}/${cards.length} 张残页。未解锁条目仍会显示其轮廓。`}</p><div className="collection-grid">{list.map(({ id, index }) => { const definition = cardById.get(id)!; const locked = mode === "codex" && !save.unlockedCards.includes(id); return <div key={`${id}-${index}`} className={`collection-item ${locked ? "locked" : ""}`}>{onRemove && deck.length > 12 && <button className="remove-card" onClick={() => onRemove(index)}><X size={14} /></button>}<CardTile card={definition} compact locked={locked} upgraded={Boolean(save.run?.upgradedCards.includes(id))} /></div>; })}</div></main>;
}

function CardTile({ card, onClick, compact = false, locked = false, upgraded = false }: { card: CardDefinition; onClick?: () => void; compact?: boolean; locked?: boolean; upgraded?: boolean }) {
  const content = <><span className="card-cost">{card.cost}</span><small>{locked ? "未录" : card.kind === "general" ? "将魂" : card.kind === "stratagem" ? "计策" : card.tags[0]}</small><strong>{locked ? "无名残页" : card.name}{upgraded ? " +" : ""}</strong>{!compact && <><p>{locked ? "继续修复章回以找回此页。" : card.description}</p><em>{locked ? "墨迹未显" : card.quote}</em></>}<span className="rarity-mark">{card.rarity}</span></>;
  return onClick ? <button className={`card-tile card-${card.color}`} onClick={onClick}>{content}</button> : <div className={`card-tile card-${card.color}`}>{content}</div>;
}

function CardDetail({ card, upgraded, onClose }: { card: CardDefinition; upgraded: boolean; onClose: () => void }) {
  return <Modal title={card.name} onClose={onClose}><div className={`detail-card card-${card.color}`}><span>{card.kind === "general" ? "将魂" : card.kind === "stratagem" ? "计策" : card.tags.join(" · ")}</span><h3>{card.name}{upgraded ? " +" : ""}</h3><p>{card.description}</p><dl><div><dt>谋略</dt><dd>{card.cost}</dd></div><div><dt>攻击</dt><dd>{card.attack}</dd></div><div><dt>守备</dt><dd>{card.guard}</dd></div><div><dt>速度</dt><dd>{card.speed}</dd></div></dl><blockquote>{card.quote}</blockquote></div></Modal>;
}

function SettingsScreen({ save, onBack, onChange, onReset }: { save: SaveData; onBack: () => void; onChange: (key: keyof SaveData["settings"]) => void; onReset: () => void }) {
  const rows: Array<[keyof SaveData["settings"], string, string]> = [["music", "音乐与音效", "控制游戏内音频"], ["haptics", "触觉反馈", "出牌、破阵和胜负反馈"], ["reducedMotion", "减少动态效果", "关闭墨迹飞溅和较大位移"], ["manualBeat", "手动军令拍", "关闭后每拍 3 秒自动结算"], ["largeText", "大号文字", "放大战斗外正文和按钮"]];
  return <main className="settings-screen game-screen"><Header title="设置" onBack={onBack} /><div className="setting-list">{rows.map(([key, title, detail]) => <button key={key} onClick={() => onChange(key)}><div>{key === "music" ? save.settings[key] ? <Volume2 /> : <VolumeX /> : key === "reducedMotion" ? <Pause /> : key === "manualBeat" ? <Play /> : <Settings />}</div><span><strong>{title}</strong><small>{detail}</small></span><i className={save.settings[key] ? "on" : ""} /></button>)}</div><section className="danger-zone"><h3>存档</h3><p>重置会清除当前战役、解锁、史墨和战绩，且无法撤销。</p><button className="danger-button" onClick={() => window.confirm("确定抹去全部残卷记录？") && onReset()}><RotateCcw />抹去全部记录</button></section></main>;
}

function EndingScreen({ onDesk, onAgain }: { onDesk: () => void; onAgain: () => void }) {
  return <main className="ending-screen game-screen"><div className="ending-scroll"><span className="seal success">定</span><span className="eyebrow">正史结局</span><h1>火照原卷</h1><p>东风穿过空白的纸面，赤壁终于重新燃烧。司史者没有替任何人决定功过，只把每一次选择留在了可以被看见的地方。</p><p>无名执笔者放下墨笔。被删去的名字依次浮现，而你的名字仍留在卷外——记录者不必成为英雄，也能让英雄不被遗忘。</p><blockquote>“天下未定，故事也不该只有一种批法。”</blockquote><button className="gold-button" onClick={onDesk}>回到司史书案</button><button className="ink-button" onClick={onAgain}>再入残卷</button></div></main>;
}

function Modal({ title, children, onClose, locked = false }: { title: string; children: ReactNode; onClose?: () => void; locked?: boolean }) {
  return <div className="modal-backdrop"><section className="game-modal"><header><h2>{title}</h2>{!locked && onClose && <button className="icon-button" onClick={onClose}><X /></button>}</header>{children}</section></div>;
}

function unlock(save: SaveData, generals: string[], cardIds: string[]) {
  generals.forEach((id) => { if (!save.unlockedGenerals.includes(id)) save.unlockedGenerals.push(id); });
  cardIds.forEach((id) => { if (!save.unlockedCards.includes(id)) save.unlockedCards.push(id); });
}

function labelLevelType(type: LevelDefinition["type"]) {
  return type === "battle" ? "战斗" : type === "elite" ? "精英" : type === "event" ? "抉择" : type === "camp" ? "营帐" : "首领";
}
