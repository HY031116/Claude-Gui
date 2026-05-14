# Changelog

所有版本的变更记录。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

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
