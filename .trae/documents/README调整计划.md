# README调整计划

## 需要修正的不一致之处

### 1. NPC数量
- **当前README**: 说8个NPC
- **实际代码**: `src/index.ts` 中 `NPC_COUNT = 12`
- **修正**: 更新为12个NPC

### 2. 场景大小
- **当前README**: 说2×2 (32m × 32m)
- **实际代码**: `scene.json` 显示3×3 parcels (48m × 48m)，index.ts注释也是3x3 parcels
- **修正**: 更新为3×3 (48m × 48m)

### 3. NPC复活机制
- **当前README**: 说"respawns after 5s"
- **实际代码**: NPC被bonk后永久死亡（`knockoutTimer = -1`），不会复活
- **修正**: 移除"respawns after 5s"的描述

### 4. 项目结构
- **当前README**: 只列出了5个文件
- **实际代码**: 还有 `player.ts`, `skills.ts`, `hud.ts`
- **修正**: 补充完整的文件列表

### 5. Label文字
- **当前README**: 说显示"?"标记
- **实际代码**: 显示"NPC or Player?"
- **修正**: 更新Label描述

### 6. Customization部分
- **当前README**: 说修改`spawnAllNpcs(8)`
- **实际代码**: 已经是`spawnAllNpcs(12)`
- **修正**: 更新为实际的12

## 调整步骤

1. 更新"What's in this demo"部分
   - NPC数量: 8 → 12
   - 移除"respawns after 5s"
   - Label描述更新

2. 更新"Scene config"部分
   - Parcels: 2×2 → 3×3 (48m × 48m)

3. 更新"Project structure"部分
   - 添加 `player.ts`, `skills.ts`, `hud.ts`

4. 更新"Customization - Change NPC count"部分
   - `spawnAllNpcs(8)` → `spawnAllNpcs(12)`

## 目标
生成一个与实际代码一致、准确反映项目状态的README.md