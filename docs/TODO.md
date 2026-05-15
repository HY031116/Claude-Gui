# Claude Code GUI — Bug 追踪 TODO（v4.3.0 → v4.5.0）

> 版本目标：聚焦"交互与状态同步"稳定化，不追加大功能。  
> 标签格式：`[BUG]` 已知缺陷 · `[RISK]` 潜在风险 · `[DEBT]` 技术债 · `[TEST]` 需补测试

---

## v4.3.0 — 状态一致性修复版

### 🔴 优先级 P0：必须修复（阻断核心功能）

#### BUG-001 closeTab / switchWorkspace 不清理介入孤儿状态
- **文件**：`src/stores/useAppStore.ts` — `closeTab` `switchWorkspace`
- **根因**：`pendingDecisionRequests`、`pendingFileRequests`、`pendingQuickReplies` 按 tabId 存入 store，但 `closeTab` 只删快照不清这三张表；`switchWorkspace` 只重置 `processingTabs` / `tabInterventionStatus` / `tabUnreadCounts`，也不清理。
- **后果**：关闭 Tab 或切换工作区后，孤儿状态残留 → 介入中心误显示已不存在的 Tab 的决策/文件请求 → 用户点击无响应。
- **修复位置**：`closeTab` 在删快照的同时删三个 map 的对应 key；`switchWorkspace` 在 set 时额外清空 `pendingDecisionRequests` / `pendingFileRequests` / `pendingQuickReplies`。
- **代码行**：useAppStore.ts:289–315（closeTab） · useAppStore.ts:630–640（switchWorkspace 的 set block）

#### BUG-002 permissionRequests 双状态源 — ChatPanel 本地 vs 全局介入中心
- **文件**：`src/components/ChatPanel.tsx`（L383–384） · `src/App.tsx`（L165–166）
- **根因**：`permissionRequests` 同时存在于 ChatPanel 本地 `useState` 和 App.tsx 的 React state，两者都监听 `permission-request` 事件。当前台 Tab 收到审批请求时，两处都会更新；但 ChatPanel 本地状态不随 Tab 切换保留，导致切换 Tab 后介入中心里的权限条目仍在但 ChatPanel 本地已重置，执行审批后状态不同步。
- **后果**：切换 Tab 再切回来 → ChatPanel 的 permissionRequests 被清空 → `tabInterventionStatus` 计算出错 → Tab 徽章状态与介入中心实际显示不一致。
- **修复方向**：将 `permissionRequests` 提升到 store（类似 `pendingDecisionRequests`），ChatPanel 改为从 store 读取当前 Tab 的权限列表，`App.tsx` 全局监听后也写入 store。
- **代码行**：ChatPanel.tsx:390 · App.tsx:165 · useAppStore.ts:211–213

#### BUG-003 message-done 时不清理 pendingDecisionRequest / pendingFileRequest
- **文件**：`src/components/ChatPanel.tsx`（L738–744）
- **根因**：`message-done` 事件触发时，代码清空了 `permissionRequests`（L744），但没有清空 `pendingDecisionRequests[tabId]` 和 `pendingFileRequests[tabId]`（这两个是在 `message-done` 之后才设置的，所以没有清空问题）。  
  **真正问题**：用户从介入中心发出快速回复（`sendQuickReply`）之后，`pendingDecision` / `pendingFileRequest` 在 store 里已经置 null，但如果 `isProcessing=true` 导致 `sendQuickReply` 被跳过，快速回复的 text 就丢失了。
- **后果**：介入中心点击"自主决定"或"无需提供继续"，如果恰好 Claude 在生成中（虽然不应该但可能发生竞态），动作被静默丢弃，用户无任何反馈。
- **修复方向**：`pendingQuickReply` 的 useEffect 在 `isProcessing=true` 时不应丢弃，而应等待 `isProcessing` 变 false 后重新触发；或在下发快速回复时先检查 `isProcessing` 并在介入中心 UI 上给出"正在等待 Claude 完成，稍后将自动回复"的提示。
- **代码行**：ChatPanel.tsx:899–902（pendingQuickReply useEffect）· App.tsx:334–339（handleQuickReplyAction）

---

### 🟡 优先级 P1：应在本版修复（影响体验正确性）

#### BUG-004 Tab 切换时 showLongWaitBanner 不重置
- **文件**：`src/components/ChatPanel.tsx`（L392）
- **根因**：`showLongWaitBanner` 是 ChatPanel 的本地 useState，共享同一个 ChatPanel 实例（所有 Tab 渲染同一个 ChatPanel）。当从 Tab A（正在等待）切换到 Tab B，长时等待横幅会继续显示，即使 Tab B 已经空闲。
- **后果**：切换 Tab 后误显示"已超过 45 秒无新输出"横幅，干扰用户。
- **修复方向**：监听 `activeTabId` 变化时重置 `showLongWaitBanner`；或将其提升到 store 按 Tab 保存（类似 tabInterventionStatus）。
- **代码行**：ChatPanel.tsx:392 · ChatPanel.tsx:318–333（isProcessing + interval useEffect）

#### BUG-005 handleFocusQuestion 重复调用 setActiveTab 后 App.tsx 和 WorkspaceArea 状态竞争
- **文件**：`src/App.tsx`（L316–325）
- **根因**：`handleFocusQuestion` 里调用 `store.setActiveTab(tabId)` 后又调用 `setActiveNavSection('dispatch')`，但 `setActiveNavSection` 触发的 re-render 与 `setActiveTab` 同帧，有可能 WorkspaceArea 中的 `setActiveTab` 触发的 markTabRead 未能及时执行。
- **后果**：通过介入中心跳转到目标 Tab 时，该 Tab 的未读计数可能没有被清零（markTabRead 只在 WorkspaceArea 的点击事件里调用）。
- **修复方向**：`setActiveTab` 内部自动 markTabRead，不依赖 UI 点击事件。
- **代码行**：useAppStore.ts:320–345（setActiveTab） · WorkspaceArea.tsx:255

#### BUG-006 工作区切换后全局 questionRequests / permissionRequests 不重置
- **文件**：`src/App.tsx`（L162–166）
- **根因**：`questionRequests` 和 `permissionRequests` 是 `App.tsx` 的 React 本地 state，切换工作区后不会被清空，导致上个工作区的待处理提问和权限审批仍然显示在介入中心。
- **后果**：切换工作区后，介入中心残留旧工作区的待处理项，用户操作会发送到错误的 CLI 进程。
- **修复方向**：监听 `activeWorkspacePath` 变化，变化时清空 `questionRequests` / `permissionRequests`；或将这两个状态也提升到 store 并在 `switchWorkspace` 时清空。
- **代码行**：App.tsx:162–166 · useAppStore.ts:630–640（switchWorkspace 的 set block）

---

### 🟢 优先级 P2：技术债 / 可观测性（本版可选，下版必选）

#### DEBT-001 Tab 介入状态计算依赖 ChatPanel 副作用，不是单一来源
- **描述**：`tabInterventionStatus` 由 ChatPanel 的 useEffect 写入（L397–401），同时又要读 `permissionRequests`（本地 state）、`pendingDecision`（store）、`pendingFileRequest`（store）、`showLongWaitBanner`（本地 state），混合两种来源。
- **影响**：当 Tab 切换导致 ChatPanel 重新挂载或数据清空，这个 useEffect 可能算出"无介入"而误清除实际存在的介入状态。
- **方向**：将 `tabInterventionStatus` 的计算逻辑收到 store 的 derived state 或 selector，由 store 自己根据 `pendingDecisionRequests` 、`pendingFileRequests`、`processingTabs` 等单一数据源推导。

#### DEBT-002 permissionRequests 的清理时机分散在 5 处
- **代码行**：ChatPanel.tsx:744（message-done）· L781（message-error）· L1144（handleStop）· L556 + L563（permission-resolved 事件）
- **描述**：权限请求的清理分布在 5 个地方，任何一处遗漏都可能残留。提升到 store 后可统一管理清理逻辑。

#### TEST-001 缺少 Tab 切换后状态验证测试
- **位置**：`src/test/` 或 `src/stores/useAppStore.test.ts`
- **描述**：当前测试文件存在但覆盖面不清楚，需要补充：Tab 切换后各 pendingXxx 状态是否正确隔离；关闭 Tab 后孤儿状态是否清除；工作区切换后是否不带入旧介入。

---

## v4.4.0 — 会话可靠性修复版

> 以下 TODO 依赖 v4.3.0 完成后再执行，避免在不稳定基础上修复上层问题。

#### BUG-101 AskUserQuestion 并发与 permission-request 同时到达时互相覆盖
- **描述**：`App.tsx` 的 `onCliOutput` 监听同时处理 `question-request` 和 `permission-request`，但两类事件的写入目标不同（question → React state，permission → React state），当两者同 tick 到达时可能有 setState batch 问题。
- **方向**：统一两种请求的事件消费路径，用队列或 store action 串行写入。

#### BUG-102 sendQuickReply 缺少 conversationSessionId 守卫
- **代码行**：ChatPanel.tsx:876（sendQuickReply 里的 cliSendMessage 调用）
- **描述**：`sendQuickReply` 使用 `session.conversationSessionId || undefined`，如果会话尚未建立（首条消息还未收到 session_id）就触发快速回复，会以无 sessionId 的方式发送，可能开启新对话而不是延续当前上下文。
- **方向**：在 sendQuickReply 中检查 sessionId 是否存在，不存在时给出 UI 提示"当前会话尚未建立，无法快速回复"。

#### BUG-103 handleStop 后 permissionRequests 清空但全局介入中心不清
- **代码行**：ChatPanel.tsx:1144（handleStop 里的 setPermissionRequests）
- **描述**：手动停止生成时，ChatPanel 本地 `setPermissionRequests([])` 会清空，但 `App.tsx` 的全局 `permissionRequests` state 不会被更新，导致介入中心仍显示已过期的审批请求。
- **方向**：将 permissionRequests 提升到 store（BUG-002 修复后自然解决）。

#### RISK-101 后台 Tab 的 CLI 进程在工作区切换时是否被正确清理
- **描述**：切换工作区时，前工作区的 Tab 的 CLI 会话进程没有显式终止。如果该进程仍在运行并发出 permission-request，会被 App.tsx 的全局监听器接收并写入新工作区的介入中心。
- **方向**：switchWorkspace 时向 electron 主进程发送"停止当前所有 tab 的 CLI 进程"信号，或至少在 UI 层过滤 tabId 不属于当前工作区的事件。

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
- [ ] BUG-001 通过：关闭 Tab / 切换工作区后，介入中心不再显示孤儿条目
- [ ] BUG-002 通过：permissionRequests 提升到 store，切换 Tab 不丢失审批状态
- [ ] BUG-003 通过：介入中心下发快速回复时，isProcessing=true 场景有明确反馈而非静默丢弃
- [ ] BUG-004 通过：切换 Tab 后 showLongWaitBanner 不跨 Tab 残留
- [ ] BUG-005 通过：通过介入中心跳转后目标 Tab 未读计数正确清零
- [ ] BUG-006 通过：切换工作区后介入中心不残留旧工作区待处理项

### v4.4.0
- [ ] BUG-101 通过：并发 question + permission 事件不互相覆盖
- [ ] BUG-102 通过：无 sessionId 时快速回复有明确 UI 提示
- [ ] BUG-103 通过：handleStop 后全局介入中心权限列表同步清空
- [ ] RISK-101 评估：工作区切换的进程生命周期明确

### v4.5.0
- [ ] BUG-201 通过：MultiEdit diff 行号准确
- [ ] BUG-202 通过：resume 场景不重复计入成本
- [ ] DEBT-201 完成：rawJsonLog 加入自动清理
- [ ] TEST-201 完成：端到端场景测试覆盖

---

*生成时间：2026-05-15 · 基于代码扫描与架构分析*
