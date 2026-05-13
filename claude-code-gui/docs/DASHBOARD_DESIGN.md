# Claude Code GUI — 可视化审查面板设计文档

> 版本：v2.2（已完成，对应应用版本 2.4.0）  
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

**状态**：✅ 已实现（`DiffViewer` 组件，Unified/Side-by-Side 切换，状态存 localStorage，Chunk 导航）

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

**状态**：✅ 已实现（`setActiveChangeId` + `scrollIntoView` + 1.5s 高亮动画；ChatPanel 文件变更徽章点击联动）

---

### Feature 3：上下文面板（Context Panel）

**动机**：让用户可以看到 Claude 当前"携带"了哪些文件上下文，以及 CLAUDE.md 是否生效。

**内容**：
1. **已引用文件列表**：从当前会话工具调用中提取 `Read` 工具读取的文件路径
2. **CLAUDE.md 状态**：检测工作目录下是否存在 `CLAUDE.md`，有则显示摘要（前 5 行）
3. **Token 用量**：从现有 `tokenStats` 提取，已有数据

**实现位置**：新建 `src/components/ContextPanel.tsx`，注册为 AuxPanel 的一个子标签

**状态**：✅ 已实现（`ContextPanel.tsx`：已读文件列表、CLAUDE.md 摘要、Token 进度条）

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
- **v2.2**（已完成）：代码审查增强 — Side-by-side Diff + 联动 + 上下文面板

---

# v2.3 — 下一阶段规划

> 文档版本：v2.3-draft  
> 基于代码实际验证后输出（非文档推断）

---

## 一、代码验证后的真实状态修正

> 以下为本次设计复盘通过代码搜索验证的结论，纠正了路线图文档（V2_ROADMAP.md）的表述偏差。

| 功能 | 文档声称 | 代码验证结果 |
|------|---------|------------|
| Phase 3 统一变更确认 | 部分完成，"应用全部/撤销全部"未实现 | ✅ **已完整实现** — `ChangeSummaryCard` 含精确行统计、批量接受/撤销、Checkpoint 回滚 |
| Dashboard 首屏 | 未提及 | ❌ **不存在** — 无任何相关组件 |
| 自动更新 | 0% | ❌ **未实现** — 确认缺失 |
| 测试覆盖 | 0% | ⚠️ **极少** — 仅 `DiffView.test.ts` + `useAppStore.test.ts` 两个文件 |
| AgentPanel | 任务监控（推断） | ❌ **非监控** — 实际是 Claude Agent 配置文件（.claude/agents/*.md）管理 |

---

## 二、真实缺口（基于验证）

### 缺口 1：首屏体验断层（高优先级）

**事实**：`activeNavSection === 'chat'` 时 `AuxPanel` 返回 `null`，WorkspaceArea 仅显示空 ChatPanel。  
**推导**：新用户启动后看到空聊天框，无任何引导、历史记录、项目概览，功能可发现性为零。  
**结论**：需要一个"空状态首屏"，当无活动会话时呈现。

**界面设计（WorkspaceArea 空状态替换）：**

```
┌──────────────────────────────────────────────────────────────┐
│  下午好                                      v2.4  检查更新  │
├─────────────────┬────────────────────────────────────────────┤
│  继续项目        │  本周概览                                  │
│                 │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  ● my-project   │  │  12 次   │ │  $1.24   │ │  47 个   │   │
│    3小时前      │  │  会话    │ │   花费   │ │ 文件修改  │   │
│                 │  └──────────┘ └──────────┘ └──────────┘   │
│  ● payment-api  │                                            │
│    昨天         │  最近修改文件                               │
│                 │  src/ChatPanel.tsx        今天 14:23        │
│  ● frontend     │  electron/main.ts         今天 11:05        │
│    3天前        │  src/stores/useAppStore.ts 昨天 16:44       │
│                 │                                            │
│  [+ 新建会话]   │  [→ 打开 Git 面板]  [→ 查看成本报告]       │
└─────────────────┴────────────────────────────────────────────┘
```

**实现要点**：
- 触发条件：`sessions.length === 0` 或无 `activeSessionId`
- "继续项目"列表：读取 `sessionList`（已有），按 `updatedAt` 排序
- 本周概览：`CostPanel` 数据已存在，复用 `tokenHistory` 聚合
- 最近修改文件：通过 `git log --name-only --since=7days` 获取，无需新 IPC

---

### 缺口 2：ChangeSummaryCard 缺少"提交 Git"快捷入口（中优先级）

**事实**：`ChangeSummaryCard`（对话流中）已有"全部接受/撤销"，但接受后用户需要手动切换到 project → git 才能提交。  
**推导**：接受变更 → 提交 Git 是最高频的下一步操作，中间需要 3 次导航切换。  
**结论**：接受全部后显示"提交 Git ↗"入口，点击后自动切换 NavSection + SubPanel。

**交互方案**：
```
接受全部后，卡片状态变为：
┌──────────────────────────────────────────────────────┐
│ ✓ 3 个文件已接受   +47 -12    [已完成审阅]           │
│                              [提交到 Git ↗]          │
└──────────────────────────────────────────────────────┘
```
实现：`setActiveNavSection('project'); setActiveAuxSubPanel('git');`（store 已有这两个 setter）

---

### 缺口 3：自动更新（中优先级）

**事实**：`package.json` 已含 `electron-builder`，`release/` 目录有完整安装包历史。  
**推导**：`electron-updater` 是 `electron-builder` 生态的官方配套，接入成本极低。  
**结论**：接入 `electron-updater` 自动检查 GitHub Releases，有更新时在 NavRail 底部显示角标。

**实现方案**：
```
启动时（main.ts）：
  autoUpdater.checkForUpdatesAndNotify()
  → 有更新：ipcMain.send('update:available', { version, notes })

NavRail（renderer）：
  监听 update:available → 底部 ⬆ 角标 + 版本号 tooltip
  点击 → UpdateModal（版本号 + Changelog + 立即安装按钮）
```

---

### 缺口 4：实时任务监控（低优先级，长期价值高）

**事实**：`TaskPanel` 仅追踪 `todoItems`（静态列表），`AgentPanel` 是 Agent 配置管理，无实时监控面板。  
**推导**：长任务执行时（>1分钟），用户只能盯着 ChatPanel 逐行看输出，缺乏结构化进度感知。  
**结论**：在 tools 标签下新增"监控"子面板，展示当前会话工具调用时序 + Token 消耗趋势。

**界面设计（AuxPanel tools 新增 monitor 子标签）：**

```
┌──────────────────────────────────────────────────┐
│  🔄 当前任务                        运行中 4:23  │
├──────────────────────────────────────────────────┤
│  工具调用时序（本轮）                            │
│  04:01  Read   src/parser.ts          ✓ 1.2s    │
│  04:05  Read   src/types.ts           ✓ 0.8s    │
│  04:09  Bash   npx tsc --noEmit      ✓ 3.1s    │
│  04:21  Write  src/parser.ts          ● 进行中  │
├──────────────────────────────────────────────────┤
│  Token 消耗  12,450 / 200,000  ▓▓▓░░░  6.2%    │
│  预估花费    ~¥0.18                             │
└──────────────────────────────────────────────────┘
```

**数据来源**：完全复用 `useAppStore` 中现有的 `toolCalls` 和 `tokenStats`，无需新 IPC。  
**暂停功能**：暂缓实现（CLI 层需发送 `\x03` 中断信号，有破坏整个 PTY 会话的风险）。

---

## 三、执行优先级（修正后）

| 优先级 | 功能 | 复杂度 | 核心理由 |
|--------|------|--------|---------|
| P0 | 首屏 Dashboard（空状态替换） | 中（1-2天） | 新用户旅程断点，无任何现有代码可依赖 |
| P1 | ChangeSummaryCard → Git 提交入口 | 低（2小时） | 高频操作，3行 store 调用可完成 |
| P2 | 自动更新（electron-updater） | 中（1天） | 产品信任度关键，生态已有官方方案 |
| P3 | 实时任务监控面板 | 低-中（1天） | 复用现有数据，仅新增展示层 |
| P4 | 测试补全（Phase 5） | 高（持续） | 工程稳态，与功能开发并行 |

---

| P2 | 自动更新（electron-updater） | 中（1天） | 产品信任度关键，生态已有官方方案 |
| P3 | 实时任务监控面板 | 低-中（1天） | 复用现有数据，仅新增展示层 |
| P4 | 测试补全（Phase 5） | 高（持续） | 工程稳态，与功能开发并行 |

---

## 四、不做的事（v2.3 边界）

- 跨会话文件版本树
- 云同步
- 暂停/中断长任务（CLI 层风险过高，延后评估）
- 全面 UI 视觉重做

---

# v3.0 — 任务中心范式重构

> 决策依据：  
> - 用户定位：面向所有 Claude Code 用户（开源分发）  
> - 核心问题：Chat 范式承载 Agent 范式导致信息密度失衡  
> - 选定方向：B（任务中心范式）——把聊天框降级，主视图改为任务执行 + 审查

---

## 一、设计原则（First Principles）

**事实（Facts）：**
1. Claude Code 不是聊天机器人，而是自主编码智能体
2. 一个 Turn 的真实结构：`用户目标 → Claude自主规划 → N次工具调用（5-30个）→ 输出文件变更`
3. 用户在 Turn 执行期间有两种状态：监看进度 / 离开等结果
4. 用户在 Turn 结束后有一个核心任务：审查并确认变更

**假设拆解：**
- 假设「聊天流是最佳组织原则」→ **错误**：Claude 的回复不是"聊天"，而是任务报告
- 假设「更多面板 = 更强功能」→ **错误**：22 个面板藏在层级里 = 用户找不到

**推导：**  
正确的信息层次是：`任务 → 执行过程 → 需要审查的输出 → 后续指令`  
而不是：`对话气泡 → 工具卡片（折叠）→ 切换侧栏 → 找到 Diff → 审查`

---

## 二、新信息架构（IA）

### NavRail 重构（5 → 4 项）

| 当前 | 新 | 变化说明 |
|------|----|---------|
| 对话（chat） | 任务（task） | 主视图从聊天流改为任务视图 |
| 文件（files 快捷） | 首页（home） | 新增：任务列表 + 本周概览 |
| 变更（changes 快捷） | _合并进任务视图右栏_ | 审查队列内嵌在任务视图中 |
| 工具（tools，6子标签） | 工具配置（tools） | 保留原有子标签 |
| 配置（config，5子标签） | _合并进工具配置_ | 减少顶层项 |

### 主视图：TaskView 布局

```
┌─ NavRail ─┬──────────── TaskView ────────────────────────────────────┐
│           │ [auth-refactor] [payment-api] [+]   ← 多标签保持不变      │
│  🏠 首页  ├──────────────────────────────────────────────────────────│
│           │ auth-refactor                           ● 执行中 4:23    │
│  ▶ 任务  │                                                           │
│ (当前)   │ ┌── 任务指令 ────────────────────────────────────────┐    │
│           │ │ 帮我重构 src/auth 模块，提取 JWT 验证逻辑到 svc   │    │
│  🔧 工具  │ └───────────────────────────────────────────────────┘    │
│           │                                                           │
│           │ ┌── 执行时序（左60%） ─────┐  ┌── 审查队列（右40%） ──┐  │
│           │ │ ✓ Read  auth.ts   0.8s │  │ 待审查：2 个文件        │  │
│           │ │ ✓ Read  types.ts  0.5s │  │                        │  │
│           │ │ ✓ Bash  tsc       2.1s │  │ 📄 src/auth.ts +23 -5  │  │
│           │ │ ● Write auth.ts  now   │  │ [diff 展开...]          │  │
│           │ │                        │  │ [接受] [拒绝] [编辑]    │  │
│           │ │ ─────────────────────  │  │                        │  │
│           │ │ 💬 Claude 分析         │  │ 📄 src/types.ts +8 -2  │  │
│           │ │ 已重构 auth 模块...    │  │ [diff 折叠]             │  │
│           │ └────────────────────────┘  │ ─────────────────────  │  │
│           │                              │ [全部接受] [全部撤销]  │  │
│           │ ┌── 追加指令 ──────────┐    │ [提交 Git ↗]           │  │
│           │ │ 继续或补充指令... ↵  │    └────────────────────────┘  │
│           │ └──────────────────────┘                                 │
└───────────┴──────────────────────────────────────────────────────────┘
```

---

## 三、组件拆分设计

### 当前 ChatPanel.tsx 职责过重（需分解）：

| 新组件 | 职责 | 现有代码对应 |
|--------|------|------------|
| `TaskInstructions.tsx` | 展示任务指令（首条用户消息） | `messages[0].content` |
| `TaskTimeline.tsx` | 工具调用执行时序 + 进度 | `planSteps` + `TurnSummaryCard` |
| `ReviewQueue.tsx` | 常驻审查队列（所有待审 Diff） | `ChangeSummaryCard` 逻辑复用 |
| `AIAnalysis.tsx` | Claude 文字回复（可折叠） | `messages[].content`（assistant） |
| `FollowUpInput.tsx` | 追加指令输入框 | ChatPanel input 区域 |
| `useCliOutput.ts`（hook） | stream-json 解析（抽离为纯 hook） | ChatPanel 内部解析逻辑 |

### 保持不变：
- `useAppStore.ts` 数据结构无需修改
- `DiffView.tsx` / `ToolCallCard` 复用
- 所有 AuxPanel 子面板（工具/配置类）保持不变

---

## 四、首页（HomeView）设计

触发条件：`tabs.length === 0` 或无活动任务时。

```
┌──────────────────────────────────────────────────────────────┐
│  Claude Code GUI                          v2.x  [检查更新]   │
├──────────────────┬───────────────────────────────────────────┤
│  继续任务         │  本周概览                                  │
│                  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  ● auth-refactor │  │ 12 次任务│ │  $1.24   │ │ 47 个文件│  │
│    3小时前        │  └──────────┘ └──────────┘ └──────────┘  │
│                  │  最近修改文件                               │
│  ● payment-api   │  src/auth.ts              今天 14:23       │
│    昨天          │  electron/main.ts         今天 11:05       │
│                  │  src/stores/useAppStore.ts  昨天 16:44     │
│  [+ 新建任务]    │  [→ Git 面板]  [→ 成本报告]                │
└──────────────────┴────────────────────────────────────────────┘
```

---

## 五、执行路线图（v3.0）

### Phase A：最小 TaskView 骨架（不破坏现有功能）
1. 新建 `src/components/task/` 目录
2. `TaskView.tsx`：左右分栏布局骨架（左：时序+分析，右：审查队列）
3. `ReviewQueue.tsx`：复用 `ChangeSummaryCard` 逻辑，改为右栏常驻
4. WorkspaceArea 根据条件切换：有 session → `TaskView`，无 session → `HomeView`

### Phase B：NavRail 精简
1. 合并 tools + config → `工具配置`（单一入口）
2. 新增 `HomeView.tsx`（复用 sessionList + CostPanel 数据）
3. 验证：顶层导航 ≤ 4 项，不丢失任何功能

### Phase C：自动更新
1. 接入 `electron-updater`
2. NavRail 底部更新角标 + UpdateModal

### Phase D：执行监控增强
1. `TaskTimeline.tsx` 加入实时进度条（复用 planSteps）
2. Token + 成本实时追踪嵌入任务视图顶栏

---

## 六、不做的事（v3.0 边界）

- 跨会话文件版本树
- 云同步
- 暂停/中断长任务（CLI 层风险，延后）
- 完全重写 CLI 解析层
- 测试补全（与功能并行，不阻塞）

