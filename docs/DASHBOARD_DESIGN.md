# Claude Code GUI — 可视化审查面板设计文档

> 版本：v2.2 规划草案  
> 目标：在对话流范式基础上，强化代码变更的可视化审查能力，提升人机协作可信度。

---

## 一、设计目标

### 核心痛点

1. **Diff 审查粗粒度**：当前仅支持 Unified 模式，且只能整体接受/拒绝，无法逐行控制。
2. **上下文不透明**：用户不知道 Claude 当前"看着"哪些文件、CLAUDE.md 规则是否在生效。
3. **对话与变更脱节**：消息流和 ChangeSummaryPanel 是独立的，点击消息不会联动 diff 面板。

### 不做的事（本版本边界）

- 跨会话文件版本树（成本极高，延后）
- 云同步 / 团队协作
- 插件系统深化

---

## 二、现有能力评估

| 功能 | 组件 | 成熟度 |
|------|------|--------|
| 会话列表 | `SessionList.tsx`（侧边栏） | 高 — 已有按项目分组、搜索 |
| Unified Diff | `DiffView.tsx` `InlineDiff` | 高 — 红删绿增，上下文行 |
| 变更汇总 | `ChangeSummaryPanel.tsx` | 中高 — 扫描 Write/Edit/MultiEdit |
| Checkpoint 回滚 | `CheckpointPanel.tsx` | 中高 — 原始内容快照，一键还原 |
| Token 统计 | `App.tsx` 状态栏 | 高 |
| Git 集成 | `GitPanel.tsx` / `git-service.ts` | 高 — status/diff/add/commit |

---

## 三、新增功能规划

### Feature 1：Side-by-Side Diff 视图

**动机**：Side-by-side 是代码审查工具（GitHub PR、VSCode Merge Editor）的标准模式，开发者习惯左右对比，比 Unified 更快定位改动位置。

**实现位置**：`src/components/DiffView.tsx`

**方案**：
- 在 `InlineDiff` 旁新增 `SideBySideDiff` 组件
- 两列布局，左侧原始内容（红色删除行用 `--` 占位），右侧新内容（绿色新增行用 `++` 占位）
- 行号显示：左侧原始行号，右侧新行号
- 切换控件：`Unified | Side-by-Side` toggle，状态存 localStorage

```
┌──────────────────────┬──────────────────────┐
│ 原始 (旧)             │ 变更 (新)             │
│ 1  const a = 1;      │ 1  const a = 1;      │
│ 2  const b = 2;      │ 2  const b = 99;     │
│ 3 -const c = 3;      │   (空占位)            │
│    (空占位)           │ 3 +const c = "new";  │
└──────────────────────┴──────────────────────┘
```

**状态**：待实现

---

### Feature 2：对话流 ↔ Diff 面板双向联动

**动机**：用户阅读对话时，会在 "Claude 修改了 src/checkout.js" 和实际 Diff 之间反复跳转，联动能消除这个心智负担。

**实现方案**：
- 在 `ChatPanel` 消息气泡中：检测工具调用中含 `Write/Edit/MultiEdit` 的消息，显示一个文件变更徽章（数量 + 文件名）
- 点击徽章：向 `AuxPanel` 发送一个 `activateChange(toolCallId)` 事件（通过 Zustand store）
- `ChangeSummaryPanel` 订阅该事件，滚动到并高亮对应的变更卡片

**涉及文件**：
- `src/stores/useAppStore.ts` — 新增 `activeChangeId: string | null`
- `src/components/ChatPanel.tsx` — 在工具调用气泡下方显示文件徽章，点击时 `setActiveChangeId(id)`
- `src/components/ChangeSummaryPanel.tsx` — 监听 `activeChangeId`，`scrollIntoView` + 高亮

**状态**：待实现

---

### Feature 3：上下文面板（Context Panel）

**动机**：让用户可以看到 Claude 当前"携带"了哪些文件上下文，以及 CLAUDE.md 是否生效。

**内容**：
1. **已引用文件列表**：从当前会话工具调用中提取 `Read` 工具读取的文件路径
2. **CLAUDE.md 状态**：检测工作目录下是否存在 `CLAUDE.md`，有则显示摘要（前 5 行）
3. **Token 用量**：从现有 `tokenStats` 提取，已有数据

**实现位置**：新建 `src/components/ContextPanel.tsx`，注册为 AuxPanel 的一个子标签

**状态**：待实现

---

## 四、实现优先级

| 优先级 | 功能 | 预估工时 | 价值/成本比 |
|--------|------|---------|-----------|
| P0 | Side-by-side Diff 视图 | 半天 | ★★★★★ |
| P1 | 对话⟺Diff 双向联动 | 1天 | ★★★★☆ |
| P2 | 上下文面板 | 半天 | ★★★☆☆ |
| 延后 | 跨会话文件历史 | 3天+ | ★★☆☆☆ |

---

## 五、界面结构（对话审查模式）

```
┌──────────────────────────────────────────────────────────────────┐
│  工作区顶栏（项目名 / 分支 / 标签切换）                              │
├──────────────────────────────────┬───────────────────────────────┤
│  对话流（ChatPanel，左 60%）       │  AuxPanel（右 40%）            │
│                                  │  标签：[变更] [检查点] [上下文] │
│  [用户消息]                       │                               │
│  [AI 消息]                        │  变更汇总（ChangeSummaryPanel）│
│    📄 修改了 2 个文件 ←点击联动→  │    > src/checkout.js +12 -3   │
│    src/checkout.js               │    [Unified | Side-by-Side]   │
│    src/cart.js                   │    diff 内容...               │
│                                  │                               │
│  [用户消息]                       │  上下文面板（ContextPanel）    │
│  ...                             │    已读取文件: [...]           │
│                                  │    CLAUDE.md: 已加载           │
│                                  │    Token: 1.2k / 4k            │
└──────────────────────────────────┴───────────────────────────────┘
```

---

## 六、版本对应

- **v2.1**（已完成）：布局精简 5 Phase — NavRail/消息流/工具卡片/输入区/焦点态
- **v2.2**（本文档）：代码审查增强 — Side-by-side Diff + 联动 + 上下文面板
