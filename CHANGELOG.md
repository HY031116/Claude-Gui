# Changelog

## [3.11.0] - 2026-05-15

### 新增
- **3.3.7 后台介入通知机制**：权限请求发生在非活跃 Tab 时，自动弹出系统通知（标题/工具名/Tab 名）；点击通知自动切换到对应 Tab 并跳转 Dispatch 视图；`notifySend` IPC 新增可选 `tabId` 参数，`onNotificationClick` IPC 注册点击回调
- **3.4 Plan Mode 审查视图**：`PlanReviewPanel` 新组件，全面覆盖 `plan_ready` / `executing` / `generating_plan` 三个阶段；`parsePlanSteps` 解析编号计划列表，`buildSkipMessage` 生成跳过协议消息；步骤卡片含风险评级（低/中/高）、工具图标映射、默认勾选逻辑（高风险默认不勾）；工具栏支持全选/取消高风险/重置；可编辑计划 Modal；ChatPanel 完整集成（新消息时重置状态，`message-done` 时检测并进入 plan_ready，`handlePlanConfirm` / `handlePlanCancel` 回调）
- **3.5.7 Hooks 测试运行器**：HooksPanel 顶部新增「🧪 测试」按钮；`TestRunnerModal` 支持事件选择、模拟环境变量表格（各事件有默认值）、依次运行所有 `command` 类型 Handler、实时展示 stdout/stderr/退出码/耗时；`hook:testRun` IPC（超时 30s，跨平台 shell）
- **3.6.4 Worktree 对比视图**：WorktreePanel 顶部新增「对比」按钮（需 ≥2 个 worktree）；`WorktreeCompareModal` 支持左右 worktree 选择器、并行获取两侧 `git diff HEAD`、公共/仅左/仅右改动文件摘要、两列并排滚动 diff；`git:worktree:fullDiff` IPC

---

## [3.10.0] - 2026-05-15

### 新增
- **Agent Teams 视图（实验性）**：在 AgentsView 新增第三个 Tab「🧪 Agent Teams」，永远可见
- **启用门控**：通过 `loadSettings` 检查 `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === '1'`；未启用时显示警告横幅 + "立即启用" 一键写入 settings.json 的按钮
- **团队看板**：Lead 状态卡 + Teammates 列表（显示活跃/等待/完成/错误状态 + 最近日志 + 内联发消息输入框）+ 共享任务列表（显示负责人 + 进度状态）
- **Teammate 操作**：向 Teammate 发消息（格式化为 `[Send to {id}]: …` 转发给 Lead）、关闭 Teammate（向 Lead 发 stop 指令）
- **空状态引导**：无活跃团队时显示"让 Claude 创建团队…"按钮跳转 Dispatch，并含开发模式下的示例团队加载按钮
- **数据类型**：`TeammateState` / `SharedTask` / `AgentTeamState` 前端状态模型（对应 §3.8.2 规格）
- **CSS**：`.agent-teams-*`, `.at-btn`, `.at-teammate-*`, `.at-task-*`, `.at-badge-*` 等全套样式

## [3.9.0] - 2026-05-15

### 新增
- **介入类型 B — 决策卡片**：`message-done` 后检测 assistant 消息是否为决策型问题（以问号结尾 / 包含 Option A/B 列表），触发时在消息流底部显示 `DecisionCard`，支持快捷选项按钮、自定义输入框、"让 Agent 自主决定"三种回复路径
- **介入类型 C — 文件请求卡片**：检测 assistant 请求附加截图/文件，显示 `FileRequestCard`（提示用 Ctrl+V 粘贴或附件按钮），支持"跳过，无需提供"一键回复
- **介入类型 D — 长时等待横幅**：`isProcessing` 期间每 5 秒轮询，若 45 秒无新 chunk，显示黄色 `intervention-long-wait` 横幅（可手动关闭）
- **`sendQuickReply`**：ChatPanel 内部快捷回复函数，跳过表单流程直接调用 `cliSendMessage`，供介入卡片使用
- **检测函数（模块级）**：`detectDecisionRequest(text)` / `extractQuickOptions(text)` / `detectFileRequest(text)` / `FILE_REQUEST_PATTERNS`
- **CSS**：`.intervention-card`, `.intervention-card--decision`, `.intervention-card--file`, `.intervention-long-wait` 及子类，暗色主题 + 蓝/橙/黄色语义配色

## [3.8.0] - 2026-05-14

### 新增
- **CommandCenter v3.1 — 5 分组会话看板**：会话按状态分组（📌置顶 / 🟡需要输入 / 📋PR待审查 / ⚙工作中 / ✅已完成），替换旧版网格卡片布局
- **会话图标系统**：✽（工作中，蓝色旋转动画）/ ✻（等待输入，黄色）/ ∙（已完成，灰色），对齐官方 `claude agents` TUI
- **Peek 快速预览面板**：点击会话行展开，按组态显示不同内容（工作中显示最近工具/操作 + [查看日志]；待审查显示变更文件列表 + [查看变更]；等待输入显示最后消息 + [去回复]；已完成显示摘要 + [继续对话]），双击直接进入对话
- **置顶功能**：每条会话行右侧 Pin/PinOff 按钮，置顶 tab 优先展示在 📌 分组
- **今日统计横幅**：会话数 · 变更数 · 成本 · 节省时间估算（每次文件变更约 2min），替换原 4 格统计卡
- **store — `pinnedTabIds` + `togglePinTab`**：CommandCenter 置顶状态管理
- **LaunchPanel**：Dispatch 视图 [A] 态委派表单，支持执行模式（4 种 permission-mode）、Agent 下拉、工作目录选择、内置任务模板、高级选项（模型/成本上限/最大轮次/禁止工具/系统提示词）、Ctrl+Enter 快速提交
- **IPC extraArgs 链路**：`cliSendMessage` 新增 `extraArgs?: string[]` 参数，贯通 `electron.d.ts` → `preload.ts` → `main.ts` → `cli-service.ts`，供 LaunchPanel 按需传入 `--permission-mode` 等一次性 CLI 参数

### 变更
- CommandCenter「新建任务」按钮替换旧「委派新任务」，始终触发新建 Tab + 跳转 Dispatch
- 统计数据从仅当前活跃 tab 扩展为汇总全部 tabs 的 tokenUsage

---

## [3.7.1] - 2026-05-30

### 修复
- **DiffView — Side-by-Side 多 hunk 行号偏移**：`buildSideBySideRows` 遇到 `sep`（折叠行）时未将跳过行数累加到 `leftLine`/`rightLine`，导致多段变更场景下第二个 hunk 之后的所有行号偏低
- **ChangeSummaryPanel — multi_edit diff 行号从 1 开始**：`multi_edit` 类型每段 diff 未传 `startLineOld`/`startLineNew`，点击行号跳转到错误位置；补充从 `originalContent` 计算各段起始行号
- **ChatPanel — MultiEdit diff 行号缺失**：工具调用卡片内 `MultiEdit` 的多段 diff 同样缺失行号计算，已利用 `toolCall.originalContent` 补充
- **SkillsPanel — 全局指令文件永远不加载**：`window.__HOME_CLAUDE_MD__` 全局变量从未被定义，导致 `~/.claude/CLAUDE.md` 始终无法出现在技能列表；改为直接使用路径字符串（`file-service.ts` 已实现 `~` 展开）

---

## [3.7.0] - 2026-05-29

### 新增
- **MonitorView 历史会话高亮定位**：CommandCenter 近期会话列表点击单条记录，自动切换到 MonitorView → Sessions tab，并将对应行滚动至视图中央，伴随 2s 紫色闪烁动画
- **diff 行号 gutter + 行内跳转**：InlineDiff（Unified 视图）和 SideBySideDiff（Side-by-Side 视图）均显示绝对行号；可点击的行号（ctx / add 行）直接调用 `code --goto filePath:lineNum` 在 VS Code 中定位到对应行
- **ChangeSummaryPanel 文件行"在编辑器中打开"按钮**：每个文件行右侧增加 ExternalLink 图标，点击直接用系统编辑器打开文件（VS Code 优先）
- **edit 类型 diff 起始行号计算**：通过 `originalContent.indexOf(old_string)` 自动计算被修改片段在原文件中的绝对起始行，diff 行号与真实文件行对齐

### 变更
- `openInEditor` IPC 新增可选 `line?: number` 参数；VS Code 路径使用 `--goto filePath:line` 精准跳转；非 VS Code 回退（notepad / shell.openPath）不支持行号，将直接打开文件
- `DiffViewer` / `InlineDiff` / `SideBySideDiff` / `WriteDiff` 均新增 `startLineOld?` `startLineNew?` `onLineClick?` props

---

## [3.3.0] - v3.0 双栏任务中心面板

### 新增
- **TaskTimeline（执行时序面板）**：在对话流上方新增紧凑工具调用时序条，实时展示每个工具调用的状态（运行中/成功/失败）、名称和文件路径，支持折叠
- **ReviewQueue 常驻右栏**：变更审查队列不再隐藏于切换按钮，始终作为右侧独立面板展示（默认宽度 380px，可拖拽调整，可折叠）

### 变更
- TaskView 重构为真正的双栏布局：左栏（执行时序 + 对话流）+ 右栏（变更审查），符合 v3.0 任务中心范式
- 移除右栏浮动切换按钮，改为在面板标题栏内提供折叠/展开控制

所有版本的变更记录。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

---

## [3.2.0] - 2026-05-20

### 新增
- **HomeView Git 状态增强**：最近修改文件区块现在显示当前分支名 + ahead/behind 提交数
- **Git 状态刷新按钮**：最近修改区块右上角增加刷新按钮，支持手动重新加载 Git 状态
- **响应式工作区切换**：切换 WorkspaceSelector 中的工作区时，Git 状态自动刷新为该目录的变更

### 修复
- **Git 去重聚合**：staged + unstaged 中相同文件去重，staged 状态优先，新增 untracked 文件也纳入展示（上限 10 个）
- **Git 工作目录优先级**：激活工作区（activeWorkspacePath）> 当前会话目录，确保首屏始终显示最相关的 Git 状态

---

## [3.1.0] - 2026-05-20

### 新增
- **WorkspaceSelector 多项目切换**：NavRail 顶部新增工作区下拉选择器，支持添加/切换/删除本地项目工作区，持久化至 `localStorage`
- **HomeView 工作区层级概览**：激活工作区时右栏显示专属横幅，统计卡展示工作区会话数/消费，周 Token 趋势图和最近会话列表均按工作区过滤
- **全局 `Workspace` 类型**：`types/index.ts` 新增 `Workspace` 接口（id/name/path/addedAt）

### 修复
- **HistoryPanel 导航适配**：`setActivePanel('chat')` 迁移为 `setActiveNavSection('chat')`，会话点击/返回按钮现在正确关闭 AuxPanel 并回到对话区
- **ChatPanel 快速导航按钮**：运行概览的任务/工具/成本/变更按钮由旧 `setActivePanel` 迁移至 `setActiveNavSection + setActiveAuxSubPanel`，按钮点击现在正确打开对应 AuxPanel 子面板

---

## [3.0.0] - 2026-05-19

### 新增
- **5 项一级导航**：NavRail 从 4 项扩展为 5 项，对齐 v2.0 设计文档
  - 对话（chat）：主聊天区
  - 项目（project）：文件 / Git / 变更 / 上下文 / Worktree / 检查点 六个子面板
  - 工具（tools）：MCP / Agents / Plugins / Hooks / Skills / 任务 六个子面板
  - 配置（config）：设置 / 权限规则 / CLAUDE.md / 记忆 / 成本 五个子面板
  - **历史（history）（新增）**：历史会话 / 成本统计 / 记忆搜索 三个子面板
- **HomeView 两栏布局**：左栏 260px 继续任务列表，右栏自适应概览（统计卡 / 周 Token 趋势图 / 最近修改文件 / 快速链接）
- **会话持久化 Phase 1**：会话列表持久化到 Electron userData，支持删除和恢复

### 变更
- NavRail "变更角标"从旧"变更"项改为挂在"项目"上（父级聚合）
- `computeNavTransition`：点击已激活 section 折叠至 chat，点击不同 section 直接展开，逻辑统一
- `useAppStore` NavSection 类型增加 `'history'`

---

## [2.2.0] - 2026-05-13

### 新增
- **LCS 多 Hunk Diff**：`computeLineDiff` 升级为 LCS（最长公共子序列）DP 算法，可正确识别文件内多处非连续变更（旧算法只能找到单个连续变化块）
- **Diff Chunk 导航**：`DiffViewer` 新增 ↑/↓ 导航按钮 + `X/Y` Hunk 计数器，点击在各变更块间平滑滚动跳转
- **上下文折叠**：远离变更区的上下文行自动折叠为灰色分隔条（`... N 行未显示 ...`），CTX=3 行保留
- **Side-by-Side Diff**：双列对齐视图，左侧原始 / 右侧修改后，行号显示，del/add/change 颜色区分
- **Diff 模式持久化**：Unified/Side-by-Side 切换偏好持久化到 `localStorage`
- **对话 ↔ 变更面板联动**：文件修改工具卡片头部新增「查看变更」按钮，点击自动跳转变更面板并高亮对应卡片（1.5s 紫色淡出动画）
- **上下文面板**：项目区新增「上下文」子标签，展示 Token 用量进度条、已读取文件列表、CLAUDE.md 摘要

### 修复
- **IME 误发送**：输入框 Enter 键添加 `isComposing` 检查，中文/日文输入法组字过程中 Enter 确认候选词不再误触发消息发送
- **AuxPanel CostPanel 未导入**：补充 `CostPanel` import，修复生产打包 TS 编译错误

### 技术
- 大文件（n×m > 250,000）自动降级为单块算法，避免 LCS DP 内存/性能压力
- `data-hunk-start="true"` DOM 标记 + `querySelectorAll` 实现无状态 Chunk 定位

---

## [2.1.0] - 2026-05-13

### 新增
- **深度布局排版优化**：整体视觉层级、间距、字重、颜色对比度全面调整

---

## [2.0.1] - 2026-05-13

### 修复
- 压制 Windows ConPTY AttachConsole 退出噪音
- `useConpty: false` 消除 Windows 子进程报错

---

## [2.0.0] - 2026-05-13

### 新增
- 全局进度条
- 快捷键一览面板（`Ctrl+K`）
- 会话恢复：历史会话可继续对话（`canSend` 解耦 PTY 连接状态）

---

## [1.9.9] - 2026-05-13

### 新增
- 视效动效全面升级：streaming 光标、Tab 淡入、按钮微缩、状态过渡动画

---

## [1.9.8] - 2026-05-13

### 新增
- Light Theme 全面适配（hljs 亮色 token、Markdown CSS）

---

## [1.9.7] - 2026-05-13

### 改进
- 消息渲染质量提升：hljs 主题、Markdown CSS、表格防溢出

---

## [1.9.6] - 2026-05-12

### 新增
- `Ctrl+O` 全局展开/折叠所有 thinking 块（thinkingOverride prop 机制）

---

## [1.9.5] - 2026-05-12

### 新增
- TurnCard 增强：进度条 + 时间线样式 + 运行中节点脉动动画

---

## [1.9.4] - 2026-05-12

### 改进
- 会话标题优化 + Context 指示器 + 性能优化
