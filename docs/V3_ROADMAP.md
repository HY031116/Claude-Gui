# Claude Code GUI 3.0 路线图

> 目标：从「单次会话工具」升级为「持续工作空间」——让用户的每次 Claude 对话都能被记录、检索、跨项目复用。

---

## 一、版本定位

### 三代演进逻辑

| 版本 | 核心主题 | 已解决的根本问题 |
|------|----------|-----------------|
| v1.x | 能用 | PTY 连接 Claude CLI、工具调用可视化 |
| v2.x | 好用 | Turn 工作流、可操作 Diff、HomeView、自动更新 |
| **v3.0** | **持续工作** | **会话历史持久化、多项目工作区、工作流连续性** |

### 第一性原则推导

**事实**：
1. 每次重启 App 后，所有对话历史消失，用户必须重新建立上下文
2. 切换工作目录等同于切换项目，但没有"项目"记忆层
3. Claude 的能力越强，每次会话的价值越高，丢失成本越大

**推导**：
- 持久化不是「加功能」，而是补上「会话即一次性消费」的根本缺陷
- 多项目管理不是 UI 便利功能，而是防止「工作目录混淆」的安全边界
- 3.0 不应继续堆叠 Turn 内的交互能力，而应解决「Turn 之间」的连续性断层

### 不做的事（3.0 边界）

- 云同步 / 团队协作（架构复杂度太高）
- 插件市场深化
- 多模型并行对比（超出单 CLI 代理范围）
- 语音输入（依赖外部 API）

---

## 二、阶段路线图

### Phase 1：会话历史持久化 ⭐ 最高优先

**目标**：重启 App 后，历史对话可恢复。

**技术方案**：
- 使用 Electron `userData` 目录下的 JSON 文件（每个会话一个文件，避免 SQLite 依赖）
- 保存内容：`messages[]`、`tokenHistory[]`、`workingDirectory`、`sessionId`、`createdAt`、`title`（自动从首条消息生成）
- 会话列表页（复用 `HistoryView` 或新增 `SessionLibrary` 组件）展示历史会话摘要

**涉及改动**：
- `electron/file-service.ts` — 新增 `saveSession / loadSession / listSessions / deleteSession` 方法
- `electron/main.ts` — 新增 IPC handler `session:save` / `session:load` / `session:list`
- `electron/preload.ts` — 暴露对应 API
- `src/stores/useAppStore.ts` — 会话结束时触发保存；加载历史会话时恢复 messages
- `src/components/task/HomeView.tsx` — 「最近会话」区块展示最近 5 条历史（已有 `conversationHistory` 预留位）

**完成标准**：
1. 关闭 App 再打开，首屏显示最近 5 条历史会话，点击可恢复对话内容
2. 历史会话文件存储于 `userData/sessions/*.json`，大小合理（images 不存储，只存文本）

---

### Phase 2：多项目工作区

**目标**：每个项目有独立的会话历史、工作目录、设置偏好快照。

**技术方案**：
- 工作区 = 一个工作目录 + 其下的所有会话历史
- `userData/workspaces.json` 记录已知工作区列表（path, name, lastUsed, sessionCount）
- 打开项目时从工作区选择器选择，或拖拽目录到 App 创建新工作区
- `HomeView` 工作目录显示改为可点击跳转工作区切换

**涉及改动**：
- `electron/settings-service.ts` — 新增 `workspaces` 管理
- `src/components/task/HomeView.tsx` — 「工作目录」区域改为「工作区选择器」
- `src/components/WorkspaceSelector.tsx` — 新建组件：最近工作区列表 + 新建/打开目录

**完成标准**：
1. 首屏展示最近工作区列表，点击一键切换目录 + 载入对应会话历史
2. 不同工作区的会话历史互不干扰

---

### Phase 3：全局对话搜索

**目标**：跨会话全文检索历史对话内容和文件变更记录。

**技术方案**：
- 前端搜索（不依赖后端索引）：遍历 `userData/sessions/*.json`，对 `content` 字段做正则匹配
- 搜索结果按时间倒序展示，高亮匹配片段
- 快捷键 `Ctrl+Shift+F` 打开全局搜索

**涉及改动**：
- `src/components/GlobalSearch.tsx` — 新建组件
- `electron/file-service.ts` — 新增 `searchSessions(query)` 方法

**完成标准**：
1. 能在所有历史会话中搜索关键词，1 秒内返回结果（本地文件，速度有保障）

---

### Phase 4：会话导出

**目标**：把对话记录导出为可分享、可归档的格式。

**方案**：
- 导出 Markdown：消息流 → 标准 Markdown（代码块保留、工具调用折叠展示）
- 导出 HTML：带样式的静态页面，可直接用浏览器打开
- 入口：会话标题右键菜单 → 「导出」

**完成标准**：
1. 导出的 Markdown 文件在 GitHub/Obsidian 中可正常渲染

---

## 三、版本计划

| 版本 | 内容 | 核心交付 |
|------|------|----------|
| **v3.0.0** | Phase 1：会话历史持久化 | 重启后历史可恢复 |
| **v3.1.0** | Phase 2：多项目工作区 | 工作区切换 |
| **v3.2.0** | Phase 3：全局搜索 | 跨会话检索 |
| **v3.3.0** | Phase 4：会话导出 | Markdown / HTML 导出 |

---

## 四、当前最小下一步

**v3.0.0 Phase 1 — 启动实现**：

1. `electron/file-service.ts` 新增 `saveSession / loadSession / listSessions` 三个方法
2. `electron/main.ts` 注册对应 IPC handler
3. `electron/preload.ts` 暴露 API
4. `src/stores/useAppStore.ts` 在 `stopSession` 时触发 `session:save`
5. `HomeView.tsx` 「最近会话」区块改为从持久化读取，点击可恢复

预计改动量：~250 行，风险低（纯新增，不破坏现有路径）。

---

`*文档版本：v1.0*`  
`*创建时间：2026-05-14*`
