## Summary

仅调整右下角屏幕 HUD（src/hud.ts）：面板与字体整体放大约 20%，并对 HOW TO PLAY 说明做“适中扩展”，同时确保文字不再出现重叠/裁切。

## Current State Analysis

* 屏幕 HUD 位于 [hud.ts](file:///d:/Files/02_Project/01_Metaverse/MetaLiveStudio/02_3rdPartyWorks/2026/Decoy%20Doge/decoy-doge-dcl_d22bf867/src/hud.ts)，使用 ReactECS 的 `UiEntity` + `Label`。在较小行高/较紧 margin 的情况下，多行文字容易出现“挤在一起”的观感问题。

* 现有 HOW TO PLAY 文案较短（约 4 行），缺少“目标/回合结束/消灭反馈/技能持续与冷却”等关键信息。

## Proposed Changes

### 1) 屏幕 HUD：面板与字体整体 +20%（英文）

目标：面板更大、行距更舒适、文字不重叠/不裁切。

修改文件：`src/hud.ts`

* 引入统一缩放系数（例如 `SCALE = 1.2`）与数值缩放函数（例如 `s(n)`），用于：

  * `uiTransform.width/height`

  * `padding`

  * `Label.fontSize`

  * 每一行 `uiTransform.height` 与 `margin`

* 依据放大后的字体与新增说明行数，同步增加 HUD 面板高度与各行高度/间距，避免裁切。

### 2) HOW TO PLAY：适中扩展（英文，清晰且不夸大功能）

目标：按“目标玩法设定”补齐“胜利条件/淘汰规则/回合结束/技能持续与冷却”等信息，同时保持一眼能读完。

修改文件：`src/hud.ts`

拟扩展为以下行（可能会按版面微调断行，但信息点保持一致）：

- Both players and NPCs look like Muscle Doge.
- Click a Doge to BONK and eliminate it.
- If a real player gets BONKed, they are out.
- Last real player standing wins.

* Bonked Doges become ELIMINATED.
- Round ends when the timer hits 0:00.
- If time runs out, the surviving player with the most Bonks wins.

## Assumptions & Decisions

* “整体字体和面板都大 20%”仅指右下角屏幕 HUD。

- HOW TO PLAY 文案以“目标玩法设定”为准（即便当前实现未完全覆盖）。
- 时间到仍多人存活时的判定：默认采用 “存活玩家中 Bonks 最高者获胜”。

## Verification Steps

* TypeScript 诊断应为 0（无类型错误）。

* 本地运行 `npm start` 进行目测验证：

  * HUD 面板尺寸与字体约 +20%，无文字重叠/裁切

  * HOW TO PLAY 扩展后仍排版整齐、信息清晰
