# 三国：残卷定乾坤

一款面向 iPhone 竖屏体验的三国题材 3D 三路战术卡牌游戏。玩家观察敌方军令、消耗谋略部署部队与计策，通过推动三路军势完成破阵，逐章修复被抹去的《三国演义》残卷。

![系统图标](public/game/chronicle-icon-master.png)

## 核心玩法

- 三路战场：上、中、下三路分别计算双方战力与军势。
- 对等主帐：每场战斗双方使用相同生命上限，并在下一关重新整备，不继承上一场损耗。
- 谋略出牌：卡牌包含部队、将魂与计策，每拍恢复谋略。
- 破阵伤害：军势达到本关门槛后攻击敌方主帐；敌方生命归零即获胜。
- 超时消耗：达到关卡拍数后，界面进入红色警告状态，每次结算双方主帐各失去 3 点生命。
- 战斗战报：胜利后可以查看逐拍出牌、战力差、军势变化、破阵伤害及超时扣血记录。
- 章回推进：目前包含桃园残誓、长坂失魂、赤壁无火三卷，共 18 个战斗、事件、营帐和首领节点。

第一关是教学战：通常 2–4 拍完成一次破阵即可获胜。后续关卡逐渐提高破阵门槛、所需突破次数和敌方行动强度。

## 技术栈

- React 19 + TypeScript
- Three.js 3D 战场
- Vite
- Capacitor 8 + 原生 iOS 工程
- 本地存档，无需服务端

## 本地运行

需要 Node.js 20+、npm；构建 iOS 还需要 macOS 与 Xcode。

```bash
npm install
npm run dev
```

浏览器访问 `http://localhost:5173/`。

## 测试与构建

```bash
npm test
npm run build
npm run build:ios
```

打开 Xcode 工程：

```bash
npm run ios:open
```

工程文件位于 `ios/App/App.xcodeproj`。选择模拟器或真机后即可运行。

## 项目结构

```text
src/game/       游戏界面、规则引擎、关卡与 Three.js 战场
public/game/    游戏图标等公共素材
docs/           游戏设计文档、十轮大爆炸规划和界面标注
scripts/        游戏规则验证与 iOS 依赖本地化脚本
ios/            Capacitor iOS 原生工程
```

## 设计文档

- [完整游戏开发文档](docs/three-kingdoms-mobile-game-gdd.md)
- [十轮头脑风暴方案](docs/game-design-bigbang-plan.md)
- [战斗界面指标标注](docs/battle-ui-annotated.svg)

## 当前状态

这是可运行的 MVP，已实现完整战役流程、3D 战斗、卡牌构筑、事件、营帐、首领、存档、新手引导、战斗战报和 iOS 打包流程。

## License

Copyright © 2026 zhulin025. All rights reserved.
