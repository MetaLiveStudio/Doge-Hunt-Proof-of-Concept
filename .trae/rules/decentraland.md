我们正在开发一个基于Decentraland的移动游戏，游戏名称为Doge Hunt。注意我们的核心目标是要去创建一个基于Decentraland的移动游戏，而不是一个基于Web的移动游戏。以下是我们的重要的开发说明和技能。尤其是技能要十分重视。

### **核心规则**
1. **任务记录要求**：
   - 必须在项目根目录维护一个 `tasks.md` 文件。
   - **所有的 AI 和 Agent 在开启任何新任务前，必须首先阅读并理解 `tasks.md` 中的历史记录和当前计划。**
   - **每完成一个任务（或重要的子任务阶段），必须立即更新 `tasks.md`**，记录任务内容、完成情况、遇到的问题及后续计划。
2. **预览模式限制**：
   - 严禁擅自打开预览（preview）模式。预览和校对工作由人工完成。

### **技术规范 (SDK7/ECS7)**
1. **开发框架**：
   - 必须使用 Decentraland SDK7 (ECS7) 及其标准组件。
   - UI 开发优先使用 `react-ecs` (SDK7 官方 UI 方案)。
2. **移动端优化**：
   - 严格控制实体（Entities）和多边形（Triangles）数量。
   - 纹理大小建议不超过 512x512，尽可能使用正方形且为 2 的幂次方的尺寸。
   - 避免在每一帧（System）中进行高开销的计算或频繁的内存分配。
3. **架构模式**：
   - 遵循数据驱动的设计模式，逻辑应放在 Systems 中，状态放在 Components 中。
   - 保持代码模块化，公共功能提取到工具类或独立的 System 中。

### **参考资源**
- [Decentraland - Building for Mobile Guide Book](https://confirmed-copper-f3a.notion.site/Decentraland-Building-for-Mobile-2f55f96e0b70805785abdaba16c5f763)
- [Decentraland Skills (OpenDCL)](https://github.com/dcl-regenesislabs/opendcl)

