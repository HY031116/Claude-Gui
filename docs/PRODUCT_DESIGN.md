# Claude Code GUI — 产品设计方案

> 版本：v4.9-Design  
> 设计原则：Agent 中心 · 最小介入 · 全功能覆盖  
> 适用范围：v4.9 → v5.0 版本路线（感知层 + 产物闭环）  
> 上次更新：2026-05-17（新增版本路线图 §8）

---

## 一、设计基础：第一性原则推导

### 事实（Facts）

| # | 事实 |
|---|------|
| F1 | Claude Code 的核心能力是**自主执行长任务**，而非问答式交互 |
| F2 | Subagents、Worktrees、Agent Teams 意味着**多个 Agent 可并行工作** |
| F3 | 用户真实行为：「分配任务 → 离开做其他事 → 回来审查结果」，而非「持续盯着对话框」 |
| F4 | 人类的核心价值在于**审批决策**和**方向校准**，而非逐行指令 |
| F5 | Claude Code CLI 拥有 14 大功能域，覆盖从简单对话到多代理团队协作的完整工作链 |
| F6 | 技术栈：React 19 + Zustand + Electron，无法支持云端 Routines / Remote Control |
| F7 | **Background Sessions** 是 Claude Code 的核心并行机制：每个后台会话有独立 worktree、Supervisor 进程管理、短 ID、PR 关联，通过 `claude agents` TUI 统一看板管理 |
| F8 | **Agent Teams**（`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`）已实验性可用：Lead + Teammates 架构，共享任务列表，Teammate 间可直接互发消息；**Fork Mode**（`CLAUDE_CODE_FORK_SUBAGENT=1`）允许继承当前对话上下文的分叉会话 |

### 被质疑的假设（旧范式的错误前提）

| 假设 | 质疑 | 结论 |
|------|------|------|
| "Chat 输入框是 UI 的核心" | 用户实际目标是完成任务，不是聊天 | Chat 降级为「任务委派入口」和「Agent 日志」 |
| "功能按技术类型分 Tab" | 用户按「工作场景」思考，不按「技术分类」 | 按场景重组 IA |
| "单会话线性流程" | Claude Code 原生支持并行 Worktree 和 Subagents | UI 需要原生支持多 Agent 并发视图 |

### 设计目标（从事实推导）

1. **Agent 中心**：UI 的视觉重心是「Agent 状态 + 人类介入队列」，而非 Chat 输入框
2. **最小介入**：用户只在关键决策点出现，日常由 Agent 自主推进
3. **全功能覆盖**：所有 CLI 能力在 GUI 中都有对应的可视化路径，用户无需切回终端
4. **认知负荷最小化**：复杂功能（Hooks/Subagents/Agent Teams）通过可视化降低理解成本

---

## 二、信息架构（IA）— Agent 中心版

```
Claude Code GUI
│
├── 🏠 指挥中心（Command Center）     ← 默认首页，对标 `claude agents` TUI 的 GUI 升级版
│     ├── 后台会话分组看板（📌 置顶 / 🟡 需要输入 / 📋 PR 待审查 / ⚙ 工作中 / ✅ 已完成）
│     ├── 每行：图标状态 + Haiku 摘要 + PR 状态点 + 时间戳
│     ├── Peek 快速预览面板（Space 展开：最近输出 + 快速回复 + PR 链接）
│     └── 今日统计（会话数/文件变更/Token/成本/估算节省时间）
│
├── ⚡ 委派（Dispatch）               ← 原 Chat，升级为任务委派
│     ├── 任务委派表单（结构化 + 自然语言混合）
│     ├── 对话日志（Agent 工作日志，可折叠）
│     └── @引用文件 / Skills 注入
│
├── 🤖 Agents                         ← 核心新功能中心
│     ├── Worktrees（并行分支管理，可视化切换）
│     ├── Subagent 定义（完整字段编辑器：name/tools/model/permissionMode/memory/hooks/color/isolation/effort/background 等）
│     └── 🧪 Agent Teams（实验性，启用后显示）
│           ├── 团队结构（Lead + Teammates + 状态）
│           ├── 共享任务列表（pending/in-progress/completed + 依赖关系）
│           └── Teammate 直接消息（不经 Lead）
│
├── ✅ 审查（Review）                  ← 人类介入的核心流
│     ├── 介入队列（权限确认 / 方向校准）
│     ├── Diff 审查（Side-by-Side / Unified，逐块接受）
│     ├── Plan 审查（Plan Mode 步骤列表，可勾选/删除）
│     └── Checkpoint（快照回滚）
│
├── 📦 产物（Artifacts）               ← 任务产出物聚合
│     ├── 文件变更历史（按任务分组）
│     ├── PR 集成（创建/状态/评论）
│     ├── Git（提交/分支/日志）
│     └── 会话历史（跨重启持久化）
│
├── 🔧 能力配置（Capabilities）        ← 原 Extensions，聚合配置类功能
│     ├── Skills（技能库管理）
│     ├── Hooks（生命周期钩子可视化配置器）
│     ├── Rules（路径规则 frontmatter）
│     ├── Memory（CLAUDE.md 编辑器）
│     ├── MCP 服务（Model Context Protocol）
│     └── 插件市场（浏览/安装/卸载 Plugins）
│
├── 📊 监控（Monitor）
│     ├── 上下文 & Token 用量
│     ├── 成本追踪（按会话/按项目）
│     └── 定时任务（本地 Routines 管理）
│
└── ⚙ 设置（Settings）
      ├── 认证（API Key / 官方登录）
      ├── 模型（Sonnet / Opus / Haiku）
      ├── 权限模式（auto / plan / acceptEdits / dontAsk）
      ├── 代理设置（HTTP Proxy）
      └── UI 主题 / 快捷键
```

---

## 三、关键视图设计

### 3.1 指挥中心（Command Center）— 默认首页

> 设计对齐：`claude agents` TUI 的 GUI 升级版。后台会话由 Supervisor 进程管理，每个会话有独立 worktree、短 ID、PR 关联。

```
┌─ 指挥中心 ──────────────────────────────── [+ 新后台任务] [筛选▼] ┐
│                                                                    │
│  📌 置顶                                                           │
│  ┌─ ✽ fix-login-bug ──────────────────────────────── 🟡 需介入 ──┐│
│  │  需要你的决策：发现两种修复方案，选哪个？               [3m] ···││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                    │
│  🟡 需要输入                                            [全部处理] │
│  ┌─ ✻ refactor-auth ─────────────────────── 🔴 权限请求 ─────────┐│
│  │  请求执行 Shell：rm -rf node_modules && npm install            ││
│  │                             [快速预览▾]  [拒绝]  [本次允许]    ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                    │
│  📋 PR 待审查                                                       │
│  ┌─ ∙ add-unit-tests ──────────────── github.com/repo/pull/142 ──┐│
│  │  检查通过，等待 Review · 0 评论                          2h  ● ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                    │
│  ⚙ 工作中                                                          │
│  ┌─ ✽ migrate-database ────────────────────────────────────── ───┐│
│  │  正在执行：Edit src/db/migrations/v3.sql                 8m ● ││
│  └────────────────────────────────────────────────────────────────┘│
│  ┌─ ✢ run-e2e-tests ──── 第 3 轮 · 下次运行 in 12m ─────────────┐│
│  │  /loop 循环任务：全部检查点通过                                 ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                    │
│  ✅ 已完成                                                          │
│  ┌─ ∙ fix-typos ──────── 结果：修复了 12 处拼写错误        4h ───┐│
│  └────────────────────────────────────────────────────────────────┘│
│  … 6 条历史（折叠）                                                 │
│                                                                    │
│  今日统计：3 会话 · 47 变更 · $1.24 · 节省 ~94 分钟（估算）        │
└────────────────────────────────────────────────────────────────────┘
```

**会话行图标状态系统（对齐官方 agent view）：**

| 图标 | 含义 | 颜色 |
|------|------|------|
| `✽`（动画） | 进程存活 · 工作中 | 蓝色动画 |
| `✻` | 进程存活 · 等待输入 | 黄色 |
| `∙` | 进程已退出（可自动恢复）| 灰色 |
| `✢` | /loop 循环睡眠中，显示倒计时 | 紫色 |

**PR 状态点**（行右侧）：`●`黄=待检查/审查，`●`绿=已通过，`●`紫=已合并，`○`灰=Draft

**设计理由：**
- 按状态分组而非按时间流：快速扫视「谁需要我」，不用滚动读日志
- 置顶 + 需要输入优先：人类最高价值在决策，不在观察
- Peek 面板（Space 展开）：无需进入完整对话即可回复和查看 PR 状态
- 今日统计含「节省时间估算」：强化 AI 价值感知

### 3.1.1 CommandCenter 实现规范

#### 状态分组逻辑（数据映射）

基于当前 `processingTabs` + `tabSnapshots` + `pendingChangesPerTab`，按优先级从高到低分类：

| 分组 | 判定条件 | 当前数据来源 |
|------|---------|------------|
| 📌 置顶 | `pinnedTabIds.has(tab.id)` | store 新增 `pinnedTabIds: Set<string>` |
| 🟡 需要输入 | 最后消息来自 assistant 且含问号/选项，且未 processing | 启发式正则匹配 messages |
| 📋 PR 待审查 | 该 tab 有未审查的文件变更（per-tab 计算）| messages 中 `diffReviewStatus == null` |
| ⚙ 工作中 | `processingTabs[tab.id] === true` | 现有字段 |
| ✅ 已完成 | 以上均不满足 | 默认 fallback |

**会话图标判定（TypeScript）：**

```typescript
type SessionIcon = '✽' | '✻' | '∙' | '✢';

function getSessionIcon(tabId: string, processingTabs, tabSnapshots): SessionIcon {
  if (processingTabs[tabId]) {
    const snap = tabSnapshots[tabId];
    const lastMsg = snap?.messages?.at(-1);
    // 检测 /loop 模式
    const hasLoop = snap?.messages?.some(m => m.content?.includes('/loop'));
    if (hasLoop && !processingTabs[tabId]) return '✢';
    return '✽'; // 动画旋转
  }
  if (isNeedsInput(tabId, tabSnapshots)) return '✻';
  return '∙';
}
```

#### Peek 面板交互规格

**触发：** 点击会话行（非 action 按钮） / 键盘 Space  
**收起：** 再次点击 / Escape / 点击其他行 / 提交输入

```
状态→「需要输入」Peek：
  • 显示最后一条 assistant 消息前 120 字
  • 内联输入框（自动聚焦），Enter 发送 → 跳转到该 tab Dispatch 视图
  
状态→「工作中」Peek：
  • 显示最近执行的工具名 + 文件路径
  • [查看完整日志] 按钮 + [停止 ⏹] 按钮
  
状态→「PR 待审查」Peek：
  • 列出变更文件名（最多 3 条，其余折叠）
  • [查看 Diff] / [全部接受 ✓] / [回滚全部 ↩] 快捷按钮
  
状态→「已完成」Peek：
  • 结果摘要（最后 assistant 消息截断）+ 耗时 + 成本
  • [继续对话] / [新建类似任务]
```

#### 实时更新策略

```
阶段一（当前可实现）：
  - IPC 事件被动更新（现有机制，保留）
  - 每 30s 从 localStorage 刷新 conversationHistory

阶段二（后台会话就绪后）：
  - IPC → electron.invokeCliCommand(['agents', '--json'])
  - 活跃会话时轮询 5s，无活跃时 30s（自适应）

阶段三（Supervisor 推送）：
  - 纯响应式，零轮询
```

#### 渐进式实现路线

```
MVP（立即可实现）：状态分组 + 会话行图标（4态）+ Peek（工作中+待审查）+ 节省时间估算
v3.1：needsInput Peek + 置顶功能 + 轮询 hook + PR 状态点
v3.2：Supervisor 对接 + Loop 检测 + PR 自动关联
```

---

### 3.2 任务委派界面（Dispatch）

#### 3.2.1 两态视图模型

Dispatch 视图存在两种状态，路由由 `(isConnected, messages.length)` 决定：

```
┌─────────────────────────────────────────────┐
│  Dispatch 路由入口                           │
│                                              │
│  isConnected=false                           │
│  AND messages.length=0        ──→  [A] 委派表单（LaunchPanel）
│                                              │
│  isConnected=true             ──→  [B] 任务执行视图（TaskView）
│  OR  messages.length > 0                     │
└─────────────────────────────────────────────┘
```

状态 [B] 是当前已有的 TaskView（ChatPanel + ReviewQueue + TaskTimeline），保持不变。  
状态 [A] 替换当前简单的"启动会话"引导卡，改为完整结构化委派表单。

---

#### 3.2.2 委派表单（LaunchPanel）完整线框图

```
┌─ ⚡ 委派新任务 ─────────────────────────────────────────────────────┐
│                                                                    │
│  📁 工作目录  /Users/you/my-app                    [更换目录]       │
│                                                                    │
│  ─────────────────────────────────────────────────────────────── │
│                                                                    │
│  任务描述 *                                                         │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ 重构 src/auth 模块，将 JWT 逻辑提取为独立 AuthService，      ││
│  │ 保持现有接口不变，确保所有测试通过。                          ││
│  │                                                              ││
│  │ 相关文件：@src/auth/login.ts @src/auth/middleware.ts         ││
│  └──────────────────────────────────────────────────────────────┘│
│  提示：用 @文件路径 引用上下文文件，用 /skill名 激活技能           │
│                                                                    │
│  ─ 执行配置 ───────────────────────────────────────────────────── │
│                                                                    │
│  执行模式                                                           │
│  [● 自动（推荐）] [○ 计划审查] [○ 完全自主] [○ 仅接受编辑]        │
│  ↳ Claude 自主判断何时需要确认，平衡效率与安全                      │
│                                                                    │
│  Agent（可选）                                                      │
│  [无（使用默认 Claude）▼]  ← 下拉：从 ~/.claude/agents/ 加载      │
│                                                                    │
│  模型（可选，留空继承全局设置）                                      │
│  [继承全局（claude-sonnet-4-5）▼]                                  │
│                                                                    │
│  ─ 高级选项 ▶ 点击展开 ──────────────────────────────────────────  │
│                                                                    │
│  [🚀 启动任务]              成本上限  [$—     ]  最大轮次 [—  ]   │
│                                                                    │
│  ─── 最近模板 ────────────────────────────────────────────────── │
│  [🔁 修 Bug][📝 写测试][♻ 重构][📚 写文档][+ 保存当前为模板]      │
└────────────────────────────────────────────────────────────────────┘
```

**展开「高级选项」后：**

```
│  ─ 高级选项 ▼ ───────────────────────────────────────────────────  │
│                                                                    │
│  Skills 注入                                                        │
│  [☑ debug-detective] [☑ autofix-pr] [☐ security-review] [+ 更多] │
│  ↳ 在首条消息前追加 /skill-name 激活，Subagent 继承               │
│                                                                    │
│  附加系统提示词                                                      │
│  [（追加到默认系统提示词末尾，不替换）                          ]   │
│  ● 追加（--append-system-prompt）                                  │
│  ○ 替换（--system-prompt，⚠ 会丢失内置 safety 规则）              │
│                                                                    │
│  工具访问                                                           │
│  [☑ 全部工具（默认）] 或自定义：禁止 [Bash, Write           ]     │
│                                                                    │
│  🧪 实验性功能                                                      │
│  [☐ 分叉模式（Fork Mode）— 继承当前对话上下文启动新会话]           │
│     需要 CLAUDE_CODE_FORK_SUBAGENT=1                               │
│  [☐ 后台任务（Background）— 在后台独立 worktree 运行]             │
│     需要 claude agents 命令支持                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

#### 3.2.3 字段完整规格与 CLI 参数映射

| 字段 | UI 组件 | CLI 参数 | 备注 |
|------|---------|---------|------|
| 任务描述 | Textarea（自动高度）| 第一条用户消息内容 | 支持 @file 引用、/skill 命令 |
| @文件引用 | 行内语法 `@path` | 追加到任务描述正文 | 文件内容注入到上下文 |
| 执行模式 | 单选按钮组（4项）| `--permission-mode` | 见下表 |
| Agent | 下拉选择器 | `--agent <name>` | 从 `~/.claude/agents/` + `.claude/agents/` 加载 |
| 模型 | 下拉选择器 | `--model <id>` | 留空 = 继承全局 Settings |
| Skills | 多选标签 | 追加到消息首行（`/skill1 /skill2`）| 消息构造时注入 |
| 附加系统提示词 | Textarea + 模式切换 | `--append-system-prompt` / `--system-prompt` | 默认追加模式 |
| 禁止工具 | 标签输入 | `--disallowed-tools` | 逗号分隔 |
| Fork Mode | 开关 | 环境变量 `CLAUDE_CODE_FORK_SUBAGENT=1` | 继承当前 conversationSessionId |
| 后台任务 | 开关 | `--background`（待 CLI 支持）| v3.2 实现 |
| 成本上限 | 数字输入（USD）| `--max-budget-usd` | 留空 = 无限制 |
| 最大轮次 | 数字输入 | `--max-turns` | 留空 = 无限制 |
| 会话名称 | 文本输入（可选）| `--name` | 自动填入任务描述前 20 字 |

**执行模式映射：**

| UI 选项 | `--permission-mode` 值 | 含义 |
|--------|----------------------|------|
| 自动（推荐）| `default` / 省略 | Claude 自主判断何时询问 |
| 计划审查 | `plan` | 生成计划后必须用户确认才执行（对应 Plan Mode）|
| 仅接受编辑 | `acceptEdits` | 文件变更自动接受，Shell 命令需确认 |
| 完全自主 | `bypassPermissions` | 无需任何确认（⚠ 高风险，用紫色标注）|

---

#### 3.2.4 @文件引用与 Skills 注入逻辑

**@文件引用：**
- 用户在 Textarea 内输入 `@src/auth/login.ts`，触发文件路径自动补全（fuzzy 匹配工作目录）
- 提交时：读取文件内容，以 `<file path="...">...</file>` 标签包裹追加到任务消息末尾
- 安全：仅读取工作目录内的文件，拒绝绝对路径到工作目录外

**Skills 注入：**
- 从 `~/.claude/skills/` + `.claude/skills/` 目录加载可用 Skills 列表
- 选中的 Skills 以 `/skill-name` 形式追加到任务消息**首行**（Claude 会在执行前自动 load skill）
- 示例：消息 = `/debug-detective /autofix-pr\n\n重构 src/auth...`

---

#### 3.2.5 表单状态与校验

```
提交前校验：
  ✗ 任务描述为空 → 输入框红色边框 + "请描述需要完成的任务"
  ✗ 未选择工作目录 → 提示"请先选择项目目录"
  ✗ 成本上限为负数或零 → 提示"请输入正数金额"
  
提交按钮状态：
  禁用：工作目录为空 OR 任务描述为空
  加载中：点击后按钮变为 [⏳ 启动中…]，等待 CLI 进程就绪
  成功：跳转到 TaskView [B] 态，首条消息自动发送
```

---

#### 3.2.6 最近模板（快速复用）

```
模板数据结构（存储在 localStorage）：
{
  id: string,
  name: string,           // 展示名称
  taskDescription: string,
  permissionMode: string,
  agentName?: string,
  skills: string[],
  systemPromptAppend?: string,
  disallowedTools?: string,
  usedAt: number          // 最近使用时间戳，用于排序
}

内置模板（不可删除）：
  修 Bug    → permissionMode: 'default'，描述模板："修复 {文件/功能} 中的问题"
  写测试    → permissionMode: 'acceptEdits'，描述模板："为 {模块} 编写单元测试"
  重构      → permissionMode: 'plan'（先审查计划），描述模板："重构 {模块}"
  写文档    → permissionMode: 'acceptEdits'，描述模板："为 {模块} 编写 JSDoc 注释"

用户自定义模板：点击「+ 保存当前为模板」→ 弹出命名对话框 → 保存当前所有表单字段
```

---

#### 3.2.7 消息构造逻辑（提交时）

```typescript
function buildTaskMessage(form: DispatchForm): string {
  const parts: string[] = [];
  
  // 1. Skills 前置（Skills 必须在消息开头才能被 Claude 识别）
  if (form.skills.length > 0) {
    parts.push(form.skills.map(s => `/${s}`).join(' '));
    parts.push('');  // 空行分隔
  }
  
  // 2. 任务描述主体
  parts.push(form.taskDescription);
  
  // 3. @文件引用内容展开
  for (const filePath of form.contextFiles) {
    const content = await readFileRelative(filePath, form.workingDirectory);
    parts.push(`\n<file path="${filePath}">\n${content}\n</file>`);
  }
  
  return parts.join('\n');
}
```

---

#### 3.2.8 与在途会话的联动

- 若当前 Tab 已有进行中的对话（messages.length > 0）：  
  「委派」导航图标点击 → 直接进入 TaskView [B] 态（不显示表单）
- 若要新建独立任务：点击 CommandCenter 的 [+ 新后台任务] → 自动新建 Tab → 进入 [A] 表单态
- Fork Mode 开启时：新 Tab 的 `--resume` 参数设置为当前 `conversationSessionId`，继承上下文

---

### 3.3 介入视图（Agent 需要人类时）

> **实现背景**：Claude 在执行过程中有多种需要人类参与的时机，GUI 需要分类处理并给出清晰的
> 等待状态指示。当前代码已实现工具审批（`PermissionBannerCard` + `PermissionRequestEvent`），
> 本节规范其余介入类型并建立统一的介入管理机制。

#### 3.3.1 介入类型总览

| 类型 | 触发来源 | 当前实现状态 | 优先级 |
|------|---------|------------|--------|
| A — 工具审批 | `permission-request` IPC 事件（MCP server） | ✅ 已实现 `PermissionBannerCard` | 阻塞型，最高 |
| B — 决策问题 | Claude 消息文本包含问句 + 会话停止输出 | ❌ 仅有线框，无检测逻辑 | 阻塞型，高 |
| C — 文件/截图请求 | Claude 消息文本包含"attach"/"screenshot" 关键词 | ❌ 未实现 | 阻塞型，高 |
| D — 长时等待提醒 | 会话超过 N 秒无输出且未结束 | ❌ 未实现 | 非阻塞，低 |

**原则**：  
- 类型 A 由 Electron 主进程直接推送，GUI 无需轮询，响应延迟最低。  
- 类型 B/C 通过消息流文本分析检测（见 3.3.2），存在一定误报率，需人工最终确认。  
- 所有介入事件在 Tab 状态栏显示 🔴 红点（阻塞型）或 ⚠ 黄点（提醒型）。

---

#### 3.3.2 介入检测逻辑

**类型 A（工具审批）**：纯事件驱动，由 `permission-prompt-server.ts` 通过 HTTP POST 推送，
Electron 主进程转发为 `permission-request` IPC 事件，已实现，无需新逻辑。

**类型 B（决策问题）检测规则**（消息文本分析）：

```typescript
function detectDecisionRequest(messageText: string): boolean {
  // 规则 1：以问句结尾（?、？、中文问号变体）
  const endsWithQuestion = /[?？]\s*$/.test(messageText.trim());

  // 规则 2：包含决策关键词（英/中）
  const decisionKeywords = [
    'which', 'should I', 'do you want', 'do you prefer',
    'would you like', 'please choose', 'please select',
    '哪种', '哪个', '你想要', '你希望', '请选择', '请确认',
    '方案 A', '方案 B', 'Option A', 'Option B',
  ];
  const hasKeyword = decisionKeywords.some(kw =>
    messageText.toLowerCase().includes(kw.toLowerCase())
  );

  // 规则 3：包含枚举列表（"1." / "A." / "Option" 等）
  const hasOptionList = /\b(option|choice|方案|选项)\s*[A-D1-4][\.\)：:]/i.test(messageText);

  return endsWithQuestion || (hasKeyword && hasOptionList);
}
```

**类型 B 检测时机**：消息类型为 `assistant`，流式输出完成后（`message-done` 事件），
且 `session.isConnected === false`（Claude 已停止等待响应），则触发检测。

**类型 C（文件/截图请求）检测规则**：

```typescript
const FILE_REQUEST_PATTERNS = [
  /attach(ing)?\s+(a\s+)?(screenshot|image|file)/i,
  /can you (share|provide|upload|send)\s+(the\s+)?(screenshot|image|file)/i,
  /please (attach|share|upload)\s+(the\s+)?(screenshot|file)/i,
  /(上传|分享|提供|截图|附件)/,
];
```

**类型 D（长时等待）**：  
- 条件：`session.isConnected === true` + 最近消息超过 45 秒无更新 + 无 permission-request 待处理  
- 仅显示非阻塞提示横幅，不中断操作流

---

#### 3.3.3 工具审批卡片规格（类型 A）

**现有 `PermissionRequestEvent` 字段映射**：

| 字段 | 界面展示位置 |
|------|------------|
| `toolName` | 卡片标题：`🔧 工具审批：{toolName}` |
| `inputPreview` | 卡片主体：代码块展示（等宽字体） |
| `toolInput` | 展开详情时显示完整 JSON |
| `suggestions` | 若有：显示"建议操作"说明 |
| `id` | 用于 `cliRespondPermission(id, allow)` 回调 |

**工具审批卡片完整线框图**

```
┌─ 🔧 工具审批请求 ────────────────────────────────────────────────┐
│  Alpha 想要执行以下操作，请确认是否允许：                          │
│                                                                   │
│  工具：Bash                                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ npm install --save-dev jest @types/jest                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  [▸ 查看完整参数]                                                 │
│                                                                   │
│  ⚠ 此操作将修改 node_modules 和 package.json                    │
│                                                                   │
│  [✅ 允许] [❌ 拒绝] [✅ 允许（本次会话内同类操作都允许）]          │
└───────────────────────────────────────────────────────────────────┘
```

**「本次会话同类都允许」逻辑**：  
- 记录 `autoAllowedTools: Set<string>`（会话级）  
- 新 `permission-request` 到达时，若 `toolName` 在集合内，自动调用 `cliRespondPermission(id, true)` 跳过弹卡  
- 会话结束时清空（不持久化到 localStorage）

**工具名 → 风险提示文字映射**（补充至卡片底部）

| 工具名模式 | 风险提示 |
|-----------|---------|
| `Bash` / `bash` | 将在当前工作区执行 Shell 命令 |
| `Write` / `write_file` | 将创建或覆盖文件 |
| `Edit` / `MultiEdit` | 将修改现有文件 |
| `WebSearch` | 将发送网络请求（使用网络）|
| 其他 | （无额外提示）|

---

#### 3.3.4 决策型介入（类型 B）线框图与规格

**[A] 单问题 + 自由文字回答**

```
┌─ 💬 Alpha 需要你的输入 ─────────────────────────────────────────┐
│                                                                   │
│  Alpha 在分析 src/auth 时发现了一个设计决策点：                    │
│                                                                   │
│  "我找到了两种重构方案：                                           │
│   方案 A：提取 AuthService class（+60行，测试更好写）              │
│   方案 B：使用函数式组合（+30行，与现有代码风格更一致）"            │
│                                                                   │
│  ┌── 方案 A 代码预览 ────────┐  ┌── 方案 B 代码预览 ────────┐    │
│  │ class AuthService {      │  │ const withAuth =           │    │
│  │   signIn() { ... }       │  │   compose(validate,        │    │
│  │   verify() { ... }       │  │     authenticate)          │    │
│  │ }                        │  │                            │    │
│  └──────────────────────────┘  └────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 输入你的选择或补充说明...                    [↵ 发送]     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  [选 A — 面向对象]  [选 B — 函数式]  [让 Alpha 自行决定]         │
└───────────────────────────────────────────────────────────────────┘
```

**[B] 简单 Yes/No 确认**

```
┌─ 💬 Alpha 需要确认 ─────────────────────────────────────────────┐
│                                                                   │
│  "我准备删除 12 个已弃用的测试文件，是否继续？                      │
│   涉及文件：src/test/legacy/*.test.ts"                            │
│                                                                   │
│  [✅ 继续] [❌ 取消] [💬 告诉我更多...]                           │
└───────────────────────────────────────────────────────────────────┘
```

**决策型介入 UI 构成规格**

| 元素 | 描述 | 必须 |
|------|------|------|
| 介入头部 | `💬 {agentName} 需要你的输入` | 是 |
| 问题文本 | Claude 消息原文（截取问题部分）| 是 |
| 代码预览 | 若消息包含代码块，提取前 2 个并排展示 | 否 |
| 快捷选项按钮 | 从枚举列表提取（最多 4 个）| 否 |
| 文字输入框 | 始终显示，允许自定义回答 | 是 |
| 「让 Agent 自行决定」| 发送"Please use your best judgment and proceed."| 是 |

**快捷选项提取逻辑**：扫描 Claude 消息中的 `Option A/B` 或 `方案 A/B` 模式，
提取标签后截断到 20 字符，作为快捷按钮。超过 4 个选项时退化为纯文字输入。

---

#### 3.3.5 文件/截图附件请求规格（类型 C）

```
┌─ 📎 Alpha 需要一个文件或截图 ───────────────────────────────────┐
│                                                                   │
│  "Could you share a screenshot of the error? It will help me     │
│   diagnose the issue better."                                     │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  📸 [粘贴截图]  📁 [选择文件]  🗒 [输入文字说明]          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  [无法提供，让 Alpha 继续]                                        │
└───────────────────────────────────────────────────────────────────┘
```

**实现说明**：  
- 「粘贴截图」→ 监听 `Ctrl+V` / `Cmd+V`，捕获剪贴板图片 → `saveTempImage()` → 路径注入消息  
- 「选择文件」→ 调用 `selectFile()` → 返回路径 → 用 `@{filePath}` 语法注入上下文  
- 「无法提供」→ 发送"I cannot provide that. Please continue without it."  

---

#### 3.3.6 介入导航与状态联动

**Tab 状态点规则**（`TabBar.tsx` 中的状态指示器）

| 情形 | 状态点颜色 | 含义 |
|------|-----------|------|
| 有未处理工具审批（类型 A）| 🔴 红 | 阻塞，Claude 暂停执行 |
| 有未回答决策问题（类型 B）| 🔴 红 | 阻塞，Claude 暂停执行 |
| 有文件请求（类型 C）| 🔴 红 | 阻塞，Claude 暂停执行 |
| 长时等待（类型 D）| 🟡 黄 | 非阻塞，Claude 仍在运行 |
| 正常执行中 | 🔵 蓝（pulse） | 运行正常 |
| 空闲 | 无 | 等待新任务 |

**从 CommandCenter 点击介入的跳转路径**

```
CommandCenter 会话卡片 [🔴 需要你的介入]
  → 点击
  → useAppStore.setActiveTab(tabId)         // 切换到对应 Tab
  → router 自动跳转到 dispatch 视图         // 已在 TaskView 中
  → 介入横幅自动滚动到视口顶部（滚动到最新消息）
```

---

#### 3.3.7 后台介入通知机制

当介入事件到达时，若用户当前不在该 Tab（`activeTabId !== interventionTabId`）：

**通知策略**

| 介入类型 | 通知方式 |
|---------|---------|
| 工具审批（A）| 系统通知 `notifySend()` + Tab 状态点变红 |
| 决策问题（B）| 系统通知 + Tab 状态点变红 |
| 文件请求（C）| Tab 状态点变红（无系统通知，不打扰）|
| 长时等待（D）| Tab 状态点变黄（无通知）|

**系统通知内容规格**

```typescript
await window.electronAPI.notifySend(
  `${agentName} 需要你的输入`,   // 标题
  `${tabLabel} — ${summaryText.slice(0, 80)}`  // 正文（截断 80 字符）
);
```

点击系统通知时，通过 `ipcRenderer.send('focus-tab', tabId)` 激活对应 Tab。

---

#### 3.3.8 介入队列管理

当同一会话中多个介入同时出现（例如并行工具审批）：

**渲染策略**

```
[介入 #1 — 工具审批：Bash]     ← 显示在消息流内联位置（当前已实现）
[介入 #2 — 工具审批：Edit]     ← 依次堆叠，最新的在最下方
[介入 #3 — 决策问题]           ← 同上
```

**处理顺序**：用户可任意顺序响应，系统分别追踪每个介入的 `id` 状态，不强制串行。

**清空时机**

| 事件 | 动作 |
|------|------|
| `permission-resolved` 事件 | 从 `permissionRequests` 列表移除对应项 |
| 用户发送新消息 | 清除所有 B/C 类介入（假设问题已得到回答） |
| 会话结束 (`session.isConnected` 变 false) | 清除所有 A 类待处理审批（超时处理）|

---

### 3.4 Plan Mode 审查视图

> **实现背景**：Plan Mode（`--permission-mode plan`）下，Claude 在执行任何工具前先输出一段
> Markdown 文字描述完整计划，由用户审查后再触发执行。CLI 仅支持 `y/n` 确认；GUI 提供逐步骤
> 勾选、风险色彩标注、跳过注入、内联编辑等超越 CLI 的能力。

#### 3.4.1 Plan Mode 触发条件与状态机

**触发路径**

| 入口 | 触发方式 |
|------|---------|
| Dispatch 委派表单 | 执行模式选"计划审查（Plan Mode）"→ `permissionMode: 'plan'` |
| 设置面板 | 全局默认模式设为 Plan |
| CLI 直接传参 | 已有会话以 `--permission-mode plan` 启动 |

**Plan Mode 状态机**

```
idle
  └─ [用户提交任务]
       ↓
generating_plan           ← Claude 正在生成计划文本（流式输出）
  └─ [onPlanGenerated]
       ↓
plan_ready                ← GUI 解析完毕，显示审查视图，等待用户操作
  ├─ [用户点击「确认执行」]
  │     ↓
  │   executing           ← Claude 按用户选中步骤执行工具调用
  │     └─ [全部步骤完成/失败]
  │           ↓
  │         done / error
  ├─ [用户点击「取消计划」]
  │     ↓
  │   cancelled           ← 发送取消消息，会话回到 idle
  └─ [用户点击「在编辑器中调整」]
        ↓
      editing_plan        ← 弹出内联编辑器，用户修改后重新解析
        └─ [保存] → plan_ready（重新解析）
```

**状态存储扩展（Store）**

```typescript
// 在 useAppStore 中新增（每个 TabSession 内部）
interface PlanReviewState {
  phase: 'idle' | 'generating_plan' | 'plan_ready' | 'executing' | 'done' | 'cancelled';
  rawPlanText: string;           // Claude 输出的原始计划 Markdown
  parsedSteps: ReviewablePlanStep[];  // 解析后可交互的步骤列表
  confirmedAt?: number;          // Unix timestamp，用于审计
}
```

---

#### 3.4.2 计划文本解析逻辑（Markdown → ReviewablePlanStep[]）

Claude 在 Plan Mode 下输出格式为带编号的 Markdown 列表，GUI 必须将其解析为结构化步骤。

**输入示例（Claude 原始输出）**

```
I'll help you refactor the auth module. Here's my plan:

1. Read `src/auth/login.ts` to analyze the existing JWT logic
2. Modify `src/auth/login.ts` to extract an `AuthService` class (~60 additions, 15 deletions)
3. Run `npm test` to verify the test suite passes
4. Update `src/auth/middleware.ts` to reference the new `AuthService`
5. Generate test cases in `src/auth/auth.service.test.ts`
```

**解析规则（按优先级匹配）**

| 优先级 | 匹配条件 | 工具分类 | 说明 |
|--------|---------|---------|------|
| 1 | 包含 `Run ` / `Execute ` / `run ` + 反引号内有命令 | `Bash` | 提取命令内容 |
| 2 | 包含 `Read ` / `Analyze ` / `Search ` + 文件路径 | `Read/Grep` | 提取文件路径 |
| 3 | 包含 `Modify ` / `Edit ` / `Update ` + 文件路径 | `Edit` | 提取文件路径 |
| 4 | 包含 `Create ` / `Write ` / `Generate ` + 文件路径 | `Write` | 提取文件路径 |
| 5 | 其余 | `Unknown` | 保留原始描述 |

**TypeScript 伪代码**

```typescript
function parsePlanSteps(rawText: string): ReviewablePlanStep[] {
  // 提取编号列表行：匹配 "1. " / "1) " 格式
  const listLines = rawText
    .split('\n')
    .filter(line => /^\d+[\.\)]\s/.test(line.trim()));

  return listLines.map((line, idx) => {
    const text = line.replace(/^\d+[\.\)]\s*/, '').trim();
    const toolType = inferToolType(text);          // 见下方规则表
    const riskLevel = inferRiskLevel(toolType, text);
    const target = extractTarget(text);            // 文件路径或命令摘要

    return {
      id: `plan-step-${idx}`,
      index: idx + 1,
      rawText: text,
      toolType,
      riskLevel,
      riskReason: getRiskReason(toolType, text),
      target,
      checked: riskLevel !== 'high',              // 高风险步骤默认取消勾选
      status: 'waiting',
    };
  });
}
```

> **降级策略**：解析失败（Claude 未用编号格式）时，保留 `rawPlanText` 原始文本，整体作为一个
> `Unknown` 步骤显示，用户可通过「在编辑器中调整」手动整理后重新解析。

---

#### 3.4.3 风险等级判定规则

| 工具分类 | 关键词/模式 | 风险等级 | 颜色 | 原因说明 |
|---------|------------|---------|------|---------|
| Read / Grep / Glob / LS | Read、Analyze、Search、List | ● 低 | `--success-color` 绿 | 只读，无副作用 |
| TodoRead / WebSearch | TodoRead、search the web | ● 低 | 绿 | 只读外部资源 |
| Write（新建文件）| Create、Generate、Write new | ⚠ 中 | `--warning-color` 橙 | 创建新文件，可回滚 |
| Edit（修改已有文件）| Modify、Edit、Update、Refactor | ⚠ 中 | 橙 | 修改已有代码，可 diff 对比 |
| Bash / Shell 命令 | Run、Execute、Install、npm、pip | 🔴 高 | `--error-color` 红 | 任意副作用，不可预知 |
| 删除文件 | Delete、Remove file | 🔴 高 | 红 | 数据丢失风险 |
| 网络/API 调用 | Call API、HTTP、fetch、curl | 🔴 高 | 红 | 外部副作用 |

**高风险步骤额外说明**（`riskReason` 字段内容）

| 场景 | riskReason 文本 |
|------|----------------|
| Bash 命令 | "Shell 命令将在当前工作区执行，可能修改文件系统或安装依赖" |
| 删除操作 | "文件删除操作不可撤销，请确认目标路径正确" |
| npm/pip install | "将修改 node_modules / site-packages，影响项目依赖" |
| API 调用 | "将向外部服务发送请求，可能产生费用或副作用" |

---

#### 3.4.4 ReviewablePlanStep 类型规格

现有 `PlanStep`（`src/types/index.ts`）**不扩展**（避免破坏 TaskTimeline），新增独立类型：

```typescript
// src/types/index.ts 追加

export type PlanRiskLevel = 'low' | 'medium' | 'high';
export type PlanStepStatus = 'waiting' | 'running' | 'done' | 'skipped' | 'error';

export interface ReviewablePlanStep {
  id: string;                    // "plan-step-{index}"
  index: number;                 // 显示序号，从 1 开始
  rawText: string;               // Claude 原始描述文字
  toolType: string;              // 推断工具类型（Read/Edit/Bash/Write/Unknown）
  riskLevel: PlanRiskLevel;      // 风险等级
  riskReason?: string;           // 高风险时的详细说明
  target?: string;               // 文件路径或命令摘要（用于显示摘要行）
  checked: boolean;              // 用户是否勾选（false = 将被跳过）
  status: PlanStepStatus;        // 执行状态（审查阶段全为 'waiting'）
  // 执行阶段填入
  toolCallId?: string;           // 对应 ToolCall.id（执行后回填）
  error?: string;                // 失败时的错误信息
}
```

---

#### 3.4.5 完整线框图

**[A] 计划生成中（generating_plan）**

```
┌─ 计划审查 ── [🔴 Plan Mode: ON] ──────────────────────────────────┐
│                                                                   │
│  ⟳  Claude 正在生成执行计划…                                      │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ 1. Read `src/auth/login.ts` to analyze…                  │    │
│  │ 2. Modify `src/auth/login.ts` to extract…        ← 流式 │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [取消生成]                                                       │
└───────────────────────────────────────────────────────────────────┘
```

**[B] 计划就绪（plan_ready）—— 主审查视图**

```
┌─ 计划审查 ── [🔴 Plan Mode: ON] ──────────────────────────────────┐
│  全选 ☑  [全选]  [取消高风险]         风险汇总: ●3  ⚠1  🔴1      │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─ 步骤 1 / 5  ● 低风险 ────────────────────────────────────┐   │
│  │ ☑  Read · src/auth/login.ts                               │   │
│  │    分析现有 JWT 逻辑                                        │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─ 步骤 2 / 5  ⚠ 中风险 ───────────────────────────────────┐   │
│  │ ☑  Edit · src/auth/login.ts                               │   │
│  │    提取 AuthService class（~+60 -15 行）                   │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─ 步骤 3 / 5  🔴 高风险 ──────────────────────────────────┐   │
│  │ ☐  Bash · npm test                ← 高风险默认不勾选       │   │
│  │    ⚠ Shell 命令将在当前工作区执行，可能修改文件系统        │   │
│  │    [▸ 展开风险详情]                                        │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─ 步骤 4 / 5  ⚠ 中风险 ───────────────────────────────────┐   │
│  │ ☑  Edit · src/auth/middleware.ts                          │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─ 步骤 5 / 5  ● 低风险 ────────────────────────────────────┐   │
│  │ ☑  Write · src/auth/auth.service.test.ts（新文件）        │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│  ✏ [在编辑器中调整计划]  [取消计划]  [✅ 确认执行选中步骤 (4/5)] │
└───────────────────────────────────────────────────────────────────┘
```

**步骤卡片展开态（点击后）**

```
  ┌─ 步骤 3 / 5  🔴 高风险 ──────────────────────────────────┐
  │ ☐  Bash · npm test                                        │
  │    ⚠ Shell 命令将在当前工作区执行，可能修改文件系统        │
  │    ─────────────────────────────────────────────────      │
  │    完整命令：npm test                                      │
  │    执行目录：/workspace/project                            │
  │    推断影响：修改 node_modules，写入 coverage/ 报告        │
  │    建议：若只想验证代码逻辑，可暂时跳过此步骤              │
  │    [▾ 收起详情]              [☑ 勾选此步骤并了解风险]      │
  └───────────────────────────────────────────────────────────┘
```

**[C] 执行中（executing）—— 计划进度视图**

```
┌─ 计划执行中 ── [🔴 Plan Mode: ON] ────────────────────────────────┐
│  进度 ████████████░░░░  3 / 4 步骤完成                           │
│                                                                   │
│  ✓  步骤 1  Read · src/auth/login.ts              完成 0.3s      │
│  ✓  步骤 2  Edit · src/auth/login.ts              完成 2.1s      │
│  ⟳  步骤 4  Edit · src/auth/middleware.ts         执行中…        │
│  ○  步骤 5  Write · src/auth/auth.service.test.ts 等待           │
│  ─  步骤 3  Bash · npm test                       [已跳过]       │
│                                                                   │
│  [中断执行]                                                       │
└───────────────────────────────────────────────────────────────────┘
```

---

#### 3.4.6 步骤跳过与限制执行协议

**挑战**：Claude Code CLI Plan Mode 下，`y` 确认后 Claude 会按自己理解执行，无法在 API 层面
指定"只执行第 1、2、4、5 步"。GUI 必须用**消息注入**方式告知 Claude 被跳过的步骤。

**协议设计**（用户点击「确认执行选中步骤」时）

```typescript
function buildSkipMessage(
  parsedSteps: ReviewablePlanStep[],
  checkedIds: string[]
): string {
  const skipped = parsedSteps.filter(s => !checkedIds.includes(s.id));

  if (skipped.length === 0) return '';  // 全部执行，无需注入

  const skipLines = skipped
    .map(s => `- Step ${s.index}: ${s.rawText}`)
    .join('\n');

  return (
    `[GUI INSTRUCTION] Please execute the plan, but SKIP the following steps:\n` +
    skipLines +
    `\n\nFor skipped steps, treat them as if they were completed successfully ` +
    `and continue with the remaining steps.`
  );
}
```

**注入时序**

```
用户点击「确认执行选中步骤」
  → 1. 若无跳过步骤：直接发送空确认（或 'y'）
  → 2. 若有跳过步骤：
       先注入 [GUI INSTRUCTION] 消息
       → 然后发送确认
       → Claude 收到后按指令跳过目标步骤
```

**UI 状态映射**

| ReviewablePlanStep.checked | 执行后 status | TaskTimeline 显示 |
|---------------------------|-------------|-----------------|
| `true` | `running` → `done` / `error` | 正常显示工具调用行 |
| `false` | `skipped`（直接设置，不等 Claude）| 灰色划线行 `─ 已跳过` |

---

#### 3.4.7 快捷操作栏规格

审查视图顶部操作栏：

| 按钮 | 行为 | 条件 |
|------|------|------|
| 全选 ☑ | 所有步骤勾选 | 始终显示 |
| 取消高风险 | 取消所有 `riskLevel === 'high'` 步骤 | 有高风险步骤时可点 |
| 全选 ← 重置 | 恢复初始状态（高风险默认取消勾选）| 始终显示 |

底部操作栏：

| 按钮 | 行为 | 注意 |
|------|------|------|
| ✏ 在编辑器中调整计划 | 弹出 `EditPlanModal`，内含 textarea 预填 `rawPlanText` | 保存后重新解析（见 3.4.8）|
| 取消计划 | 发送 "Please cancel the plan."，会话回 idle | 确认弹窗防误触 |
| ✅ 确认执行选中步骤 (N/M) | 注入跳过消息（见 3.4.6）+ 确认 | 至少 1 个步骤勾选才可点 |

---

#### 3.4.8 「在编辑器中调整计划」实现方案

**目的**：用户看到计划后想删除某步骤、合并步骤、或修改命令，不用等 Claude 重新生成。

**交互流程**

```
点击「在编辑器中调整计划」
  → 弹出 EditPlanModal（全宽，高度 60vh）
  → textarea 内预填 rawPlanText（Claude 原始 Markdown）
  → 用户直接编辑文字
  → [保存并重新解析]
       → 运行 parsePlanSteps(editedText)
       → 替换 parsedSteps
       → 关闭 Modal，回到 plan_ready 审查视图（步骤列表已更新）
  → [取消]：关闭 Modal，保留原计划
```

**EditPlanModal 线框图**

```
┌─ 调整执行计划 ─────────────────────────────────────────────────────┐
│  提示：修改下方计划文本，保存后 GUI 将重新解析步骤列表。            │
│  每行编号列表条目（"1. " / "2. " 开头）会被解析为独立步骤。        │
├─────────────────────────────────────────────────────────────────── │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ 1. Read `src/auth/login.ts` to analyze the existing JWT      │ │
│  │ 2. Modify `src/auth/login.ts` to extract an `AuthService`    │ │
│  │ 3. Update `src/auth/middleware.ts` to reference AuthService   │ │
│  │ 4. Generate test cases in `src/auth/auth.service.test.ts`    │ │
│  │                                            ← 用户删掉了步骤3  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  [取消]                          [保存并重新解析（4 步骤）]        │
└────────────────────────────────────────────────────────────────────┘
```

> **注意**：EditPlanModal 仅修改 GUI 解析的步骤列表，Claude 内部对计划的理解不变。注入的
> `[GUI INSTRUCTION]` 跳过消息会在「确认执行」时根据**修改后**的勾选状态生成，实现协调一致。

---

### 3.5 Hooks 可视化配置器

> **实现状态**：`src/components/HooksPanel.tsx` 已实现完整 CRUD + 5 种 Handler 类型编辑器 +
> 4 个预设模板 + JSON 预览 + 持久化到 `~/.claude/settings.json`。本节补充数据模型规格、
> 退出码语义、环境变量注入和测试运行器设计（尚未实现）。

#### 3.5.1 数据模型与存储格式

**存储位置**：`~/.claude/settings.json` → 通过 `loadCliConfig()` / `saveCliConfig()` 读写

**顶层结构**

```typescript
// HooksPanel 内部类型（与 Claude Code 的 settings.json hooks 字段一一对应）

interface HookHandler {
  type: 'command' | 'http' | 'mcp_tool' | 'prompt' | 'agent';
  // command
  command?: string;        // Shell 命令，支持 $ENV_VAR 插值
  async?: boolean;         // true = 不阻塞 Claude 继续执行
  shell?: 'bash' | 'powershell';
  // http
  url?: string;            // HTTP POST 目标
  headers?: Record<string, string>;
  allowedEnvVars?: string[];  // header 值中允许插值的环境变量白名单
  // mcp_tool
  server?: string;         // MCP 服务器名
  tool?: string;           // 工具名
  input?: Record<string, unknown>; // 支持 ${tool_input.file_path} 占位符
  // prompt / agent
  prompt?: string;
  model?: string;
  // 通用
  if?: string;             // 条件过滤表达式，见 3.5.4
  timeout?: number;        // 超时（毫秒）
  statusMessage?: string;  // Claude 等待时显示的状态消息
}

interface HookMatcherGroup {
  matcher?: string;        // glob 或工具名正则，见 3.5.4
  hooks: HookHandler[];    // 同一 matcher 下的多个 handler 按顺序执行
}

type HooksConfig = Record<string, HookMatcherGroup[]>;
// key = Hook 事件名（如 "PreToolUse"、"PostToolUse"）
```

**settings.json 示例片段**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/lint.sh", "async": true }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "if": "Bash(rm -rf *)", "command": "exit 2" }
        ]
      }
    ]
  }
}
```

---

#### 3.5.2 Hook 事件分类与触发时机

| 分组 | 事件名 | 触发时机 | 常见用途 |
|------|--------|---------|---------|
| **工具调用** | `PreToolUse` | 工具调用前（可阻断）| 安全检查、审计日志 |
| | `PostToolUse` | 工具调用成功后 | lint、格式化、通知 |
| | `PostToolUseFailure` | 工具调用失败后 | 错误上报、重试触发 |
| | `PostToolBatch` | 一批工具调用全部完成后 | 批处理后清理 |
| | `PermissionRequest` | 权限审批请求时 | 自动化白名单处理 |
| | `PermissionDenied` | 权限被拒绝后 | 拒绝原因记录 |
| **会话生命周期** | `SessionStart` | 会话初始化时 | 注入上下文（git branch / env）|
| | `SessionEnd` | 会话结束时 | 会话摘要上报 |
| | `Setup` | Claude Code 进程启动时 | 环境检查 |
| **用户交互** | `UserPromptSubmit` | 用户提交消息时 | 消息预处理、敏感词过滤 |
| | `UserPromptExpansion` | Prompt 模板展开时 | 变量注入 |
| | `Stop` | Claude 准备结束前 | 任务完成前置校验 |
| | `StopFailure` | 结束失败时 | 失败通知 |
| **文件与配置** | `FileChanged` | 工作区文件变更时 | 同步、热重载触发 |
| | `CwdChanged` | 工作目录切换时 | 重载上下文 |
| | `ConfigChange` | settings.json 变更时 | 配置同步 |
| | `InstructionsLoaded` | CLAUDE.md 加载时 | 指令校验 |
| **Worktree** | `WorktreeCreate` / `Remove` | Git Worktree 创建/删除时 | CI 触发、通知 |
| **子代理** | `SubagentStart` | 子代理启动时 | 日志、资源分配 |
| | `SubagentStop` | 子代理停止时 | 结果收集、清理 |
| | `TaskCreated` | Agent Teams 创建任务时 | 任务追踪 |
| | `TaskCompleted` | 任务完成时 | 结果汇总 |
| | `TeammateIdle` | 队友空闲等待时 | 动态任务分配 |
| **其他** | `PreCompact` / `PostCompact` | 上下文压缩前后 | 压缩前存档 |
| | `Notification` | Claude 触发通知时 | 桌面通知集成 |
| | `Elicitation` | Claude 请求用户输入时 | 自动化响应 |

---

#### 3.5.3 Handler 类型规格（5 种）

**① command — Shell 命令**（最常用）

| 字段 | 说明 | 示例 |
|------|------|------|
| `command` | 完整 Shell 命令，支持 `$VAR` 插值 | `npx eslint --fix $CLAUDE_FILE_PATHS` |
| `async` | `true` = 后台执行，不等待结果 | 发送通知、上报日志 |
| `shell` | `bash`（默认）/ `powershell`（Windows）| Windows CI 环境 |

**② http — HTTP 请求**（自动 POST JSON）

| 字段 | 说明 |
|------|------|
| `url` | POST 目标，Claude Code 会序列化 Hook 上下文为 JSON body |
| `headers` | 自定义请求头（如 Authorization）|
| `allowedEnvVars` | header 值中允许使用的环境变量白名单（安全限制）|

**③ mcp_tool — MCP 工具调用**

| 字段 | 说明 |
|------|------|
| `server` | MCP 服务器名（与 mcpServers 配置中的 key 对应）|
| `tool` | 工具名 |
| `input` | 工具参数，支持 `${tool_input.file_path}` 等占位符 |

**④ prompt — LLM 提示（让 Claude 自身处理）**

| 字段 | 说明 |
|------|------|
| `prompt` | 发给 Claude 的提示词，支持 `$ARGUMENTS` 变量 |
| `model` | 可选覆盖模型（默认使用当前会话模型）|

> 适用场景：Stop 事件前做任务完整性检查，让 Claude 自己判断是否应该继续。

**⑤ agent — 子代理调用**（实验性）

| 字段 | 说明 |
|------|------|
| `prompt` | 传递给子代理的指令 |
| `model` | 子代理使用的模型 |

---

#### 3.5.4 Matcher 语法与条件过滤（if 字段）

**matcher 字段**：过滤 Hook 作用于哪些触发来源

| 语法 | 含义 | 示例 |
|------|------|------|
| `*` | 匹配所有工具 | 全量监控 |
| `Bash` | 精确匹配工具名 | 仅 Bash 工具 |
| `Write\|Edit` | 正则 OR，匹配多个工具名 | 文件修改类工具 |
| `mcp__.*` | 正则前缀，匹配所有 MCP 工具 | 所有 MCP 工具 |
| `startup` | SessionStart 的 matcher（会话类型）| 新启动会话 |
| `resume` | 恢复会话的 matcher | 恢复上次会话 |

**if 字段**：在 matcher 之后进一步细过滤

```
语法：ToolName(模式字符串)
示例：Bash(rm -rf *)        ← 匹配包含 "rm -rf " 的 Bash 命令
示例：Bash(npm install*)    ← 匹配 npm install 类命令
示例：Write(*.test.ts)      ← 匹配写入 .test.ts 文件的操作
```

**matcher 优先级（多 group 时）**：所有 matcher 均匹配的 group 都会执行，不互斥。

---

#### 3.5.5 退出码语义（控制流影响）

Hook 的 `command` / `http` 执行结果通过退出码影响 Claude 的行为：

| 退出码 | 含义 | 触发场景 |
|--------|------|---------|
| `0` | 成功，Claude 继续正常执行 | 所有正常情况 |
| `2` | 阻断：取消/拒绝当前操作 | `PreToolUse` 返回 2 → Claude 放弃此次工具调用 |
| 其他非零 | 错误，Claude 记录警告但继续 | 日志记录错误 |

**常见用途**

```bash
# PreToolUse Hook：阻断危险命令
if echo "$CLAUDE_BASH_COMMAND" | grep -q "rm -rf"; then
  exit 2  # 阻断执行，Claude 收到 "permission denied" 响应
fi
exit 0    # 允许执行
```

```bash
# Stop Hook：任务完成前置检查（exit 2 = 让 Claude 继续工作）
npm test 2>&1 | grep -q "PASS" && exit 0 || exit 2
```

**`async: true` 时**：退出码被忽略，Claude 不等待结果，直接继续执行。

---

#### 3.5.6 完整界面线框图（当前 v3.0 实现）

```
┌─ Hooks ──── [4个] ────── [全部启用●] [预设] [{}JSON] [💾保存] ──┐
├───────────────────────────────────────────────────────────────── │
│ ┌── 事件列表（左栏 180px）──┐  ┌── 编辑区（右侧）──────────────┐│
│ │ 工具调用                  │  │                               ││
│ │  ▶ PreToolUse    [1]     │  │  PostToolUse 的 Groups (2个) ││
│ │  ● PostToolUse   [2] ←  │  │                               ││
│ │    PostToolUseFailure    │  │ ┌─ Group #1  matcher: Write|Edit ─┐ ││
│ │    PostToolBatch         │  │ │ ┌─ Handler: command ─ 异步 ──┐ ││ ││
│ │    PermissionRequest     │  │ │ │ npx eslint --fix $FILE    │ ││ ││
│ │    PermissionDenied      │  │ │ └──────── [展开] [删除] ─────┘ ││ ││
│ │ 会话生命周期              │  │ │ [+ 添加 Handler]             │ ││
│ │  ▶ SessionStart  [1]    │  │ └──────────────────── [删除组] ──┘ ││
│ │    SessionEnd            │  │                               ││
│ │    Setup                 │  │ ┌─ Group #2  matcher: *  ────────┐ ││
│ │ 用户交互                  │  │ │ ┌─ Handler: http ────────────┐ ││ ││
│ │    UserPromptSubmit      │  │ │ │ https://hooks.slack.com/.. │ ││ ││
│ │    Stop                  │  │ │ └──────── [展开] [删除] ─────┘ ││ ││
│ │ ...（共 7 分组）          │  │ └──────────────────── [删除组] ──┘ ││
│ └───────────────────────── │  │                               ││
│                             │  │ [+ 添加 Group（新 matcher）]  ││
│                             │  └────────────────────────────── ││
└─────────────────────────────────────────────────────────────────┘
```

**Handler 展开编辑器（command 类型）**

```
┌─ Handler: Shell 命令 ────────────────────────────────────── [删除]─┐
│ 类型: [command ▾]                                                  │
│ 命令: ["$CLAUDE_PROJECT_DIR"/.claude/hooks/lint.sh              ]  │
│ ☑ 异步执行（不阻塞 Claude）                                        │
│ Shell: [bash（默认）▾]                                             │
│ 条件过滤(if): [Bash(rm -rf *)                                   ]  │
│ 超时(ms): [30000                                                ]  │
│ 状态消息: [正在检查安全规则...                                    ]  │
└────────────────────────────────────────────────────────────────────┘
```

---

#### 3.5.7 测试运行器规格（待实现）

当前「🧪 测试所有 Hooks」按钮在设计中存在但代码中尚未实现，规格如下：

**触发方式**：顶部工具栏增加 `[🧪 测试]` 按钮

**测试流程**

```
点击「测试」
  → 弹出 TestRunnerModal
  → 选择要测试的事件（多选）
  → 为每个事件构造模拟上下文（见下方）
  → 依次执行 Hook 命令（非 async 模式）
  → 实时显示执行日志（stdout/stderr）
  → 显示退出码和耗时
```

**模拟上下文构造**（各事件的默认测试数据）

| 事件 | 模拟注入的环境变量 |
|------|-----------------|
| `PreToolUse` / `PostToolUse` | `CLAUDE_TOOL_NAME=Bash`、`CLAUDE_BASH_COMMAND=echo test` |
| `SessionStart` | `CLAUDE_SESSION_ID=test-session-001` |
| `FileChanged` | `CLAUDE_FILE_PATHS=/workspace/test.ts` |

**TestRunnerModal 线框图**

```
┌─ Hook 测试运行器 ──────────────────────────────────────────────────┐
│ 事件：[PostToolUse ▾]   Matcher：[Write|Edit          ]           │
│ 构造参数：                                                          │
│   CLAUDE_TOOL_NAME:  [Bash                         ]              │
│   CLAUDE_FILE_PATHS: [/workspace/src/auth/login.ts  ]             │
│                                                      [▶ 运行]     │
├──────────────────────────────────────────────────────────────────── │
│  ✅ Hook #1 (command): 完成 [0.8s]  退出码: 0                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ $ npx eslint --fix /workspace/src/auth/login.ts              │ │
│  │ /workspace/src/auth/login.ts                                 │ │
│  │   2:1   warning  'import' is not sorted  import/order        │ │
│  │ ✔ 1 problem fixed                                            │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

---

#### 3.5.8 环境变量注入（Hook 命令内可用变量）

Claude Code 在执行 Hook 时会向 Shell 环境注入以下变量，可在 `command` 中直接使用：

| 变量名 | 含义 | 可用事件 |
|--------|------|---------|
| `$CLAUDE_PROJECT_DIR` | 当前工作目录（`cwd`）| 所有 |
| `$CLAUDE_SESSION_ID` | 当前会话 ID | 所有 |
| `$CLAUDE_TOOL_NAME` | 触发 Hook 的工具名 | PreToolUse / PostToolUse |
| `$CLAUDE_FILE_PATHS` | 工具操作的文件路径（空格分隔）| PostToolUse（Write/Edit）|
| `$CLAUDE_BASH_COMMAND` | Bash 工具将执行的命令 | PreToolUse（matcher=Bash）|
| `$ARGUMENTS` | 传给 prompt/agent handler 的参数 | prompt / agent |

**GUI 界面辅助**：  
- 命令输入框旁显示 `[$] 变量参考` 下拉，列出所有可用变量  
- 点击变量名自动插入到光标位置

---

### 3.6 Worktree 并行会话看板

> **实现状态**：`WorktreePanel.tsx` 已实现完整 CRUD（`gitWorktreeList/Add/Remove/Prune`）。
> 本节补充 Worktree ↔ Tab 对应关系、切换语义和合并对比视图规格。

#### 3.6.1 数据模型与 Tab 对应关系

**`WorktreeInfo`（来自 `electron.d.ts`）**

```typescript
interface WorktreeInfo {
  path: string;       // Worktree 所在绝对路径（作为该 Tab 的 workingDirectory）
  head: string;       // 当前 HEAD commit hash
  branch: string;     // 分支名（detached 时为 "(HEAD detached at {hash})"）
  isMain: boolean;    // 是否为主 Worktree（主仓库）
  isDetached: boolean;
  isLocked: boolean;  // 被锁定的 Worktree（不可删除）
}
```

**Worktree ↔ Tab 映射规则**

| 操作 | 行为 |
|------|------|
| 点击「切换到此会话」| `setSession({ workingDirectory: wt.path })`，Tab 工作目录切换 |
| 点击「+ 新建并行分支」| `gitWorktreeAdd()` 创建新 Worktree，自动在新 Tab 中打开 |
| 关闭 Tab | 不自动删除 Worktree，Worktree 继续存在（避免误删）|
| 删除 Worktree | 需明确确认（`force` 选项），删除前校验 Tab 是否仍在使用该路径 |

#### 3.6.2 完整线框图

```
┌─ Worktrees — 并行开发 ────────────────────────────────────────────┐
│  [+ 新建并行分支]   [🔄 刷新]  [✂ 清理已删除]                     │
│                                                                   │
│  ┌── 🟢 main (当前主仓库) ─────────────────────────────────────┐  │
│  │  📁 /workspace/my-app    分支：main    HEAD: a3f91c         │  │
│  │  当前 Tab 工作目录 ←                                        │  │
│  │  [查看 Diff]  [查看 Git 日志]                               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌── 🔵 feat/auth-v2 ─────────────────────────────────────────┐  │
│  │  📁 /workspace/my-app-auth-v2    分支：feat/auth-v2         │  │
│  │  HEAD: b72d48    锁定：否                                   │  │
│  │  [切换到此工作目录]  [查看 Diff]  [删除…]                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌── ⚠ legacy-cleanup (锁定) ──────────────────────────────────┐  │
│  │  📁 /workspace/my-app-legacy    分支：legacy                 │  │
│  │  🔒 此 Worktree 已锁定，不可删除                             │  │
│  │  [切换]  [查看 Diff]                                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  [🔀 并排对比两个 Worktree 的变更]                                │
└───────────────────────────────────────────────────────────────────┘
```

#### 3.6.3 新建 Worktree 表单规格

**表单字段**（展开后显示）

| 字段 | 类型 | 说明 |
|------|------|------|
| Worktree 路径 | 文本 + 浏览按钮 | 建议默认：`{parentDir}/{repoName}-{branchName}` |
| 分支名 | 文本 | 若勾选「创建新分支」则为新分支名，否则为已有分支名 |
| ☑ 创建新分支 | 复选框 | 勾选时出现「基于」字段 |
| 基于（commitish）| 文本 | 默认 `HEAD`，可填 commit hash / 已有分支名 |

**校验规则**：路径不能已存在（`isMain` worktree 的子目录除外）；分支名不含空格。

**调用链**：`gitWorktreeAdd(cwd, path, branch, createBranch, baseBranch?)`

#### 3.6.4 Worktree 对比视图规格（待实现）

**触发**：底部「并排对比两个 Worktree 的变更」按钮

**选择器线框图**

```
┌─ 选择对比的两个 Worktree ──────────────────────────────────────────┐
│  左侧：[main                ▾]  右侧：[feat/auth-v2           ▾]   │
│                                                          [开始对比] │
└────────────────────────────────────────────────────────────────────┘
```

**对比视图布局**：左右两栏各自渲染 `DiffView`，使用各 Worktree 的 `gitDiff()` 结果；
公共文件排在前面，仅左侧 / 仅右侧有改动的文件分组显示。

---

### 3.7 插件市场

> **实现状态**：`PluginPanel.tsx` 已实现 3 个 Tab（已安装/发现/预设），以及
> `pluginList / pluginToggle / pluginInstall / pluginUninstall` 四个 IPC 接口。
> 本节补充 Plugin 类型规范、安装机制说明和错误处理规格。

#### 3.7.1 数据模型与安装机制

**`InstalledPlugin`（来自 `electron.d.ts`）**

```typescript
interface InstalledPlugin {
  key: string;         // 唯一标识（如 "thedotmack/claude-mem"）
  name: string;        // 显示名
  description: string;
  enabled: boolean;    // 是否已启用（toggle 即时生效）
  version?: string;
}
```

**安装机制**：通过 `claude install {pluginSpec}` CLI 子命令执行（`pluginInstall(spec)`），
安装过程输出到 `installLog` 字符串（实时追加）。安装完成后调用 `loadPlugins()` 刷新列表。

**预设插件清单**（代码中已定义）

| spec | 名称 | 功能 |
|------|------|------|
| `thedotmack/claude-mem` | Claude-Mem | 跨会话持久化记忆 |
| `anthropic/typescript-lsp` | TypeScript LSP | TS 语言服务器 |
| `anthropic/github` | GitHub | Issues/PR 集成 |
| `anthropic/commit-commands` | Commit Commands | 智能 Git 提交 |
| `anthropic/sequential-thinking` | Sequential Thinking | 结构化多步推理 |

#### 3.7.2 完整线框图（3 Tab 布局）

```
┌─ 插件市场 ─────────────────────────────────────────────────────────┐
│  [已安装(3)] [发现] [预设]                                         │
├─────────────────────────────────────────────────────────────────── │
│  [已安装 Tab]                                                      │
│                                                                    │
│  ┌── claude-mem ──────────────────── [启用●] ───────────────────┐ │
│  │  跨会话持久化记忆    v1.2.3    thedotmack/claude-mem         │ │
│  │                                    [卸载]                    │ │
│  └────────────────────────────────────────────────────────────── │
│                                                                    │
│  ┌── TypeScript LSP ───────────────── [启用●] ──────────────────┐ │
│  │  TypeScript 语言服务器支持    anthropic/typescript-lsp       │ │
│  │  ⟳ 切换中…                         [卸载]                    │ │
│  └────────────────────────────────────────────────────────────── │
│                                                                    │
│  ─────────────────────────────────────────────────────────────── │
│  [发现 Tab]                                                        │
│                                                                    │
│  从 GitHub 或 npm 安装任意插件：                                   │
│  [user/repo 或 npm 包名                          ]  [安装]         │
│                                                                    │
│  ┌── 安装日志 ─────────────────────────────────────────────────┐  │
│  │ $ claude install anthropic/github                           │  │
│  │ Cloning repository...                                        │  │
│  │ Installing dependencies...                                   │  │
│  │ ✅ Plugin installed successfully                              │  │
│  └──────────────────────────────────────────────────────────── ─┘  │
│                                                                    │
│  ─────────────────────────────────────────────────────────────── │
│  [预设 Tab]                                                        │
│                                                                    │
│  Claude Code 官方及社区精选插件，一键安装：                        │
│                                                                    │
│  ┌── 🧠 Claude-Mem ────────────────────────────────── [安装] ──┐  │
│  │  跨会话持久化记忆，让 Claude 记住你的偏好和上下文            │  │
│  └──────────────────────────────────────────────────────────── │  │
│  [更多预设条目…]                                                   │
└────────────────────────────────────────────────────────────────────┘
```

#### 3.7.3 安装/卸载流程规格

**安装（Discover Tab）**：
1. 用户输入 `user/repo` 或 npm 包名 → `pluginInstall(spec)` → 实时追加到 `installLog`
2. 完成后自动刷新 `loadPlugins()`，新插件出现在「已安装」Tab
3. 错误时展示红色错误文字（不弹窗，保持在日志区）

**启用/禁用**：`pluginToggle(key, !enabled)` → 即时反映 UI，无需重启应用

**卸载**：`pluginUninstall(spec)` → 输出日志 → 刷新列表；已禁用的插件也可直接卸载

---

### 3.8 Agent Teams 视图（实验性，需启用）

> 对应 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`，在 AgentsView 中新增「团队」Tab

```
┌─ Agents ──── [Worktrees] [Subagent 定义] [🧪 Agent Teams] ─────────┐
│                                                                     │
│  ⚠ Agent Teams 处于实验阶段，需启用环境变量                           │
│  CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1             [前往设置启用]  │
│                                                                     │
│  ─ 当前团队：auth-refactor ─────────────────────────────────────── │
│                                                                     │
│  👑 Lead（主会话）                                [发消息给 Lead]   │
│  ┌─ ✽ 协调工作 ── 正在等待 Teammate 汇报 ────────────────────────┐  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  🤝 Teammates（3 个）                                               │
│  ┌─ 🔵 security-reviewer ── 审查 src/auth/ ────────── 活跃 ──────┐  │
│  │  [发消息]  [查看日志]  [关闭]                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌─ 🟢 test-writer ── 结果：8 个测试用例 ────────── 等待任务 ─────┐  │
│  │  [发消息]  [查看日志]                                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌─ 🟣 performance-analyst ── 已完成汇报 ─────────── 完成 ────────┐  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  📋 共享任务列表                                  [Ctrl+T 显示/隐藏] │
│  ┌─ ☑ 审查认证模块安全性     [security-reviewer]  ✅ ─────────────┐  │
│  ├─ ☑ 编写测试用例           [test-writer]        ✅ ─────────────  │
│  ├─ ○ 分析性能瓶颈           [performance-analyst] 进行中 ─────────  │
│  └─ ○ 生成最终报告           [未分配]              待领取 ──────── │  │
│                                                                     │
│  [清理团队]  [+ 添加 Teammate]  [查看团队日志]                      │
│                                                                     │
│  ─ 无活跃团队时 ──────────────────────────────────────────────── │
│  [让 Claude 创建团队…]  [如何使用 Agent Teams →]                    │
└─────────────────────────────────────────────────────────────────────┘
```

**团队显示模式对照：**

| 模式 | CLI 实现 | GUI 等价 |
|------|---------|---------|
| In-process | `Shift+Down` 切换 Teammate | 点击 Teammate 卡片→进入其 Dispatch 视图 |
| 发消息给 Teammate | `Shift+Down` → 输入 | 卡片内「发消息」→内联输入框 |
| 批准 Teammate 计划 | Lead 自动决策 | 介入队列出现「计划审批请求」卡片 |

#### 3.8.1 实验性功能启用机制

**启用条件**：设置面板「实验性功能」区块中开关 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`，
写入 `~/.claude/settings.json` 的 `env` 字段，下次会话启动时生效。

**未启用时的视图状态**：「🧪 Agent Teams」Tab 可见但显示提醒横幅 + 灰色禁用状态，
点击「前往设置启用」跳转到 Settings 面板的实验功能区。

#### 3.8.2 团队数据模型（前端状态）

```typescript
// 前端状态，来源：解析 Claude 消息流中的结构化 JSON
interface TeammateState {
  id: string;              // Subagent 名称（如 "security-reviewer"）
  displayName: string;
  status: 'active' | 'idle' | 'done' | 'error';
  currentTask?: string;    // 当前正在做什么
  lastMessage?: string;    // 最近一条汇报内容摘要
}

interface SharedTask {
  id: string;
  description: string;
  assignedTo?: string;     // TeammateState.id，空时为「未分配」
  status: 'pending' | 'in_progress' | 'done' | 'rejected';
  hookNote?: string;       // Hook 质量门控反馈
}

interface AgentTeamState {
  teamName?: string;
  teammates: TeammateState[];
  tasks: SharedTask[];
  leadStatus: string;      // Lead 当前状态文字
}
```

#### 3.8.3 Teammate 操作规格

| 操作 | 实现方式 |
|------|---------|
| 发消息给 Teammate | 注入 `[Send to {teammateName}]: {message}` 格式消息，Lead 转发 |
| 切换到 Teammate 视图 | 新建 Tab，`workingDirectory` 同主 Worktree，`agent` 设为 Teammate 名称 |
| 关闭 Teammate | 向 Lead 发送 "Please stop {teammateName} and clean up." |
| 添加 Teammate | 向 Lead 发送 "Please add {subagentName} to the team for task: {desc}." |

#### 3.8.4 Hooks 质量门控规格（TeammateIdle / TaskCreated / TaskCompleted）

**触发时机与退出码语义：**

| Hook 事件 | 触发时机 | exit 0 | exit 2（阻止） |
|-----------|---------|--------|--------------|
| `TeammateIdle` | Teammate 完成任务、等待下一个指令 | 继续等待 | 强制 Teammate 继续工作（通过 stderr 传递指令）|
| `TaskCreated` | 共享任务列表新增任务时 | 允许创建 | 拒绝任务（附带拒绝原因）|
| `TaskCompleted` | 任务状态变为 `done` | 接受完成 | 打回重做（附带反馈说明）|

**Hook 结果展示规则：**
- exit 2 的 stderr 内容显示在共享任务列表对应行的「备注」徽章（橙色 `⚑`），悬停展开全文
- Hook 阻止动作后，Teammate 卡片显示「被 Hook 拦截，等待重新激活」状态

**在 HooksPanel 中配置：**
```json
{
  "TeammateIdle": [
    {
      "matcher": { "teammate": "test-writer" },
      "hooks": [{ "type": "command", "command": "scripts/check-coverage.sh" }]
    }
  ]
}
```

---

### 3.9 Subagent 定义编辑器（完整字段覆盖）

> 对应 `/agents` 命令的 Library Tab，覆盖所有官方支持的 frontmatter 字段

```
┌─ Subagent 定义编辑器 ── code-reviewer ─────────────────────────────┐
│                                                                     │
│  基础信息                                                           │
│  名称（唯一标识）  [code-reviewer              ]  颜色 [🔵]        │
│  描述（Claude 用此决定何时委派）                                     │
│  [Expert code reviewer. Use immediately after code changes.     ]  │
│                                                                     │
│  ─ 模型与执行 ──────────────────────────────────────────────────── │
│  模型      [○ inherit  ● sonnet  ○ opus  ○ haiku  ○ 自定义 ID]     │
│  权限模式  [● default  ○ acceptEdits  ○ auto  ○ plan  ○ dontAsk]   │
│  最大轮次  [     —     ]  Effort  [inherit ▼]                       │
│                                                                     │
│  ─ 工具访问 ─────────────────────────────────────────────────────  │
│  允许工具  [☑ Read] [☑ Grep] [☑ Glob] [☑ Bash] [☐ Write] [☐ Edit] │
│            [☐ Agent(worker)] [+ 更多]                              │
│  禁止工具  [Write, Edit                              ]             │
│                                                                     │
│  ─ 高级配置 ─────────────────────────────────────────────────────  │
│  Skills 预加载   [☑ api-conventions] [☑ error-patterns] [+ 添加]   │
│  持久记忆        [● none  ○ user  ○ project  ○ local]              │
│  隔离模式        [● none  ○ worktree（独立 git worktree）]          │
│  后台运行        [☐ 始终作为后台任务运行]                            │
│  初始提示词      [（首次运行时自动提交的第一条消息）             ]    │
│                                                                     │
│  ─ Hooks（仅此 Subagent 生效）─────────────────────────────────── │
│  [+ 添加 PreToolUse Hook]  [+ 添加 PostToolUse Hook]               │
│                                                                     │
│  ─ MCP 服务器（作用域仅限此 Subagent）──────────────────────────── │
│  [+ 引用已配置的 MCP 服务器]  [+ 内联定义新 MCP 服务器]             │
│                                                                     │
│  System Prompt（Markdown 正文）：                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ You are a senior code reviewer...                          │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  [取消]  [📁 查看文件]  [🧪 测试]  [保存]                          │
└─────────────────────────────────────────────────────────────────────┘
```

**作用域选择（存储位置）：**

| 作用域 | 存储路径 | 适用场景 |
|------|---------|---------|
| 个人（跨项目）| `~/.claude/agents/` | 通用辅助 Agent |
| 项目（可提交）| `.claude/agents/` | 团队共用，纳入版本控制 |
| CLI 会话（临时）| `--agents` 参数传 JSON | 测试或自动化脚本 |

#### 3.9.1 存储 API 调用链

**读取列表**：`agentList()` → 返回 `Array<{ filename, name, model, description, prompt }>`

**保存**：`agentWrite(filename, { name, model, description, prompt })` → 写入对应路径的 `.md` 文件

**删除**：`agentDelete(filename)` → 删除文件，刷新列表

> `filename` 格式：`{name}.md`（全小写，空格转 `-`）

#### 3.9.2 frontmatter 字段 → UI 控件完整映射

| frontmatter 字段 | UI 控件 | 类型 | 默认值 |
|-----------------|--------|------|--------|
| `name` | 文本输入 | string | 必填 |
| `description` | 多行文本 | string | 必填（Claude 用此决定何时委派）|
| `model` | 单选按钮组（sonnet/opus/haiku/自定义）| string | `inherit` |
| `permission_mode` | 单选按钮组 | string | `inherit` |
| `max_turns` | 数字输入（空 = 不限）| number \| null | null |
| `effort` | 下拉（inherit/low/medium/high）| string | `inherit` |
| `allowed_tools` | 工具多选复选框 | string[] | [] |
| `disallowed_tools` | 文本输入（逗号分隔）| string[] | [] |
| `skills` | Skills 多选选择器（从已有 Skills 中选）| string[] | [] |
| `memory_type` | 单选（none/user/project/local）| string | `none` |
| `isolation` | 单选（none/worktree）| string | `none` |
| `background` | 复选框 | boolean | false |
| `initial_prompt` | 文本输入（首次运行自动提交的消息）| string | '' |
| `hooks` | 内联 Hooks 编辑器（复用 HooksPanel 逻辑）| object | {} |
| `mcp_servers` | MCP 服务器引用（多选）| string[] | [] |
| Markdown 正文 | 多行 textarea（System Prompt）| string | '' |

#### 3.9.3 保存时 frontmatter 生成逻辑

```typescript
function buildAgentMarkdown(fields: SubagentFormFields): string {
  const fm: Record<string, unknown> = {};

  if (fields.model !== 'inherit') fm.model = fields.model;
  if (fields.permissionMode !== 'inherit') fm.permission_mode = fields.permissionMode;
  if (fields.maxTurns != null) fm.max_turns = fields.maxTurns;
  if (fields.effort !== 'inherit') fm.effort = fields.effort;
  if (fields.allowedTools.length) fm.allowed_tools = fields.allowedTools;
  if (fields.disallowedTools.length) fm.disallowed_tools = fields.disallowedTools;
  if (fields.skills.length) fm.skills = fields.skills;
  if (fields.memoryType !== 'none') fm.memory_type = fields.memoryType;
  if (fields.isolation !== 'none') fm.isolation = fields.isolation;
  if (fields.background) fm.background = true;
  if (fields.initialPrompt) fm.initial_prompt = fields.initialPrompt;

  const fmStr = Object.keys(fm).length
    ? `---\n${Object.entries(fm).map(([k, v]) =>
        `${k}: ${JSON.stringify(v)}`
      ).join('\n')}\n---\n\n`
    : '';

  return `${fmStr}# ${fields.name}\n\n${fields.description}\n\n${fields.systemPrompt}`;
}
```

#### 3.9.4 测试 Subagent 规格（「🧪 测试」按钮）

**测试流程**：启动一个独立会话，将 Subagent 作为 `agent` 参数传入，发送一条用户指定的测试消息，
观察 Subagent 的响应和工具调用行为。

```
点击「🧪 测试」
  → 弹出 TestSubagentModal
  → 输入框：「发送测试任务...」
  → [▶ 启动测试会话]
  → 新建临时 Tab，agent="{agentName}"，发送测试消息
  → 测试完成后 Tab 保持，用户可手动关闭
```

---

### 整体框架（1280px 标准宽度）

```
┌──────────────────────────────────────────────────────────────────────┐
│ TitleBar                                                             │
│ [🤖 Claude] [项目: my-app ▼]  [main ●] [feat/auth ○] [+ Worktree]  │
│                                [🔴Plan] [Sonnet ▼] [2.4k][$0.03]    │
│                                                        [⚡快速][●连接]│
├──────┬───────────────────────────────────┬───────────────────────────┤
│      │                                   │                           │
│  N   │         主工作区                   │      右侧辅助面板          │
│  a   │  （指挥中心 / 委派 / Agents /      │   （Diff / Plan / 介入 /  │
│  v   │    审查 / 产物 / 能力 / 监控）      │    Checkpoint / 上下文）  │
│  R   │                                   │                           │
│  a   │                                   │                           │
│  i   │                                   │                           │
│  l   │                                   │                           │
│      │                                   │                           │
├──────┴───────────────────────────────────┴───────────────────────────┤
│ StatusBar: [工作目录] [Git分支] [权限●] [Hooks:3] [内存:~/.claude] [?] │
└──────────────────────────────────────────────────────────────────────┘
```

### NavRail（7项，场景化分组）

```
┌──────┐
│  🏠  │  ← 指挥中心（默认）
│──────│  ── 执行 ──
│  ⚡  │  ← 委派（有进行中会话时显示活跃动画）
│  🤖  │  ← Agents（激活中 Agent 数量徽章）
│──────│  ── 控制 ──
│  ✅  │  ← 审查（待审查数量红点）
│  📦  │  ← 产物
│──────│  ── 配置 ──
│  🔧  │  ← 能力配置（聚合 Skills/Hooks/MCP/Plugins）
│  📊  │  ← 监控
│──────│
│  ⚙   │  ← 设置（置底）
└──────┘
```

**设计理由（从 F3/F4 推导）：**
- 7项替代原来的 12+ 项：认知负荷下降 40%+
- 执行类（委派/Agents）与控制类（审查/产物）分组，符合「分配 → 审查」的工作心智
- 配置类（能力/监控）放底部：低频操作，不占主视觉

---

## 五、TitleBar 全局状态设计

```
┌──────────────────────────────────────────────────────────────────┐
│ [🤖] [项目: my-app ▼]  │  [main ●] [feat/auth-v2 ○] [+ 新分支]  │
│                         │          ← Worktree Tabs →             │
│                                                [🔴 Plan Mode ON] │
│                                                [Sonnet 4.5 ▼]   │
│                                                [2.4k tokens]     │
│                                                [$0.03 今日]      │
│                                                [● 已连接]        │
└──────────────────────────────────────────────────────────────────┘
```

**Worktree Tabs 设计理由：**
- 参考 Chrome 标签页心智模型：最高频操作放最顶层
- 圆点状态指示（●=活跃, ○=空闲, ⚠=需介入, ⚫=完成）

**权限模式色彩语义：**
- 🔴 红色：Plan Mode（最安全，只读）
- 🟡 黄色：acceptEdits（文件变更自动接受，命令需确认）
- 🟢 绿色：auto（自动判断风险）
- 🟣 紫色：dontAsk（完全自主，高权限）

---

## 六、交互规范

### 6.1 权限确认弹层

```
┌─────────────────────────────────────────┐
│  ⚠️ Agent Beta 请求执行命令               │
│                                         │
│  $ rm -rf ./node_modules && npm install │
│                                         │
│  操作类型：🔴 Shell 命令（高风险）        │
│  工作目录：/project/my-app/fix/tests    │
│  触发工具：Bash                          │
│                                         │
│  [拒绝]  [本次允许]  [始终允许此类命令]   │
└─────────────────────────────────────────┘
```

### 6.2 Agent 工作中状态反馈

- **流式输出**：在委派日志区域逐字渲染，光标闪烁
- **工具调用卡片**：内嵌在日志流中，展示工具名 + 参数摘要 + 状态（执行中/✅/❌）
- **进度里程碑**：大任务自动识别进度节点，更新 Agent 卡片进度条
- **取消机制**：委派界面右下角 `[⏹ 停止 Agent]`，Escape 键触发

### 6.3 快捷键体系

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Enter` | 委派任务（主操作） |
| `Ctrl+P` | Plan Mode 切换 |
| `Ctrl+Tab` | 切换 Worktree |
| `Ctrl+Shift+C` | 快速 Checkpoint |
| `Ctrl+K` | 命令面板（搜索所有功能） |
| `Ctrl+/` | 斜杠命令（/skills, /checkpoint, /loop...） |
| `Escape` | 停止当前 Agent |
| `Ctrl+1~7` | NavRail 快速跳转 |

---

## 七、设计系统规范

### 7.1 色彩语义

```css
/* 风险等级（对应权限确认弹层） */
--risk-low:     #22c55e;  /* 绿 — 只读操作 */
--risk-medium:  #f59e0b;  /* 黄 — 文件修改 */
--risk-high:    #ef4444;  /* 红 — Shell 命令 / 删除 */

/* Agent 状态 */
--agent-active:  #3b82f6;  /* 蓝 — 执行中 */
--agent-waiting: #f59e0b;  /* 黄 — 等待审批 */
--agent-idle:    #6b7280;  /* 灰 — 空闲 */
--agent-done:    #22c55e;  /* 绿 — 完成 */
--agent-error:   #ef4444;  /* 红 — 失败 */

/* 权限模式 */
--mode-plan:        #ef4444;  /* 红 */
--mode-acceptEdits: #f59e0b;  /* 黄 */
--mode-auto:        #22c55e;  /* 绿 */
--mode-dontAsk:     #8b5cf6;  /* 紫 */
```

### 7.2 组件优先级矩阵

| 功能 | 设计价值 | 技术复杂度 | 优先级 | 状态 |
|------|----------|------------|--------|------|
| 指挥中心（Agent View 对齐）| ★★★★★ | ★★★☆☆ | P0 | 待开发 |
| Worktree Tab 切换（TitleBar）| ★★★★★ | ★★☆☆☆ | P0 | 待开发 |
| Plan Mode 审查视图 | ★★★★★ | ★★☆☆☆ | P0 | 待开发 |
| NavRail 场景化重组 | ★★★★☆ | ★☆☆☆☆ | P0 | 待开发 |
| 任务委派界面（结构化）| ★★★★☆ | ★★★☆☆ | P1 | 待开发 |
| Hooks 可视化配置器（含新事件）| ★★★★☆ | ★★★☆☆ | P1 | 已有基础 |
| 插件市场 | ★★★☆☆ | ★★★★☆ | P1 | 已有基础 |
| PR 集成视图 | ★★★★☆ | ★★★☆☆ | P1 | 已有基础 |
| 命令面板（Ctrl+K）| ★★★★☆ | ★★★☆☆ | P1 | 待开发 |
| Subagent 完整字段编辑器 | ★★★★☆ | ★★★☆☆ | P1 | 有基础待完善 |
| Peek 快速预览面板（指挥中心）| ★★★★☆ | ★★☆☆☆ | P1 | 待开发 |
| Agent Teams 可视化 | ★★★☆☆ | ★★★★☆ | P1（实验）| 待开发 |
| Fork Mode 分叉支持 | ★★★☆☆ | ★★★☆☆ | P1（实验）| 待开发 |
| 定时任务管理 | ★★☆☆☆ | ★★★★☆ | P2 | 待开发 |

---

## 八、与旧设计的范式对比

| 维度 | 旧范式（Chat 中心）| 新范式（Agent 中心）| 推导依据 |
|------|-------------------|---------------------|---------|
| 默认首页 | 空白 Chat | Agent 舰队状态看板 | F3：用户行为是「回来审查」|
| UI 视觉重心 | Chat 输入框 | 介入待办队列 | F4：人类价值在决策 |
| 并行能力 | 弱（单线程感知）| 原生多 Agent 卡片 | F2：Claude Code 支持并行 |
| 任务输入 | 纯自然语言对话 | 结构化表单 + 自然语言 | F1：长任务需要明确规格 |
| 进度感知 | 只有流式文字 | 进度条 + 里程碑 + 成本 | F1：长任务需要状态可见性 |
| 反直觉结论 | Chat 框是主角 | Chat 框是日志，介入队列是主角 | F1-F4 推导 |

---

## 九、未在 v3.0 范围内的功能（技术约束）

以下功能因 Electron 本地运行约束，暂不纳入当前设计范围：

| 功能 | 约束原因 | 建议时机 |
|------|----------|---------|
| Cloud Routines（云端定时任务）| 需 Anthropic 云基础设施 | v4.0+ |
| Remote Control（手机远程控制）| 需 claude.ai 云端中转 | v4.0+ |
| Agent Teams GUI 可视化 | 实验性，需用户启用 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`；CLI 已可用，GUI 层提供团队看板 | v3.1（实验）|
| Fork Mode 支持 | 需用户启用 `CLAUDE_CODE_FORK_SUBAGENT=1`；GUI 在委派界面增加「分叉模式」选项 | v3.1（实验）|
| Voice Dictation（语音输入）| 需外部 API / 本地语音引擎 | v3.5+ |
| Computer Use（屏幕操控）| 仅 macOS，本机工具依赖 | v3.5+ |
| Plugin Marketplace 服务端 | 需要服务器 + 审核机制 | v3.5+ |


---

## 六、体验优化日志（2026-05-17）

> 本节记录首轮系统性 UI/UX 走查所发现的问题及修复决策，按第一性原则分析每个修复的因果关系。

### 6.1 问题清单与修复汇总

| 优先级 | 问题 | 根因（事实层） | 修复方案 | 涉及文件 | Commit |
|--------|------|--------------|---------|---------|--------|
| P1-1 | 弹出层背景视觉穿透 | `--bg-overlay` CSS 变量从未定义，background 降级为 transparent | 在 `:root` 和 `[data-theme="light"]` 各定义变量值 | `src/index.css` | `c75956e` |
| P1-2 | 完全自主模式缺乏风险感知 | 风险标记 `danger: true` 仅在代码中标注，UI 侧文案只有 `⚠ 高风险` 混入普通文字 | 条件渲染红色 `lp-danger-hint` 警告框 + AlertTriangle 图标 | `LaunchPanel.tsx`, `index.css` | `d22585a` |
| P1-3 | 自定义模型输入框常驻显示 | 自定义输入框无条件渲染，未根据 select 当前值判断是否显示 | 新增 `custom` option 占位，条件渲染输入框 | `ModelTab.tsx`, `constants.ts` | `73dcda2` |
| P2-4 | 工作区按钮 hover tooltip 缺失 | `nav-ws-trigger` 只有 `title` 属性，未加 `data-tooltip`，CSS tooltip 机制不生效 | 加 `data-tooltip`，CSS 选择器扩展覆盖 `nav-ws-trigger` | `NavRail.tsx`, `index.css` | `a5e5adf` |
| P2-5 | 指挥中心副标题引导方向不明 | 副标题 "选择工作目录开始" 暗示在指挥中心操作，实际入口在委派视图 | 改文案为 "就绪，等待新任务"；空状态卡片增加说明行指向委派视图 | `CommandCenter.tsx` | `1e79a42` |
| P2-7 | 底部未连接状态圆点无说明 | 只有灰色点 + "未连接" 文字，新用户不知道原因 | 加 `title` tooltip 说明 "Claude CLI 未启动，请先在委派视图启动任务" | `StatusBar.tsx` | `2dc3178` |
| P2-8 | 产物与监控页面定位边界模糊 | 两个页面顶部都是数据卡片，缺少页面级标题；"今日成本""历史会话" 重叠出现 | 各加页面级 header 行，明确区分 "产出汇总（累积）" vs "实时监控（当前）" | `ArtifactsView.tsx`, `MonitorView.tsx` | `242219c` |
| 一致性 | ChatPanel 底部工具栏用浏览器原生 tooltip | 4 个图标按钮只有 `title` 属性，与左侧导航的 CSS tooltip 风格不一致 | 新增 `.tip-btn` 通用向上 CSS tooltip 样式；4 个按钮改用 `data-tooltip` | `ChatPanel.tsx`, `index.css` | `50362eb` |

### 6.2 设计决策说明

#### P1-1：CSS 变量未定义导致视觉穿透

**事实**：CSS 中使用了 `var(--bg-overlay)`，但变量从未在 `:root` 或任何主题中定义。当 `var()` 遇到未定义变量时，整个属性声明失效，background 降级为 `transparent`。

**推导**：补全变量定义是唯一可行的修复路径，且深色/浅色主题需分别定义。

**为什么不改选择器**：改为内联颜色会破坏主题切换能力，违背 CSS 变量设计的初衷。

#### P1-2：风险提示框设计原则

**假设（被质疑）**：文案加 `⚠` 符号已足够传达风险。

**事实**：颜色是比文字符号更快的视觉信号（前注意阶段处理）。红色背景 + 图标的感知速度比文字 `⚠` 快 200ms 以上。

**结论**：高风险操作必须用视觉层级（颜色/形状）而非文案来传达，文案只是辅助。

#### P2-4/P2-7：hover 提示统一性原则

**事实**：`data-tooltip` + CSS `::after` 的提示是即时出现（CSS transition，约 150ms），而浏览器原生 `title` 有约 1s 延迟。两者共存导致用户感知混乱。

**推导**：应统一为一种机制。全量替换 100+ 处 `title` 属性风险过大；优先处理视觉最显眼的区域（左侧导航、底部工具栏）。

**MVP 范围控制**：左侧导航（已完成）+ ChatPanel 底部工具栏（已完成）。其余内层按钮 `title` 保留，作为 accessibility fallback。

#### P2-8：模块定位区分原则

**假设（被质疑）**："产物"和"监控"名称已足够区分。

**事实**：两个页面的顶部数据卡片都有"今日成本"和"历史会话"，用户在导航后看到相似卡片会产生定位困惑。

**推导**：模块名称 ≠ 定位说明。需要在页面内部补充"这个页面关注什么"的元信息。

**最小改动**：header 行（灰色背景 + 主标签 + 小字副说明），不改变数据卡片本身。

### 6.3 可复用设计规范（从本轮提炼）

1. **`data-tooltip` + CSS `::after` 是标准 hover 提示机制**
   - 左侧导航：`.nav-button[data-tooltip]::after`，方向向右
   - 页面内图标按钮：`.tip-btn[data-tooltip]::after`，方向向上
   - 保留 `title` 属性作为 accessibility fallback

2. **高风险操作必须用视觉层级传达**
   - `danger: true` 标记对应 `.lp-danger-hint` 红色警告框
   - 不能只在文案中加 `⚠` 符号

3. **CSS 变量必须双主题定义**
   - `:root` 中定义深色值
   - `[data-theme="light"]` 中定义浅色值
   - 每次新增 CSS 变量都需同步两处

4. **页面级 header 区分语义**
   - 产出汇总类页面：`"产出汇总 · 累计 Claude 操作文件与历史记录"`
   - 实时状态类页面：`"实时监控 · 当前会话上下文与成本状态"`

---

## 七、体验优化日志（2026-05-17，第二轮 P3 走查）

> 在第一轮 P1/P2 修复完成后，对全部 9 个导航模块进行系统性 P3 级走查，共识别并修复 7 个问题，分两批提交。

### 7.1 修复清单（7 项）

| 优先级 | 问题 | 根因（事实层） | 修复方案 | 涉及文件 | Commit |
|--------|------|--------------|---------|---------|--------|
| P3-1 | 指挥中心底部统计栏"$ $0.00"双美元符号 | `DollarSign` 图标 + `formatCost()` 返回值同时包含 `$` | 删除冗余 `DollarSign` 图标，保留格式化字符串 | `CommandCenter.tsx` | `e6de3ab` |
| P3-2 | Agents / 审查视图缺少页面级 header 行 | 这两个视图早于 header 规范开发，未补充 | 各添加 header 行，与产物/监控视图统一 | `AgentsView.tsx`, `ReviewView.tsx` | `e6de3ab` |
| P3-3 | 快速配置按钮 hover 提示用原生 `title`，响应慢 | 按钮沿用浏览器 `title`，与 `.tip-btn` 机制不一致 | 改为 `.tip-btn` + `data-tooltip`，统一 tooltip 体验 | `ModelTab.tsx` | `e6de3ab` |
| P3-6 | 空状态引导按钮文案不统一（3 种写法） | 各视图独立开发，没有统一的行动号召语言规范 | 统一为"前往委派，启动任务" | `WorktreePanel.tsx`, `ChangeSummaryPanel.tsx` | `e6de3ab` |
| P3-4 | 能力配置顶部刷新图标无即时 tooltip | 孤立图标按钮仅有 `title`，无 CSS tooltip 样式 | 加 `.tip-btn` + `data-tooltip` | `CapabilitiesView.tsx` | `92afeed` |
| P3-5 | 响应语言 placeholder 示例全英文 | Placeholder 写的是"japanese / chinese"等英文代码，中文界面中不直观 | 改为"可填 chinese（中文）/ japanese / french 等" | `ModelTab.tsx` | `92afeed` |
| P3-7 | 导入/导出纯图标按钮无说明标签 | 仅有 `title`（原生慢），图标含义不自明 | 加 `.tip-btn` + `data-tooltip` | `McpPanel.tsx` | `92afeed` |

### 7.2 设计决策说明

#### P3-1：信息表达去冗余原则

**事实**：货币值已通过 `formatCost()` 格式化为 `$0.00`，前置货币图标会造成双重符号。

**推导**：文字格式化已经承载了货币语义，图标是额外的噪音而非说明。

**结论**：删除图标，用格式化字符串本身传达货币信息。

#### P3-2：视图 header 一致性

**事实**：第一轮修复中为产物/监控新增了 header 行，但 Agents/审查是更早开发的视图，未补充。

**推导**：一致性不是美学要求，而是用户建立心智模型的基础。视觉节奏的突然中断会干扰用户对"我在哪"的判断。

**结论**：所有使用 `full-view` 布局的视图，统一在 `view-tab-bar` 前加 header 行。

#### P3-6：行动号召语言统一

**假设（被质疑）**："前往委派，设置工作目录"更精确，"前往委派，启动任务"更笼统。

**事实**：用户在空状态页看到三个不同措辞时，感知到的是"每个功能要求不一样的前置步骤"，会增加认知负担。

**结论**：在引导入口统一"前往委派，启动任务"（最宽泛、最无歧义），精确说明放在委派视图本身。

### 7.3 可复用规范补充（从本轮提炼）

5. **空状态页引导文案规范**
   - 所有"当前无数据，前往 X 操作"的引导按钮，统一使用"前往委派，启动任务"
   - 如有特殊前置条件（如需要先设置某项），在按钮附近单独加说明文字，不在按钮文案中体现

6. **纯图标按钮必须有即时 tooltip**
   - 任何只有图标没有文字标签的按钮，必须使用 `.tip-btn` + `data-tooltip`
   - 浏览器原生 `title` 仅作为 accessibility 兜底，不能作为唯一的用户提示手段

---

## 八、版本路线图（v4.9.0 → v5.0.0）

> 更新：2026-05-17（基于 v4.8.0 发布后现状规划）  
> 规划原则：按用户价值密度排序，先补齐「感知」缺口，再闭合「产出」回路

### 8.1 核心推导链

```
事实：用户行为是「分配任务 → 离开 → 回来审查」
问题：当前指挥中心无法告诉用户「谁需要我」（无状态分组、无 Peek）
      任务完成后没有产物闭环（无 PR 创建、Checkpoint 仅列表无回滚）

推导：
  Step 1 → 先让「感知层」可用（v4.9.0）：智能分组 + Peek UI + 通知
  Step 2 → 再让「产出层」闭环（v5.0.0）：PR 集成 + Checkpoint 回滚 + Peek 真实发送
```

### 8.2 v4.9.0 — 「感知 + 生态」大版

**核心命题**：让指挥中心真正告诉用户「现在最需要关注哪个会话」

#### 指挥中心智能感知

| 功能 | 规格摘要 |
|------|---------|
| **FEAT-401** 智能状态分组 | `isNeedsInput()` 启发式检测，问号/选项/Did you mean → 「🟡 需要输入」分组 |
| **FEAT-402** 会话图标系统 | `✽`旋转·`✻`等待输入·`∙`已完成，对齐 CLI agents TUI |
| **FEAT-403** Peek 面板（UI 框架）| 点击行就地展开，最近 120 字 + 快速回复框；v4.9 发送为 stub |
| **FEAT-404** 会话 Pin 置顶 | `pinnedTabIds` 持久化到 localStorage，置顶组常驻最上 |
| **FEAT-405** 今日统计增强 | 节省时间估算（token/5000×30min，带 `~` 标注）+ 当日成本汇总 |

#### 自动化生态

| 功能 | 规格摘要 |
|------|---------|
| **FEAT-411** Routines 定时任务 | 监控视图新 Tab；cron 表达式 + 任务历史 + 倒计时；底层 `node-cron` |
| **FEAT-412** 系统通知集成 | 「需要输入」分组新会话 → Electron Notification；按类型开关 |
| **FEAT-413** Hooks 可视化配置器 | 表单驱动替换纯 JSON；拖拽排序；保留「切换 JSON」逃生口 |

**质量目标**：测试覆盖率 35.28% → 40%

---

### 8.3 v5.0.0 — 「产物闭环 + Peek 真实连接」大版

**核心命题**：从代码变更到 PR 合并在 GUI 内完整闭环；Peek 面板完成真实交互

#### Peek 面板后端打通

| 功能 | 规格摘要 |
|------|---------|
| **FEAT-501** Peek 快速回复真实发送 | 接入 `cli:sendMessage` IPC；发送后 Peek 收起，Tab 消息实时更新 |
| **FEAT-502** Peek 内权限审批 | 权限请求状态时，Peek 内直接「允许/拒绝」，无需跳转审查视图 |

#### 产物完整闭环

| 功能 | 规格摘要 |
|------|---------|
| **FEAT-511** PR 创建与状态集成 | 产物视图 PR 区；GitHub CLI 创建 PR；摘要自动填充；状态点回显指挥中心 |
| **FEAT-512** Checkpoint 可视化回滚 | 时间轴视图；「回滚到此点」+ 确认弹窗（列出将丢弃的变更） |
| **FEAT-513** 文件变更历史（按任务分组）| 变更历史 Tab；任务卡片聚合 ±行数 + 时间戳 |

**质量目标**：测试覆盖率 40% → 45%  
**版本意义**：v5.0 标志从「CLI 包装工具」过渡到「完整 Agent 工作流平台」

---

### 8.4 Peek 面板交互规格（FEAT-403 + FEAT-501）

```
触发：
  - 点击指挥中心会话行（非 action 按钮区域）
  - 键盘 Space（行聚焦状态下）

收起：
  - Escape
  - 再次点击同一行
  - 点击其他会话行（自动切换）

Peek 内容（根据会话状态渲染不同内容）：

┌── 状态=「工作中」──────────────────────────────────────────────┐
│  最近输出（最多 120 字，滚动溢出省略）                          │
│  ─────────────────────────────────────────────                 │
│  [v4.9 stub] 快速回复框（灰色提示"连接 Electron 后可用"）       │
│  [v5.0 真实] 快速回复框 + 发送按钮（Enter 发送）               │
└────────────────────────────────────────────────────────────────┘

┌── 状态=「需要输入」─────────────────────────────────────────────┐
│  最后一条 assistant 消息（完整显示，超出滚动）                  │
│  ─────────────────────────────────────────────                 │
│  快速回复输入框（带历史联想）   [发送]                          │
└────────────────────────────────────────────────────────────────┘

┌── 状态=「权限请求」（v5.0 FEAT-502）────────────────────────────┐
│  权限请求描述（命令 / 文件路径）                                │
│                              [拒绝]  [本次允许]  [始终允许]     │
└────────────────────────────────────────────────────────────────┘
```


