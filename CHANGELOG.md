# Changelog

## [4.9.0] - 2026-05-24

### 功能
- **FEAT-411 Routines 定时任务系统**
  - 新建 `electron/routines-service.ts`：基于 `node-cron` 的定时任务调度服务，支持 CRUD、立即执行、历史记录、Cron 表达式校验
  - `electron/main.ts` 注册 6 个 IPC Handler：`routines:list/create/update/delete/runNow/validateCron`
  - `electron/preload.ts` 添加类型定义与渲染进程桥接方法
  - 新建 `src/components/RoutinesPanel.tsx`：完整 UI 面板，支持 6 种 Cron 预设 + 自定义、展开历史、工作目录选择器
  - `MonitorView.tsx` 新增「定时任务」 Tab
- **FEAT-413 Hooks Handler 排序功能**
  - `HooksPanel.tsx` 的 `HandlerEditor` 新增上移下移按钒，支持在 Matcher Group 内调整 Handler 执行顺序

### 测试
- **TEST-401 覆盖率 35.28% → 40.29%**（+5.01%，486 tests passed / 33 test files）
  - 新建 `RoutinesPanel.test.tsx`：11 条测试（渲染、空状态、交互流）
  - 新建 `WorkspaceSelector.test.tsx`：4 条测试（渲染、下拉开关、工作区切换）
  - 修复 `EmptyState.test.tsx`：同步文案变更（「请先在委派视图中设置工作目录」）
  - 修复 `ChatPanel.interaction.test.tsx`：修复发送按钒选择器（`data-tooltip` vs `title`）

---

## [4.8.0] - 2026-05-22

### 测试
- **TEST-205 覆盖率冲刺第三阶段**（355 tests passed / 27 test files）
  - 新增 `SettingsSubPanels.test.tsx`：SessionTab / IntegrationsTab / WorkspaceArea（+15条）
  - 新增 `MoreSettingsTabs.test.tsx`：AppearanceTab / ModelTab / PermissionsTab（+22条）
  - 新增 `SmallComponents.test.tsx`：UpdateBanner / StatusBar / ShortcutsModal / AuxPanel（+15条）
  - 新增 `MoreComponents.test.tsx`：WebModeBanner / AskQuestionsModal / useResizableSidebar / InterventionCenter（+25条）
  - **Line 覆盖率：31.91% → 35.28%**（+3.37%，首次突破 35% 里程碑）

---

## [4.7.0] - 2026-05-21

### 测试
- **TEST-203 集成测试覆盖率突破 30%**（258 tests passed）
  - 新增 `HooksArtifactsCommand.test.tsx`：HooksPanel / ArtifactsView / CommandPalette / CapabilitiesView 共 21 条集成测试
  - HooksPanel：挂载调用 `loadCliConfig`、空状态"该事件暂无 Hook 配置"、添加 Matcher Group、PreToolUse 事件列表
  - ArtifactsView：无活跃会话空状态、有会话无文件空状态、"未选目录"Git 状态格、Tab 按钮渲染
  - CommandPalette：搜索框 placeholder、"导航"分组、"没有匹配的命令"空状态、"指挥中心"命令项
  - CapabilitiesView：挂载调用 `loadCliConfig`、统计栏（MCP/Hooks/权限规则）、左侧菜单"Hooks"
  - **Line 覆盖率：27.08% → 30.45%**（+3.37%）
- **TEST-204 全局 setup 优化**（src/test/setup.ts）
  - 新增全局 `afterEach(cleanup)`：每条测试后自动卸载 React 树，消除跨测试污染
  - 新增 `console.error` 过滤：静默 act() 警告噪音（根因：mock Promise 在断言完成后 resolve 触发 setState），保留真实错误输出

---

## [4.6.0] - 2026-05-21

### 优化
- **DEBT-002 permissionRequests 清理收敛**（useAppStore.ts + ChatPanel.tsx）
  - 将原 ChatPanel 中 3 处分散的 `clearPermissionRequestsForTab` 调用（message-done / message-error / handleStop）收敛到 store 的 `setTabProcessing(tabId, false)` 内部自动触发
  - 语义：回合结束（`processing → false`）时该 Tab 的待审批权限请求必然过期，由单一入口统一清理，消除遗漏风险
  - 移除 ChatPanel 对 `clearPermissionRequestsForTab` 的独立 store 订阅

### 测试
- **TEST-202 DEBT-002 回归测试**（useAppStore.test.ts，59 tests passed）
  - `setTabProcessing(false)` 自动清空当前 Tab 权限请求
  - `setTabProcessing(true)` 不清空（仅结束时清理）
  - Tab A 清理隔离：不影响 Tab B 的权限请求

---

## [4.5.0] - 2026-05-21

### 修复
- **BUG-201 MultiEdit diff 行号偏移**（ChatPanel.tsx）
  - 根因：在编辑前快照 `originalContent` 中逐个搜索 `old_string`，前序编辑已改变行号，导致后续 diff 行号显示偏移
  - 修复：IIFE 内用 `currentText` 顺序模拟替换，每步更新文本基准，行号从实时文本状态计算
- **BUG-202 resume 会话 token 重复计入**（ChatPanel.tsx）
  - 根因：Claude `--resume` 时 API `input_tokens` 包含所有历史轮次累计值；`addTokenRecord` 直接记录原始值后 CostPanel 求和导致历史 token 被反复累加
  - 修复：`cumulativeTokensByTabRef`（per-tab Map）在每轮 `session_end` 时追踪累计基准，记录增量 = current - prev，确保 CostPanel 显示单轮实际消耗

### 优化
- **DEBT-201 rawJsonLog 内存自动清理**（useAppStore.ts + ChatPanel.tsx）
  - 每次 `message-done` 后自动调用 `trimRawJson(200)`，将全局调试日志裁剪至最近 200 条，防止长会话持续占用 JS heap
  - 新增 `trimRawJson(keepLast: number)` store action，用户手动清空（clearRawJson）行为不受影响

### 测试
- **TEST-201 v4.5.0 场景单元测试**（useAppStore.test.ts，56 tests passed）
  - `trimRawJson` 裁剪行为：保留最近 N 条，多余丢弃；条目不足时不变
  - `addTokenRecord` 增量记录求和验证（BUG-202 场景）
  - `setPendingDecisionRequest` 快速回复状态收敛（设置 → 清空为 null）
  - `setPendingFileRequest` 按 Tab 隔离，其他 Tab 不受影响
  - `switchWorkspace` 后 `pendingDecisionRequests` / `permissionRequestsPerTab` / `longWaitBanners` 全部清空

---

## [4.4.0] - 2026-05-20

### 修复
- **RISK-101 工作区切换进程生命周期修复**（App.tsx）
  - `activeWorkspacePath` useEffect 中新增 `cliStopMessage()` 调用（不传 tabId = 全部停止），工作区切换后立即终止所有旧工作区 CLI 进程，防止僵尸进程持续运行并向新工作区介入中心发送 permission-request / question-request 事件
  - `onCliOutput` 回调开头加防御性 tabId 有效性过滤：若 `event.tabId` 不在当前工作区 `tabs` 中直接跳过，防止极端竞态下的漏网事件
- **BUG-101/BUG-102/BUG-103 分析确认无实际问题**（无需代码修改）
  - BUG-101：`permission-request` 已写 Zustand store（BUG-002 副作用），`question-request` 用函数式更新，不存在 React batch 覆盖风险
  - BUG-102：`sendQuickReply` 触发时机（pendingDecision/pendingFileRequest 被设置后）与 `conversationSessionId` 设置时机在同一 `message-done` React 批次，sessionId 必然已有值
  - BUG-103：BUG-002 修复时已将 `handleStop` 中的 `setPermissionRequests([])` 改为 `clearPermissionRequestsForTab(activeTabId)`，全局介入中心自动同步

---

## [4.3.0] - 2026-05-19

### 改进
- **Plan Mode 增强**：PlanReviewPanel 补全两处缺失功能
  - **EditPlanModal 步骤数实时预览**：保存按钮文字动态显示当前文本将被解析的步骤数，格式"保存并重新解析（N 步骤）"；辅助提示行也同步展示实时步骤数
  - **风险等级分布表**：在步骤列表上方新增可折叠的风险分布表（3 行 × 3 列：等级 / 数量 / 涉及步骤编号），高风险行直接显示目标文件/命令，便于快速定位危险操作；点击右上角徽章可折叠/展开；有高风险步骤时默认展开
  - **StepCard 展开态增强**：展开详情由纯风险说明扩展为 4 行网格：完整命令（Bash 步骤提取 CLI 命令，其他步骤显示目标文件）/ 执行目录（读取当前会话工作目录）/ 推断影响（riskReason）/ 操作建议（按工具类型定制）；所有步骤均可展开，不再仅限高风险步骤
- **HistoryPanel 离线会话加载**：点击历史会话时自动从 `~/.claude/projects/<projectDir>/<sessionId>.jsonl` 读取完整对话记录并填充聊天视图
  - 后端 `loadSessionMessages` IPC 接口已实现（最大读取 2MB，支持旧版 queue-operation 格式和 CLI 2.x type=user 格式）
  - 前端 `handleSelectSession` 改为 async，选中会话后调用 `electronAPI.loadSessionMessages` 并通过 `setMessages` 填充 store；非 Electron 环境静默忽略
  - 切换至聊天面板后用户可立即看到历史消息，无需重新运行 Claude

## [4.2.0] - 2026-05-18

### 新增
- **Agent Teams 实时状态同步**：AgentTeamsPanel 订阅 CLI 消息流，自动解析 `Task` 工具调用
  - 检测到 Lead 派发 `Task` 工具时，自动创建 Teammate 卡片并标记为「活跃」
  - 工具结果返回时自动将 Teammate 状态切换为「等待任务」，并更新共享任务列表
  - 会话结束时所有 Teammate 状态变为「完成」
  - Lead 当前状态随 assistant 文本实时滚动更新
  - 看板标题区新增「实时监控」绿色指示点；空状态说明更新，告知用户会自动检测无需手动
- **分叉模式（Fork Mode）**：委派表单高级选项中新增「分叉模式」开关
  - 启用后显示历史会话下拉选择器（最多 20 条），选中后自动在 CLI 参数中注入 `--resume <sessionId>` 以继承对话上下文
  - 自动检测 `CLAUDE_CODE_FORK_SUBAGENT=1` 环境变量；若未配置则显示警告并提供「一键启用」按钮
  - 启用分叉但未选择来源会话时阻止提交，避免误操作
  - 对应设计文档规格：`docs/PRODUCT_DESIGN.md` 行 321/342/448

## [4.1.0] - 2026-05-17

### 新增
- **工作区目录绑定**：新建工作区时支持选择本地目录，自动用目录名填充工作区名称
  - `NavRail.tsx`：Popover 新建行加入 `选择目录` 按鈕（Electron 环境），调用 `selectDirectory` API
  - `useAppStore.ts`：`switchWorkspace` 切换到工作区时自动回写 `session.workingDirectory` 到 `workspace.path`；恢复快照时 session cwd 自动用工作区 path 补充
- **工作区列表显示路径**：Popover 中每个工作区显示路径末尾 2级目录 + 相对时间，悬停 tooltip 显示完整路径

## [4.0.0] - 2026-05-17

### 新增（重大功能）
- **多工作区切换器**：NavRail 顶部新增工作区切换器，支持在多个独立工作区之间切换并完整隔离各自的 Tabs 状态
  - `src/types/index.ts`：`Workspace` 类型扩展，新增 `tabsSnapshot`（离开时保存）和 `lastUsed`；新增 `WorkspaceTabsSnapshot` 接口
  - `src/stores/useAppStore.ts`：新增 `switchWorkspace`（保存当前→恢复目标工作区）和 `createWorkspace`（新建并立即切换）
  - `src/components/layout/NavRail.tsx`：工作区切换器替代原 Logo，点击展开 Popover，支持列表切换/新建/移除
  - `src/index.css`：工作区切换器样式 + Popover + 入场动画
- **工作区隔离或切换逻辑**：
  - 切换时将当前所有 Tab（含实时消息）完整打包保入工作区快照
  - 目标工作区有快照时自动恢复，否则以空白状态开启
  - `processingTabs`/`tabInterventionStatus`/`tabUnreadCounts` 切换时自动重置防止跨工作区状态污染
- **工作区显示提示**：首字母开头缩写强调当前所在工作区，悬停显示工作区全名

## [3.19.0] - 2026-05-17

### 新增
- **跨 Tab 未读气泡**：当后台 Tab 的 Agent 完成处理时，对应 Tab 标题显示带充满动画的未读数量气泡，切换到该 Tab 后自动清零
  - `src/stores/useAppStore.ts`：`tabUnreadCounts` 状态 + `markTabRead` 清零操作；`setTabProcessing` 内嵌自动递增逻辑
  - `src/components/layout/WorkspaceArea.tsx`：订阅 `tabUnreadCounts`，切换 Tab 时调用 `markTabRead`，渲染 `.session-tab-unread` 气泡
  - `src/index.css`：`.session-tab-unread` 气泡样式 + `badge-pop` 弹出动画

## [3.18.0] - 2026-05-17

### 新增
- **成本趋势图多时间范围**：CostPanel 头部新增 7/14/30 天切换按钮，手动选择趋势分析周期
- **按项目成本分布（Top 5）**：CostPanel 新增工作目录维度成本聚合，显示花费最高的 5 个项目及其成本水平条
- **全局快速搜索历史会话 (Ctrl+Shift+F)**：任意界面触发，自动跳转到监控页 > 会话列表，并自动聚焦搜索框
  - `src/stores/useAppStore.ts`：新增 `historySearchTrigger` 信号 + `triggerHistorySearch` action
  - `src/App.tsx`：全局 keydown 监听 Ctrl+Shift+F → 切换导航到 monitor + 切换到 sessions tab + 触发搜索
  - `src/components/HistoryPanel.tsx`：接收信号，使用 `useRef` 聚焦搜索框
- **快捷键面板更新**：ShortcutsModal 加入 Ctrl+Shift+F 说明

### 技术
- `aggregateByProject` 函数：按工作目录聚合 Top N 项目成本
- CostPanel `chartDays` 状态控制时间范围，动态重算 `aggregateByDay`

## [3.17.0] - 2026-05-17

### 新增
- **外观定制系统 (AppearanceTab)**：设置面板新增「外观」标签页，集中管理主题、强调色和字体大小
  - **强调色预设（6色）**：紫色（默认）/ 蓝色 / 翠绿 / 橙色 / 粉色 / 青色，即时应用于全局 UI
    - `src/index.css`：添加 `[data-accent="*"]` CSS 选择器，覆盖 `--accent`, `--accent-light`, `--accent-glass*`, `--accent-focus-*` 等变量
    - `src/stores/useAppStore.ts`：新增 `accentColor` 状态 + `setAccentColor`，持久化至 `localStorage`
    - `src/App.tsx`：`useEffect` 监听强调色变化，同步写入 `document.documentElement` 的 `data-accent` 属性
  - **字体大小三档**：紧凑（12px）/ 标准（14px）/ 宽松（15px），调节全局文本层级变量
    - `src/index.css`：添加 `[data-fontsize="compact|relaxed"]` CSS 选择器，覆盖 `--text-xs/sm/base/md/lg/xl`
    - `src/stores/useAppStore.ts`：新增 `fontSize` 状态 + `setFontSize`，持久化至 `localStorage`
    - `src/App.tsx`：`useEffect` 监听字体大小变化，同步 `data-fontsize` 属性（normal 档移除属性以回退默认值）
  - **AppearanceTab 组件**：`src/components/settings/AppearanceTab.tsx`，含主题卡片选择器、强调色圆点选择器、字体大小三档按钮及实时预览区

### 技术
- `src/components/SettingsPanel.tsx`：activeTab 类型扩展 `'appearance'`，TabBar 新增「外观」选项
- `src/components/settings/index.ts`：导出 `AppearanceTab`

## [3.16.0] - 2026-05-16

### 新增
- **@文件引用自动补全**：任务描述框中输入 `@` 触发文件搜索弹窗，支持 fuzzy 匹配，键盘 ↑↓/Enter/Esc 导航，选中后自动展开为完整路径
  - `electron/file-service.ts`：`listFilesInDir(cwd, query)` — 递归遍历工作目录，排除 node_modules/.git 等，fuzzy 匹配返回最多 20 条
  - `src/components/task/FileSearchDropdown.tsx`：@引用弹窗组件，支持键盘导航和点击外部关闭
- **Skills 注入**：高级选项新增 Skills 多选标签区，加载 `~/.claude/skills/` 和 `.claude/skills/` 中的 `.md` 文件，选中后以 `/skill-name` 形式前置到任务消息
  - `electron/file-service.ts`：`listSkills(cwd?)` — 读取全局/局部 Skills 目录
- **任务模板保存**：模板区新增「保存当前」按钮，支持将当前表单（任务描述+执行模式+Agent）保存为自定义模板，存入 `localStorage`；自定义模板支持独立删除
- **Web 端工作目录适配**：Web 模式下工作目录改为手动文本输入（对话框不可用），支持路径验证、`~` 展开、历史记录下拉（最近 10 条）
- **Web 模式横幅**：`WebModeBanner` 组件，非 Electron 环境顶部显示连接状态提示，可关闭（sessionStorage 记忆）
- **StatusBar Web 标识**：Web 模式下状态栏显示蓝色「🌐 Web 模式」标识

### 技术
- `electron/main.ts`：注册 `fs:listFiles` / `fs:listSkills` IPC handler
- `electron/web-server.ts`：switch-case 添加两个新 channel 转发
- `electron/preload.ts` / `src/types/electron.d.ts` / `src/lib/transport.ts`：同步添加新方法类型和 webAPI 实现

### 新增
- **Web 端支持**：Electron 内嵌本地 Web 服务器（`127.0.0.1:5175`），同机浏览器可访问完整 GUI，无需任何额外安装
  - `electron/web-server.ts`：HTTP + SSE 服务器，提供静态文件 + 全量 API 代理（cli/fs/settings/git/plugin/session 等所有 IPC 通道）
  - `electron/cli-service.ts`：新增 `addOutputListener` 接口，CLI 输出通过 SSE 广播给浏览器客户端
  - `src/lib/transport.ts`：通信适配器，Electron 环境用原生 IPC，浏览器环境自动降级为 HTTP fetch + SSE
  - `src/main.tsx`：Web 模式下将 `webAPI` 注入为 `window.electronAPI`，现有代码零修改
  - NavRail Globe 按钮（仅原生 Electron 环境显示）：点击在默认浏览器打开 `http://127.0.0.1:5175`

### 修复
- **ChatPanel — React Hooks 条件调用**：`ChangeSummaryCard` 组件将早期 `return null` 移至所有 `useMemo`/`useCallback` 之后，修复 6 处违反 Rules of Hooks 的 ESLint error
- **ChatPanel — 正则无效转义**：字符类 `[\.\)]` 改为 `[.)]`，修复 2 处 `no-useless-escape` ESLint error
- **PlanReviewPanel — 未使用参数**：`inferRiskLevel(_text)` 移除未使用的 `_text` 参数
- **electron/main.ts — require 样式 import**：4 处内联 `require('child_process')` 改为顶层静态 `import { spawnSync, spawn }`，消除所有 ESLint error（lint 错误从 16 降至 0）

---

## [3.14.0] - 2026-05-15
### 修复
- **指挥中心「继续对话」按钮导航失效**：`handleGoToTab` 改为直接读写 zustand store（`useAppStore.getState()`），绕过 `onNavClick` prop 闭包可能捕获旧 `activeNavSection` 导致 `computeNavTransition` 误判已在 dispatch 并 toggle 回 command 的问题；同时移除 `hasOptionList` 正则中多余转义字符（ESLint `no-useless-escape`）。

## [3.13.0] - 2026-05-15
### 新增
- Subagent 完整字段编辑器：AgentPanel 扩展支持所有官方 frontmatter 字段
  - 基础信息：名称、颜色选择盘（9色）、描述（多行）、模型选择
  - 执行配置（折叠）：权限模式（6选项）、最大轮次、Effort 级别
  - 工具访问（折叠）：11个工具复选框（allowed_tools）、禁止工具文本输入（disallowed_tools）
  - 高级配置（折叠）：Skills预加载、持久记忆（4选项）、隔离模式（2选项）、后台运行复选框、初始提示词
  - System Prompt 区域保持在表单末尾
- electron/file-service.ts：parseAgentFile / serializeAgent 支持所有新 frontmatter 字段（含 JSON 数组解析）
- 全量类型签名同步：electron.d.ts / preload.ts / main.ts 统一更新

## [3.12.0] - 2026-05-15

### 新增
- **命令面板（Ctrl+K）**：全局命令面板，支持模糊搜索所有功能入口；麻雀匹配算法（包含则高分、序列匹配则得分）；5 分组命令（导航 / 标签 / 会话 / 能力配置 / 系统）；键盘导航（↑↓ / Enter / Esc）；快捷键提示显示；关键字删除按钮。
- **Ctrl+1~7 NavRail 快捷跳转**：Ctrl+1=指挥中心、Ctrl+2=委派、Ctrl+3=Agents、Ctrl+4=审查、Ctrl+5=产物、Ctrl+6=能力配置、Ctrl+7=监控，全局键盘监听，不与输入框冲突。
- **快捷键面板更新**：ShortcutsModal 新增 Ctrl+K 和 Ctrl+1~7 条目。

---

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
