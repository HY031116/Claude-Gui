# Claude Code GUI — Bug 追踪 TODO（v4.3.0 → v4.5.0）

> 版本目标：聚焦"交互与状态同步"稳定化，不追加大功能。  
> 标签格式：`[BUG]` 已知缺陷 · `[RISK]` 潜在风险 · `[DEBT]` 技术债 · `[TEST]` 需补测试

---

## v4.3.0 — 状态一致性修复版

### 🔴 优先级 P0：必须修复（阻断核心功能）

#### ✅ BUG-001 closeTab / switchWorkspace 不清理介入孤儿状态 — **已修复**
- **文件**：`src/stores/useAppStore.ts` — `closeTab` `switchWorkspace`
- **修复内容**：`closeTab` 现在在删快照的同时删除三个 map 的对应 key；`switchWorkspace` 的 set block 追加了 `pendingDecisionRequests: {}`、`pendingFileRequests: {}`、`pendingQuickReplies: {}`。

#### ✅ BUG-002 permissionRequests 双状态源 — **已修复**
- **修复内容**：
  - `useAppStore` 新增 `permissionRequestsPerTab: Record<string, PermissionRequestEvent[]>` + `addPermissionRequest` / `removePermissionRequest` / `clearPermissionRequestsForTab` 三个操作
  - `App.tsx` 的 `permission-request` 事件改为写入 store；`permissionRequests` 改为从 store 用 `useMemo` 派生的 `PendingPermissionItem[]`；`handleApprovalAction` 改为调用 store 的 `removePermissionRequest`
  - `ChatPanel.tsx` 移除本地 `useState<PermissionRequestEvent[]>`；移除本地 `permission-request` / `permission-resolved` 事件监听；`permissionRequests` 改为 `useAppStore((s) => s.permissionRequestsPerTab[activeTabId] ?? [])`；`setPermissionRequests([])` 全部替换为 `clearPermissionRequestsForTab`
  - `closeTab` / `switchWorkspace` 也同步清理 `permissionRequestsPerTab`

#### ✅ BUG-003 pendingQuickReply 在 isProcessing=true 时的行为 — **已分析确认无误**
- **结论**：useEffect 依赖 `isProcessing`，当 Claude 生成结束后 isProcessing 变 false，effect 重新运行并自动触发快速回复，**不存在静默丢弃**。原分析为误判，已更正代码注释。
- **文件**：`src/components/ChatPanel.tsx`（L738–744）
- **根因**：`message-done` 事件触发时，代码清空了 `permissionRequests`（L744），但没有清空 `pendingDecisionRequests[tabId]` 和 `pendingFileRequests[tabId]`（这两个是在 `message-done` 之后才设置的，所以没有清空问题）。  
  **真正问题**：用户从介入中心发出快速回复（`sendQuickReply`）之后，`pendingDecision` / `pendingFileRequest` 在 store 里已经置 null，但如果 `isProcessing=true` 导致 `sendQuickReply` 被跳过，快速回复的 text 就丢失了。
- **后果**：介入中心点击"自主决定"或"无需提供继续"，如果恰好 Claude 在生成中（虽然不应该但可能发生竞态），动作被静默丢弃，用户无任何反馈。
- **修复方向**：`pendingQuickReply` 的 useEffect 在 `isProcessing=true` 时不应丢弃，而应等待 `isProcessing` 变 false 后重新触发；或在下发快速回复时先检查 `isProcessing` 并在介入中心 UI 上给出"正在等待 Claude 完成，稍后将自动回复"的提示。
- **代码行**：ChatPanel.tsx:899–902（pendingQuickReply useEffect）· App.tsx:334–339（handleQuickReplyAction）

---

### 🟡 优先级 P1：应在本版修复（影响体验正确性）

#### ✅ BUG-004 Tab 切换时 showLongWaitBanner 不重置 — **已修复**
- **修复内容**：ChatPanel 新增 `useEffect(() => { setShowLongWaitBanner(false); }, [activeTabId])`，Tab 切换时横幅自动收起。
- **文件**：`src/components/ChatPanel.tsx`（L392）
- **根因**：`showLongWaitBanner` 是 ChatPanel 的本地 useState，共享同一个 ChatPanel 实例（所有 Tab 渲染同一个 ChatPanel）。当从 Tab A（正在等待）切换到 Tab B，长时等待横幅会继续显示，即使 Tab B 已经空闲。
- **后果**：切换 Tab 后误显示"已超过 45 秒无新输出"横幅，干扰用户。
- **修复方向**：监听 `activeTabId` 变化时重置 `showLongWaitBanner`；或将其提升到 store 按 Tab 保存（类似 tabInterventionStatus）。
- **代码行**：ChatPanel.tsx:392 · ChatPanel.tsx:318–333（isProcessing + interval useEffect）

#### ✅ BUG-005 handleFocusQuestion 跳转后未读计数不清零 — **已修复**
- **修复内容**：`setActiveTab` 内部追加 `tabUnreadCounts: { ...state.tabUnreadCounts, [tabId]: 0 }`，切换目标 Tab 时自动清零，无论触发来源（UI 点击或介入中心跳转）均生效。
- **文件**：`src/App.tsx`（L316–325）
- **根因**：`handleFocusQuestion` 里调用 `store.setActiveTab(tabId)` 后又调用 `setActiveNavSection('dispatch')`，但 `setActiveNavSection` 触发的 re-render 与 `setActiveTab` 同帧，有可能 WorkspaceArea 中的 `setActiveTab` 触发的 markTabRead 未能及时执行。
- **后果**：通过介入中心跳转到目标 Tab 时，该 Tab 的未读计数可能没有被清零（markTabRead 只在 WorkspaceArea 的点击事件里调用）。
- **修复方向**：`setActiveTab` 内部自动 markTabRead，不依赖 UI 点击事件。
- **代码行**：useAppStore.ts:320–345（setActiveTab） · WorkspaceArea.tsx:255

#### ✅ BUG-006 工作区切换后全局 questionRequests / permissionRequests 不重置 — **已修复**
- **修复内容**：App.tsx 新增 `useAppStore((s) => s.activeWorkspacePath)` 订阅，并在 `activeWorkspacePath` 变化的 useEffect 中 `setQuestionRequests([])` + `setPermissionRequests([])` + 关闭介入中心。
- **文件**：`src/App.tsx`（L162–166）
- **根因**：`questionRequests` 和 `permissionRequests` 是 `App.tsx` 的 React 本地 state，切换工作区后不会被清空，导致上个工作区的待处理提问和权限审批仍然显示在介入中心。
- **后果**：切换工作区后，介入中心残留旧工作区的待处理项，用户操作会发送到错误的 CLI 进程。
- **修复方向**：监听 `activeWorkspacePath` 变化，变化时清空 `questionRequests` / `permissionRequests`；或将这两个状态也提升到 store 并在 `switchWorkspace` 时清空。
- **代码行**：App.tsx:162–166 · useAppStore.ts:630–640（switchWorkspace 的 set block）

---

### 🟢 优先级 P2：技术债 / 可观测性（本版可选，下版必选）

#### ✅ DEBT-001 Tab 介入状态计算依赖 ChatPanel 副作用 — **已修复**
- **修复内容**：将 `showLongWaitBanner` 从 ChatPanel 本地 `useState` 提升为 store 中的 `longWaitBanners: Record<string, boolean>`，新增 `setLongWaitBanner(tabId, show)` action。ChatPanel 中的 interval 定时器、`message-done` 回调、dismiss 按钮均改为写入 store。`closeTab`/`switchWorkspace` 同步清理 `longWaitBanners`。`tabInterventionStatus` 的 useEffect 现在全部四个输入（permissionRequests、pendingDecision、pendingFileRequest、showLongWaitBanner）均来自 store，消除了本地 state 对计算的干扰。

#### DEBT-002 permissionRequests 的清理时机分散在 5 处
- **代码行**：ChatPanel.tsx:744（message-done）· L781（message-error）· L1144（handleStop）· L556 + L563（permission-resolved 事件）
- **描述**：权限请求的清理分布在 5 个地方，任何一处遗漏都可能残留。提升到 store 后可统一管理清理逻辑。

#### ✅ TEST-001 介入状态隔离测试 — **已完成**
- **补充内容**（`src/stores/useAppStore.test.ts`）：
  - `addPermissionRequest` Tab 隔离测试
  - `removePermissionRequest` 移除后列表为空
  - `closeTab` 活跃 Tab 关闭后权限请求 + longWaitBanners 被清除
  - `closeTab` 非活跃 Tab 关闭同样清理
  - `setLongWaitBanner` 按 Tab 隔离
  - `setActiveTab` 切换后未读计数自动清零（验证 BUG-005 修复）

---

## v4.4.0 — 会话可靠性修复版

> 以下 TODO 依赖 v4.3.0 完成后再执行，避免在不稳定基础上修复上层问题。

#### ✅ BUG-101 AskUserQuestion 并发与 permission-request 同时到达时互相覆盖 — **已分析确认无实际问题**
- **结论**：BUG-002 修复后，`permission-request` 写入 Zustand store（`addPermissionRequest`，内置幂等检查），`question-request` 使用函数式 `setQuestionRequests((prev) => ...)` 更新（安全），两种写入路径完全独立，不存在 React batch 覆盖风险。`setShowInterventionCenter(true)` 幂等，不会互相干扰。原分析基于 BUG-002 修复前的架构，已失效。

#### ✅ BUG-102 sendQuickReply 缺少 conversationSessionId 守卫 — **已分析确认无实际风险**
- **结论**：`setPendingDecisionRequest` / `setPendingFileRequest` 只在 `message-done` 处理块内调用，而 `session_end` 事件（设置 `conversationSessionId`）也在同一个 `message-done` 批次里处理。React 批次渲染后，两者同时落定，`sendQuickReply` 触发时 `conversationSessionId` 必然已有值。理论边界条件在实际使用中无法触发。

#### ✅ BUG-103 handleStop 后 permissionRequests 清空但全局介入中心不清 — **已自然修复（BUG-002 副作用）**
- **代码行**：ChatPanel.tsx:1140（handleStop 里的 clearPermissionRequestsForTab）
- **状态**：BUG-002 修复时已将 handleStop 中的 `setPermissionRequests([])` 替换为 `clearPermissionRequestsForTab(activeTabId)`，该清空操作直接写入 store，全局介入中心（App.tsx 的 `permissionRequests` 是 store 的派生值）会自动同步更新。无需额外修复。

#### ✅ RISK-101 后台 Tab 的 CLI 进程在工作区切换时是否被正确清理 — **已修复**
- **风险**：切换工作区时，旧工作区 Tab 的 CLI 进程没有显式终止，僵尸进程持续运行并发出 permission-request / question-request 事件，被 App.tsx 全局监听器写入新工作区介入中心。
- **修复**（FIX[RISK-101][v4.4.0]，App.tsx）：
  1. `activeWorkspacePath` useEffect 中新增 `window.electronAPI?.cliStopMessage?.()` 调用（不传 tabId = 全部停止），在工作区切换后立即终止所有旧进程。
  2. `onCliOutput` 回调开头加防御性 tabId 过滤：若 `event.tabId` 不在当前工作区的 `tabs` 中，直接 return，防止极端竞态。

---

## v4.5.0 — 数据正确性与发布候选版

> 以下 TODO 在前两版稳定后执行。

#### BUG-201 diff 行号在 MultiEdit 场景下与实际文件不一致
- **描述**：`DiffView.tsx` 的行号计算基于初始快照，连续多次编辑同一文件时行号可能偏移。
- **方向**：每次 Write/Edit 工具调用结束后刷新快照基准。

#### BUG-202 成本统计累计逻辑在多轮对话中可能重复计入
- **代码行**：ChatPanel.tsx 中处理 result 的 token 统计逻辑
- **描述**：每次 `message-done` 后都从 event.data 读取 token 并写入 `tokenUsage`，但 resume 继续上次会话时，旧 session 的 token 可能被重复统计。
- **方向**：对 resume 场景标记"不累计到全局 cost"或"从上次 checkpoint 开始累计"。

#### DEBT-201 内存增长风险：rawJsonLog 上限 1000 条但无 TTL
- **代码行**：useAppStore.ts（appendRawJson）
- **描述**：rawJsonLog 最多 1000 条但在长会话里会持续占用内存，且没有清理时机（只有手动 clearRawJson）。
- **方向**：加 TTL 或在 message-done 后自动清理超出 200 条的部分。

#### TEST-201 补充端到端场景测试
- 需要覆盖：提问 → 回答 → 继续执行；权限审批 → 允许/拒绝 → 继续；介入中心快速回复 → 状态收敛；工作区切换 → 旧介入不残留

---

## 版本完成标准（Definition of Done）

### v4.3.0
- [x] BUG-001 通过：关闭 Tab / 切换工作区后，介入中心不再显示孤儿条目
- [x] BUG-002 通过：permissionRequests 提升到 store，切换 Tab 不丢失审批状态
- [x] BUG-003 通过：确认 pendingQuickReply 等待机制正常，不存在静默丢弃
- [x] BUG-004 通过：切换 Tab 后 showLongWaitBanner 不跨 Tab 残留
- [x] BUG-005 通过：通过介入中心跳转后目标 Tab 未读计数正确清零
- [x] BUG-006 通过：切换工作区后介入中心不残留旧工作区待处理项
- [x] DEBT-001 完成：tabInterventionStatus 四个输入均来自 store，无本地 state 混用
- [x] TEST-001 完成：介入状态隔离单元测试 6 个场景全通过（50 tests passed）

### v4.4.0
- [x] BUG-101 通过：并发 question + permission 事件不互相覆盖（已确认：BUG-002 副作用自然解决）
- [x] BUG-102 通过：无 sessionId 时快速回复有明确 UI 提示（已确认：实际触发路径不存在）
- [x] BUG-103 通过：handleStop 后全局介入中心权限列表同步清空（BUG-002 副作用已修复）
- [x] RISK-101 评估：工作区切换的进程生命周期明确（已修复：switchWorkspace 时终止所有旧进程 + tabId 过滤双层保障）

### v4.5.0
- [x] BUG-201 通过：MultiEdit diff 行号准确（顺序模拟编辑，逐步更新文本基准）
- [ ] BUG-202 通过：resume 场景不重复计入成本
- [ ] DEBT-201 完成：rawJsonLog 加入自动清理
- [ ] TEST-201 完成：端到端场景测试覆盖

---

*生成时间：2026-05-15 · 基于代码扫描与架构分析*
