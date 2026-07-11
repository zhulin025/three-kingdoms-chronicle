import type { CardDefinition, ChapterDefinition, LevelDefinition } from "./types";

const card = (definition: CardDefinition) => definition;

export const cards: CardDefinition[] = [
  card({ id: "militia", name: "义勇兵", kind: "unit", rarity: "basic", cost: 1, attack: 2, guard: 1, speed: 2, tags: ["步兵", "义军"], effect: "power", value: 1, description: "若本路已有将魂，本拍额外获得 1 战力。", quote: "一呼而聚，为护乡里。", color: "ink" }),
  card({ id: "spearman", name: "长枪兵", kind: "unit", rarity: "basic", cost: 1, attack: 2, guard: 2, speed: 2, tags: ["步兵", "枪"], effect: "guard", value: 1, description: "稳固军阵，本路军势为负时额外获得 1 战力。", quote: "枪林如墙。", color: "ink" }),
  card({ id: "archer", name: "弓手", kind: "unit", rarity: "basic", cost: 1, attack: 3, guard: 0, speed: 3, tags: ["弓", "远程"], effect: "power", value: 0, description: "先发制人，但几乎无法承受反击。", quote: "弦响而阵乱。", color: "ink" }),
  card({ id: "cavalry", name: "轻骑", kind: "unit", rarity: "basic", cost: 2, attack: 4, guard: 1, speed: 4, tags: ["骑兵"], effect: "move", value: 1, description: "部署后为相邻一路增加 1 战力。", quote: "来去如风。", color: "red" }),
  card({ id: "shield", name: "盾卒", kind: "unit", rarity: "basic", cost: 1, attack: 1, guard: 4, speed: 1, tags: ["步兵", "盾"], effect: "guard", value: 2, description: "本路敌军战力减少 2。", quote: "寸步不退。", color: "blue" }),
  card({ id: "scout", name: "斥候", kind: "unit", rarity: "basic", cost: 1, attack: 1, guard: 1, speed: 5, tags: ["轻装"], effect: "draw", value: 1, description: "出牌后抽 1 张牌。", quote: "先见，方能先胜。", color: "green" }),
  card({ id: "veteran", name: "老卒", kind: "unit", rarity: "common", cost: 2, attack: 3, guard: 3, speed: 2, tags: ["步兵"], effect: "supply", value: 1, description: "若本拍是第 6 拍之后，返还 1 谋略。", quote: "百战未死，自有道理。", color: "ink" }),
  card({ id: "crossbow", name: "连弩手", kind: "unit", rarity: "common", cost: 2, attack: 5, guard: 0, speed: 4, tags: ["弓", "远程"], effect: "power", value: 1, description: "目标路处于湿润时额外获得 1 战力。", quote: "机括连响。", color: "blue" }),
  card({ id: "heavyCavalry", name: "突阵骑", kind: "unit", rarity: "rare", cost: 3, attack: 7, guard: 1, speed: 5, tags: ["骑兵"], effect: "pierce", value: 2, description: "胜出时额外推进 2 点军势。", quote: "一骑破阵。", color: "red" }),
  card({ id: "riverGuard", name: "江东水军", kind: "unit", rarity: "common", cost: 2, attack: 3, guard: 4, speed: 2, tags: ["水军"], effect: "wet", value: 1, description: "清除本路点燃并获得 1 点战力。", quote: "潮生我进。", color: "blue" }),
  card({ id: "ram", name: "冲车", kind: "unit", rarity: "rare", cost: 3, attack: 4, guard: 5, speed: 0, tags: ["器械"], effect: "pierce", value: 3, description: "本路破线时额外对敌帐造成 3 伤害。", quote: "城坚，志更坚。", color: "gold" }),
  card({ id: "messenger", name: "军令使", kind: "unit", rarity: "common", cost: 1, attack: 1, guard: 1, speed: 5, tags: ["轻装"], effect: "supply", value: 1, description: "返还 1 谋略；每拍只能触发一次。", quote: "令至，则军动。", color: "green" }),
  card({ id: "liuBei", name: "刘备", kind: "general", rarity: "legend", cost: 3, attack: 2, guard: 5, speed: 2, tags: ["将魂", "结义", "仁德"], effect: "heal", value: 2, description: "治疗主帐 2；相邻两路各获得 1 战力。", quote: "民为贵，誓不可负。", color: "gold" }),
  card({ id: "guanYu", name: "关羽", kind: "general", rarity: "legend", cost: 3, attack: 6, guard: 2, speed: 4, tags: ["将魂", "结义", "猛将"], effect: "pierce", value: 2, description: "本路军势不占优时额外推进 2。", quote: "义之所在，一刀当之。", color: "red" }),
  card({ id: "zhangFei", name: "张飞", kind: "general", rarity: "legend", cost: 3, attack: 5, guard: 3, speed: 3, tags: ["将魂", "结义", "猛将"], effect: "intimidate", value: 3, description: "敌方本路战力 -3；己方半血以下再 +2 战力。", quote: "燕人张翼德在此！", color: "red" }),
  card({ id: "zhaoYun", name: "赵云", kind: "general", rarity: "legend", cost: 2, attack: 3, guard: 3, speed: 5, tags: ["将魂", "救援", "骑兵"], effect: "move", value: 2, description: "相邻两路各获得 2 守势。", quote: "一身是胆。", color: "blue" }),
  card({ id: "zhugeLiang", name: "诸葛亮", kind: "general", rarity: "legend", cost: 3, attack: 1, guard: 4, speed: 3, tags: ["将魂", "谋士"], effect: "wind", value: 2, description: "改变东风 2 拍并抽 1 张计策。", quote: "借势，不逆天时。", color: "green" }),
  card({ id: "zhouYu", name: "周瑜", kind: "general", rarity: "legend", cost: 3, attack: 3, guard: 3, speed: 3, tags: ["将魂", "都督", "火"], effect: "burn", value: 3, description: "本路点燃 3；已有点燃时扩散至相邻路。", quote: "此火，当照彻长江。", color: "red" }),
  card({ id: "oath", name: "桃园结义", kind: "stratagem", rarity: "rare", cost: 1, attack: 0, guard: 0, speed: 5, tags: ["计策", "结义"], effect: "oath", value: 3, description: "本路 +3 战力；本拍打出过结义将魂则三路各 +1。", quote: "不求同生，但求同心。", color: "gold" }),
  card({ id: "benevolence", name: "仁心相护", kind: "stratagem", rarity: "common", cost: 1, attack: 0, guard: 0, speed: 5, tags: ["计策", "仁德"], effect: "heal", value: 3, description: "治疗主帐 3，且本路敌军战力 -1。", quote: "先护无刃之人。", color: "green" }),
  card({ id: "roar", name: "当阳一喝", kind: "stratagem", rarity: "rare", cost: 2, attack: 0, guard: 0, speed: 5, tags: ["计策", "威慑"], effect: "intimidate", value: 5, description: "敌方本路战力 -5；本路军势落后时再 -2。", quote: "谁敢向前！", color: "red" }),
  card({ id: "rescue", name: "单骑救主", kind: "stratagem", rarity: "rare", cost: 1, attack: 0, guard: 0, speed: 5, tags: ["计策", "救援"], effect: "move", value: 4, description: "将相邻两路己方战力各 2 点移入目标路。", quote: "长坂虽险，去路由我。", color: "blue" }),
  card({ id: "borrowArrows", name: "草船借箭", kind: "stratagem", rarity: "rare", cost: 1, attack: 0, guard: 0, speed: 5, tags: ["计策", "水"], effect: "borrowArrows", value: 4, description: "本路湿润；若敌方是箭阵，获得 4 战力并抽 1。", quote: "雾中有客，来取十万箭。", color: "blue" }),
  card({ id: "eastWind", name: "东风", kind: "stratagem", rarity: "rare", cost: 1, attack: 0, guard: 0, speed: 5, tags: ["计策", "风"], effect: "wind", value: 2, description: "东风持续 2 拍；所有己方点燃 +1。", quote: "万事俱备。", color: "green" }),
  card({ id: "fireAttack", name: "火攻", kind: "stratagem", rarity: "common", cost: 2, attack: 0, guard: 0, speed: 5, tags: ["计策", "火"], effect: "burn", value: 2, description: "目标路点燃 2；东风存在时点燃 3。", quote: "一炬可定势。", color: "red" }),
  card({ id: "chain", name: "连环锁", kind: "stratagem", rarity: "common", cost: 1, attack: 0, guard: 0, speed: 5, tags: ["计策", "器械"], effect: "chain", value: 1, description: "标记本路；此路火势会扩散到相邻路。", quote: "船连则稳，亦连其祸。", color: "gold" }),
  card({ id: "ambush", name: "伏兵", kind: "stratagem", rarity: "common", cost: 1, attack: 0, guard: 0, speed: 5, tags: ["计策", "伏兵"], effect: "ambush", value: 4, description: "若敌方本路本拍有行动，结算时 +4 战力。", quote: "静待旗动。", color: "ink" }),
  card({ id: "feint", name: "疑兵", kind: "stratagem", rarity: "common", cost: 1, attack: 0, guard: 0, speed: 5, tags: ["计策", "威慑"], effect: "intimidate", value: 3, description: "敌方本路战力 -3；若该路无敌军，返还费用。", quote: "虚者实之，实者虚之。", color: "ink" }),
  card({ id: "cutSupply", name: "断粮", kind: "stratagem", rarity: "rare", cost: 2, attack: 0, guard: 0, speed: 5, tags: ["计策", "军略"], effect: "intimidate", value: 4, description: "敌方最强一路战力 -4，目标路额外 -1。", quote: "军无粮，自乱。", color: "green" }),
  card({ id: "arrowStorm", name: "万箭齐发", kind: "stratagem", rarity: "legend", cost: 3, attack: 0, guard: 0, speed: 5, tags: ["计策", "弓"], effect: "power", value: 5, description: "三路各获得 5 战力。", quote: "箭落如雨。", color: "gold" })
];

export const cardById = new Map(cards.map((item) => [item.id, item]));

const level = (definition: LevelDefinition) => definition;

export const chapters: ChapterDefinition[] = [
  {
    id: "peach", name: "第一卷·桃园残誓", subtitle: "誓言正在被抹去", color: "#c55b5b",
    intro: "春雨落在涿郡，桃花却没有名字。有人从誓词中抹去了三人的因果，黄巾与官军只剩无休的厮杀。",
    levels: [
      level({ id: "C1-01", chapterId: "peach", order: 1, name: "涿郡乱火", type: "battle", subtitle: "五拍内完成首次破阵", enemyName: "黄巾散兵", enemyHp: 10, difficulty: 0, maxBeats: 5, objective: "完成一次破阵，击破敌方主帐", reward: 25, background: "peach", battleRules: { breachThreshold: 6, breachDamage: 10, breachReset: 2, startingStrategy: 3, strategyRecovery: 3, maxEnemyIntents: 1 } }),
      level({ id: "C1-02", chapterId: "peach", order: 2, name: "桃园护誓", type: "event", subtitle: "选择如何保护破损誓书", enemyName: "失名乱军", enemyHp: 24, difficulty: 1, maxBeats: 12, objective: "守住三路军势", reward: 20, background: "peach", modifier: "oath" }),
      level({ id: "C1-03", chapterId: "peach", order: 3, name: "黄巾风阵", type: "elite", subtitle: "敌军每拍换路", enemyName: "黄巾术士", enemyHp: 18, difficulty: 1, maxBeats: 9, objective: "识破换路，完成两次破阵", reward: 45, background: "peach", battleRules: { breachThreshold: 7, breachDamage: 9, breachReset: 2, maxEnemyIntents: 1 } }),
      level({ id: "C1-04", chapterId: "peach", order: 4, name: "桑树营帐", type: "camp", subtitle: "整备牌组，留下朱批", enemyName: "", enemyHp: 0, difficulty: 0, maxBeats: 0, objective: "整备", reward: 0, background: "peach" }),
      level({ id: "C1-05", chapterId: "peach", order: 5, name: "誓文被涂", type: "battle", subtitle: "一张手牌会暂时失去能力", enemyName: "白卒", enemyHp: 30, difficulty: 2, maxBeats: 12, objective: "在无名干扰下完成三次破阵", reward: 35, background: "peach", modifier: "nameless", battleRules: { breachThreshold: 8, breachDamage: 10, breachReset: 3 } }),
      level({ id: "C1-06", chapterId: "peach", order: 6, name: "斩断无名旗", type: "boss", subtitle: "夺回仁德原文印", enemyName: "涂将·程远志", enemyHp: 40, difficulty: 3, maxBeats: 16, objective: "四次破阵，击败两阶段涂将", reward: 80, background: "peach", modifier: "boss", battleRules: { breachThreshold: 9, breachDamage: 10, breachReset: 3 } })
    ]
  },
  {
    id: "changban", name: "第二卷·长坂失魂", subtitle: "被救下的人不再记得姓名", color: "#536f7b",
    intro: "长坂坡浸在墨雨里。追骑没有旗号，百姓没有归处。那位白马将军一次次冲阵，却忘了自己为何回头。",
    levels: [
      level({ id: "C2-01", chapterId: "changban", order: 1, name: "当阳追骑", type: "battle", subtitle: "拦住持续推进的敌骑", enemyName: "曹军轻骑", enemyHp: 28, difficulty: 2, maxBeats: 13, objective: "阻断骑阵并击破主帐", reward: 30, background: "changban", modifier: "escort" }),
      level({ id: "C2-02", chapterId: "changban", order: 2, name: "百姓渡口", type: "event", subtitle: "护送百姓，或抢先断桥", enemyName: "弓弩追兵", enemyHp: 28, difficulty: 2, maxBeats: 13, objective: "完成护送抉择", reward: 25, background: "changban", modifier: "escort" }),
      level({ id: "C2-03", chapterId: "changban", order: 3, name: "七进墨潮", type: "elite", subtitle: "让赵云在三路间救援", enemyName: "失名骑", enemyHp: 34, difficulty: 3, maxBeats: 15, objective: "击退三波追骑", reward: 45, background: "changban" }),
      level({ id: "C2-04", chapterId: "changban", order: 4, name: "古井营帐", type: "camp", subtitle: "疗伤，或从井中打捞残页", enemyName: "", enemyHp: 0, difficulty: 0, maxBeats: 0, objective: "整备", reward: 0, background: "changban" }),
      level({ id: "C2-05", chapterId: "changban", order: 5, name: "阿斗无名", type: "battle", subtitle: "白卒会复制你上一拍的强牌", enemyName: "白卒骑阵", enemyHp: 32, difficulty: 3, maxBeats: 15, objective: "守住记忆并获胜", reward: 40, background: "changban", modifier: "nameless" }),
      level({ id: "C2-06", chapterId: "changban", order: 6, name: "虎豹无主", type: "boss", subtitle: "夺回龙胆原文印", enemyName: "无名虎豹骑", enemyHp: 55, difficulty: 4, maxBeats: 18, objective: "击败三阶段骑阵", reward: 80, background: "changban", modifier: "boss" })
    ]
  },
  {
    id: "redcliff", name: "第三卷·赤壁无火", subtitle: "东风已至，江上却没有火", color: "#9a3e2f",
    intro: "连环战船横在江上，箭已借来，苦肉已受，东风也如约而至。只有那场决定天下的火，被一只墨手从书中按灭。",
    levels: [
      level({ id: "C3-01", chapterId: "redcliff", order: 1, name: "草船借箭", type: "battle", subtitle: "用湿润承受箭雨，再反击", enemyName: "曹军弓弩阵", enemyHp: 30, difficulty: 3, maxBeats: 14, objective: "借势击破箭阵", reward: 35, background: "redcliff", modifier: "wind" }),
      level({ id: "C3-02", chapterId: "redcliff", order: 2, name: "铁索连舟", type: "event", subtitle: "连锁会稳住船阵，也会传播火势", enemyName: "曹军盾船", enemyHp: 32, difficulty: 3, maxBeats: 14, objective: "利用连环击破敌军", reward: 30, background: "redcliff", modifier: "fire" }),
      level({ id: "C3-03", chapterId: "redcliff", order: 3, name: "东风祭台", type: "elite", subtitle: "保住祭台直到东风形成", enemyName: "白卒谋士", enemyHp: 36, difficulty: 4, maxBeats: 15, objective: "操纵风向并获胜", reward: 50, background: "redcliff", modifier: "wind" }),
      level({ id: "C3-04", chapterId: "redcliff", order: 4, name: "水寨营帐", type: "camp", subtitle: "招募都督，升级火计", enemyName: "", enemyHp: 0, difficulty: 0, maxBeats: 0, objective: "整备", reward: 0, background: "redcliff" }),
      level({ id: "C3-05", chapterId: "redcliff", order: 5, name: "火船夜渡", type: "battle", subtitle: "让点燃沿三路扩散", enemyName: "连环水军", enemyHp: 38, difficulty: 4, maxBeats: 15, objective: "引燃三路后击破主帐", reward: 45, background: "redcliff", modifier: "fire" }),
      level({ id: "C3-06", chapterId: "redcliff", order: 6, name: "赤壁无火", type: "boss", subtitle: "让被删去的大火重新照亮原卷", enemyName: "执笔者·灭火之手", enemyHp: 65, difficulty: 5, maxBeats: 18, objective: "击破封名、降雨与吞火三阶段", reward: 100, background: "redcliff", modifier: "boss" })
    ]
  }
];

export const starterDeck = ["militia", "militia", "spearman", "spearman", "archer", "archer", "cavalry", "shield", "scout", "liuBei", "oath", "benevolence"];
export const starterUnlocks = Array.from(new Set([...starterDeck, "roar", "ambush", "feint"]));
export const rewardPools: Record<string, string[]> = {
  peach: ["veteran", "zhangFei", "guanYu", "roar", "ambush", "feint", "cutSupply"],
  changban: ["crossbow", "heavyCavalry", "zhaoYun", "rescue", "benevolence", "messenger", "ram"],
  redcliff: ["riverGuard", "zhouYu", "zhugeLiang", "borrowArrows", "eastWind", "fireAttack", "chain", "arrowStorm"]
};
