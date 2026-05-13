# Claude Code GUI

为 [Claude Code CLI](https://docs.anthropic.com/claude/docs/claude-code) 提供完整图形界面的 Electron 桌面应用。

**版本：v1.9.6**

> 目标：以 Claude Code CLI 为内核，打造对标 Codex CLI Web UI 的可视化界面，结合两家之长。

---

## 功能一览

### 核心功能

#### 多标签会话（Multi-Tab）
- 点击 **+** 新建独立会话 Tab，每个 Tab 拥有独立的消息记录、连接状态和 Token 统计
- 双击 Tab 标题可重命名
- 关闭 Tab 时自动切换至相邻会话，至少保留一个 Tab

#### 聊天面板
- 实时流式输出，Markdown 渲染（GFM + 换行符 → `<br>`）
- 代码块语法高亮（highlight.js，支持数十种语言）
- 思维过程（Thinking）折叠展示
- 工具调用实时进度追踪（文件读写、Bash 执行等）
- 文件内联差异视图（InlineDiff / WritePreview / WriteDiff）
- 消息一键复制、文件附件上传（支持拖拽、Ctrl+V 粘贴图片）
- `@` 文件提及：输入 `@文件名` 快速附加文件到上下文
- `Slash` 命令补全：输入 `/` 快速选择内置命令
- 会话结束后显示 Token 用量与 USD 费用
- **继续上次会话**：工作目录栏右侧"继续上次会话"按钮，点击后下次发消息追加 `--continue`
- **消息搜索**：`Ctrl+F` 搜索历史消息内容
- **导出会话**：一键导出为 Markdown 文件

#### 终端面板
- 实时 RAF 批量写入，高频输出不卡顿
- 交互式提示自动检测与 GUI 处理（终端主题选择、语法主题选择等 CLI 初始化提示）
- ANSI 转义码解析

#### 文件浏览器
- 目录树浏览，点击查看文件内容
- 与聊天面板工作目录联动

#### 工具调用追踪
- 实时展示 Claude 正在执行的工具（Bash、Edit、Read、WebFetch 等）
- 输入参数、执行结果、时间戳可展开查看
- Diff 卡片默认展开，变更一目了然

#### Git 集成
- 实时查看工作目录 Git 状态、diff
- 支持 add / commit / push / pull 操作
- Git Worktree 管理

---

### 设置面板

#### 配置共享
- **VSCode 共享模式**：读写 `~/.claude/settings.json`，与 VSCode Claude Code 插件共享模型、权限、MCP 等设置
- **GUI 独立配置**：API Key、认证方式、代理等私有设置存储于 `userData/settings.json`

#### 快速预设
| 预设 | 模型 | 努力程度 |
|------|------|----------|
| 开发模式 | Sonnet | high |
| 强力模式 | Opus | max |
| 快速模式 | Haiku | low |

#### 模型选择
内置选项（可自定义输入任意模型名）：
- `sonnet`（推荐）、`opus`（最强）、`haiku`（最快）
- `claude-sonnet-4-6`、`claude-opus-4-7`
- `anthropic.claude-3-5-sonnet-20241022-v2:0`（AWS Bedrock）
- `anthropic/claude-3.5-sonnet`（OpenRouter）
- `meta/llama-3.1-405b-instruct`（Llama）

#### 努力程度（Effort Level）
对应 Claude Code CLI `--effort` 参数：
`low` | `medium`（默认）| `high` | `xhigh` | `max`

#### 响应语言（Language）
对应 `~/.claude/settings.json` 中的 `language` 字段，Claude 优先以指定语言回复。
留空 = 默认；可填写 `chinese`、`japanese`、`spanish`、`french` 等。

#### 权限模式（Permission Mode）
| 选项 | 说明 |
|------|------|
| `auto`（推荐）| 自动决策 |
| `acceptEdits` | 自动接受文件编辑 |
| `dontAsk` | 不询问，全部执行 |
| `plan` | 计划模式，先规划再执行 |
| `bypassPermissions` | ⚠ 绕过所有权限检查 |

#### Agent 选择
对应 CLI `--agent` 参数，从本地已安装 Agent 列表中选择（内置/自定义均支持）。

#### 工具控制
- **允许的工具**（`--tools`）：留空 = 全部，或填写 `Bash,Edit,Read`
- **禁止的工具**（`--disallowed-tools`）：例如 `Bash(git:*) WebFetch`

#### 精细权限规则（permissions.allow / deny / ask）
动态列表编辑器，分别对应 `~/.claude/settings.json` 的 `permissions.allow`、`permissions.deny`、`permissions.ask` 字段，支持 `Tool(pattern)` 格式（如 `Bash(git *)` 或 `Read(.env)`）。

#### 额外目录访问（`--add-dir`）
动态添加/删除额外可访问目录，对应 `--add-dir` 参数。

#### 思维（Thinking）设置
- **alwaysThinkingEnabled**：所有会话默认开启扩展思维，写入 `~/.claude/settings.json`
- **showThinkingSummaries**：在聊天界面展示 `<thinking>` 摘要块，写入 `~/.claude/settings.json`

#### 自动记忆（autoMemoryEnabled）
控制 Claude 是否读写 `CLAUDE.md` 记忆文件。关闭时跳过记忆目录，适合临时任务或隐私场景，写入 `~/.claude/settings.json`。

#### 最大 Agentic 轮次（`--max-turns`）
限制每次任务最多执行多少轮工具调用。留空 = 不限制（默认）。对应 CLI `--max-turns N` 参数，存储于 GUI 私有配置。

#### 环境变量（env）
键值对编辑器，写入 `~/.claude/settings.json` 的 `env` 字段，在每次 Claude 会话中注入环境变量。

#### 认证方式
| 方式 | 说明 |
|------|------|
| 官方账号（OAuth）| `claude auth login` |
| API Key | 直接填入 Anthropic API Key |
| AWS Bedrock | 填写 Region + Access Key + Secret + Session Token |
| Vertex AI | 填写 Project ID + Region |
| OpenRouter | 填写 API Key |
| LLM Gateway | Bearer Token / 自定义请求头 / 模型发现 |
| Microsoft Foundry | 填写 Resource + Base URL + API Key |

#### 系统提示（System Prompt）
- 支持追加（`--append-system-prompt`）和完全覆盖两种模式

#### 高级设置（可折叠）
- HTTP/HTTPS 代理（`--proxy`）
- API Base URL（适用于第三方接口）
- 裸模式（Bare Mode，跳过 CLI 初始化流程）
- 额外 CLI 参数（自由输入任意 `--flag value`）
- Session 名称（`--session-name`）
- 预算上限（`--max-budget-usd`）
- API Key 动态脚本（`apiKeyHelper`）

#### MCP 服务器管理
- 添加 stdio / SSE 类型 MCP 服务器
- 启用/禁用单个 MCP 服务器
- 删除服务器
- 配置同步至 `~/.claude/settings.json`
- **MCP 市场**：预设快装 + JSON 导入/导出

#### 插件管理
- 查看已安装插件列表
- 启用/禁用插件
- 安装/卸载插件

#### claude doctor / claude update
- 一键运行 `claude doctor` 诊断环境
- 一键运行 `claude update` 更新 CLI

---

### 侧边栏面板

v1.9.1 将导航精简为 **5 个 NavRail 按钮**，直达常用区域：

| 按钮 | 行为 | 映射区域 |
|------|------|----------|
| **💬 对话** | 切换至聊天主界面 | chat section |
| **📁 文件** | 直达文件浏览器（辅助面板） | project → files |
| **🔀 变更** | 直达 Git 变更摘要（辅助面板） | project → changes |
| **🔧 工具** | 展开工具面板（MCP / Agent / Hooks 等） | tools section |
| **⚙️ 配置** | 展开配置面板（设置 / 规则 / 记忆等） | config section |

> 再次点击已激活的按钮 → 折叠辅助面板，回到纯聊天模式。

---

### UI / 体验

- **明暗主题切换**：点击顶栏太阳/月亮图标切换（持久化至 localStorage）
- **CSS 设计系统**：v1.7.0 建立完整 Token 体系（字号/间距/圆角/动效变量），新增 7 个主题感知语义变量
- **可拖拽侧边栏**：鼠标拖动分隔线调整宽度（180–480px，持久化）
- **状态栏**：始终显示当前模型、认证方式、Token 用量与 USD 费用
- **交互式 CLI 提示处理**：首次启动时 CLI 要求选择终端主题，GUI 自动检测并弹出选择器
- **代码分割**：v1.7.0 主 bundle 从 765KB 拆分为 4 个 chunk（最大 283KB）

---

## 技术架构

```
Electron Main Process
  ├── cli-service.ts        # Claude CLI 进程管理（spawn / IPC）
  ├── cli-config-service.ts # ~/.claude/settings.json 读写
  ├── settings-service.ts   # userData/settings.json 读写（GUI 私有配置）
  ├── file-service.ts       # 文件系统操作
  ├── git-service.ts        # Git 操作与 Worktree 管理
  └── preload.ts            # contextBridge IPC 暴露

Renderer Process (React 19 + Vite)
  ├── App.tsx                  # 布局入口
  ├── stores/useAppStore.ts    # Zustand 全局状态（多标签、消息、会话等）
  ├── components/layout/
  │   ├── NavRail.tsx          # 左侧导航栏（v1.7.0 从 App.tsx 拆分）
  │   ├── WorkspaceArea.tsx    # 主工作区（v1.7.0 从 App.tsx 拆分）
  │   └── AuxPanel.tsx         # 辅助面板（v1.7.0 从 App.tsx 拆分）
  └── components/
      ├── ChatPanel.tsx          # 聊天主界面
      ├── SettingsPanel.tsx      # 完整设置面板
      ├── FileExplorer.tsx       # 文件浏览器
      ├── TerminalPanel.tsx      # CLI 终端输出
      ├── ToolCallView.tsx       # 工具调用详情
      ├── HistoryPanel.tsx       # 对话历史
      ├── GitPanel.tsx           # Git 集成
      ├── DiffView.tsx           # 文件差异视图
      ├── McpPanel.tsx           # MCP 管理
      ├── AgentPanel.tsx         # Agent 管理
      ├── PluginPanel.tsx        # 插件管理
      ├── HooksPanel.tsx         # Hooks 配置
      ├── RulesPanel.tsx         # 权限规则
      ├── MemoryEditPanel.tsx    # 记忆编辑
      ├── MemSearchPanel.tsx     # 记忆搜索
      ├── CheckpointPanel.tsx    # 检查点
      ├── TaskPanel.tsx          # 任务追踪
      ├── SkillsPanel.tsx        # 技能库
      ├── ChangeSummaryPanel.tsx # 变更摘要
      ├── SessionList.tsx        # 会话列表
      └── CostPanel.tsx          # 成本追踪
```

**依赖**：Electron、React 19、TypeScript、Vite、Zustand、marked、highlight.js、node-pty、lucide-react、electron-builder

**测试依赖**：Vitest、@testing-library/react、jsdom、@vitest/ui

---

## 快速开始

### 前置条件

- [Node.js](https://nodejs.org/) 18+
- [Claude Code CLI](https://docs.anthropic.com/claude/docs/claude-code)（`npm install -g @anthropic-ai/claude-code`）

### 开发模式

```bash
cd claude-code-gui
npm install
npm run electron:dev
```

启动后并发运行三个进程：
- **Vite**（端口 5185）：渲染层，支持 HMR 热更新
- **tsc --watch**：监听 `electron/*.ts`，自动增量编译到 `dist-electron/`
- **dev-with-reload**：监听 `dist-electron/*.js`，主进程文件变化时自动重启 Electron

> 主进程热重载有 3 秒冷却期（防止 tsc 初始编译误触发），冷却期后修改 `electron/` 下任意 `.ts` 文件保存即可触发自动重启。

### 单元测试

```bash
# 单次运行（CI 模式）
npm test

# 监听模式（TDD）
npm run test:watch

# 浏览器 UI 模式
npm run test:ui
```

测试框架：[Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) + jsdom

### 生产打包

```bash
npm run dist
```

生成 `release/Claude Code GUI Setup <version>.exe`（Windows）。

---

## 配置说明

| 配置文件 | 路径 | 说明 |
|----------|------|------|
| CLI 共享配置 | `~/.claude/settings.json` | 模型、权限、MCP、语言等，与 VSCode 插件共享 |
| GUI 私有配置 | `%APPDATA%/claude-code-gui/settings.json` | API Key、认证方式、代理等 |

---

## Changelog

### v2.0.1 — 快捷键一览面板
- **`?` 键唤起**：当焦点不在输入框时，按 `?` 键即可打开/关闭快捷键面板
- **快捷键 Modal**：居中浮层，列出全部快捷键（Ctrl+F/O/T/W/V、Ctrl+Enter、Esc、?），支持 Esc 或点击背景关闭
- **Glassmorphism 风格**：模糊背景蒙层 + 圆角卡片 + `border-bottom: 2px` kbd 按键样式，与整体设计语言一致
- **入场动画**：浮层 `fadeIn`（0.18s）+ 卡片 `scale+translateY`（0.2s）弹入效果

### v2.0.0 — 全局顶栏进度条（streaming 状态感知）
- **实时进度条**：处于 streaming 状态时，顶栏下方出现 2px 紫色渐变进度条，模拟真实进度（30%→88% 缓增，完成后冲至 100% 再淡出）
- **流畅动画**：`progressShimmer` shimmer 动效 + `cubic-bezier(0.1,0.4,0.3,1)` 缓动，完成后 450ms 淡出消失
- **按 tab 隔离**：进度条状态绑定当前激活 tab，多 tab 并行时互不干扰

### v1.9.9 — 视效与动效全面升级
- **Streaming 闪烁光标**：assistant 消息流式输出时，正文末尾出现闪烁竖线光标（`streamCursor` / `cursorBlink` 动画），与 thinking 块光标风格一致，生成状态一目了然
- **Tab 面板淡入**：切换会话 Tab 时，ChatPanel 整体通过 `msgFadeIn` 动画（200ms ease-out）平滑淡入，消除突兀切换感
- **按钮点击微缩**：所有带 `-btn` / `-button` class 的按钮在 `:active` 时轻微缩放 0.93x（80ms ease），提供即时触感反馈；NavRail 按钮保持自有变换
- **工具调用状态颜色过渡**：`.tool-call-status` 新增 `color transition 0.3s ease`，pending→running→done 状态颜色渐变而非突变
- **消息入场动画确认**：`msgFadeIn`（translateY 10px→0 + opacity）已全面覆盖消息气泡与 ChatPanel 容器，切换/新消息均有入场动效

### v1.9.8 — Light Theme 全面适配（Markdown + 语法高亮）
- **hljs 亮色 token 颜色**：`[data-theme="light"]` 下覆盖 github.css 的全部 token 颜色（关键字红 `#d73a49`、函数紫 `#6f42c1`、字符串深蓝 `#032f62`、注释灰等），从暗色 GitHub Dark 平滑切换
- **Markdown 行内代码亮色**：亮色模式下行内代码改为 `#0550ae` 蓝色 + 浅灰背景，与正文区分明显
- **blockquote / 标题分割线亮色**：降低透明度，在浅色背景下保持适当对比度
- **代码块头部亮色**：`.code-block-header` 改用 `rgba(0,0,0,0.03)` 亮色背景，与代码内容区自然分隔

### v1.9.7 — Markdown 渲染质量全面提升
- **语法高亮颜色修复**：`highlight.js` 主题（`github-dark`）已正确引入，代码块关键字、字符串、注释颜色均正常显示
- **标题层级拉大**：`h1` 带下划线（1.4em）、`h2` 带浅分割线（1.2em）、`h3/h4` 逐级收窄，信息层次更清晰
- **列表嵌套样式完善**：嵌套 `ul/ol` 独立 margin，列表项间距调整为 0.3em，marker 颜色用 accent 色标识
- **表格防溢出**：`renderer.table` 为所有 markdown 表格外层加 `.table-wrapper`（`overflow-x: auto`），宽表格横向滚动而非破坏布局
- **blockquote 升级**：左紫色边框 + 浅紫背景 + 斜体，引用段落视觉层次明显
- **行内代码样式**：蓝色高亮（`#79c0ff`）+ 淡边框 + 等宽字体，与代码块区分明确
- **hljs 背景覆盖**：`.hljs` 背景强制使用 `var(--code-bg)`，保持整体色调一致

### v1.9.6 — Ctrl+O 全局 Thinking 展开/折叠
- **Ctrl+O 快捷键**：一键展开或折叠当前聊天中所有 thinking 块，无需逐条操作
- **`thinkingOverride` prop**：全局 override 优先于各消息的独立展开状态；用户手动点击单条 thinking 按钮时，仍维持该消息的独立控制
- 逻辑：第一次 Ctrl+O → 全部展开；再次 → 全部折叠；反复切换

### v1.9.5 — TurnCard 执行进度可视化增强
- **实时进度条**：TurnCard 头部下方增加薄进度条，随已完成步骤数动态推进（带 transition 动画），颜色按绿/黄/红三态跟随执行状态
- **时间线样式步骤列表**：步骤项改为竖线 + 圆形节点连接，清晰展示执行路径，视觉层次更接近 VSCode Claude Code 插件体验
- **运行中节点脉动动画**：执行中的步骤节点持续脉动（`turnNodePulse`），配合轻紫背景高亮，当前执行位置一目了然
- **步骤计数徽章**：标题行改为 `执行中 · 3/5 工具` 格式，实时展示完成进度

### v1.9.4 — 会话列表标题优化 + Context 指示器
- **会话列表智能标题**：`SessionList` 对会话第一条消息自动格式化——去掉 `@文件引用` 和代码块，取第一行非空内容（≤40 字），会话可读性大幅提升
- **Context Window 使用量指示器**：输入栏右端显示当前上下文占用百分比（绿 / 黄 / 红三色进度条，基于 200k limit），直观感知会话剩余容量
- **`content-visibility: auto` 性能优化**：消息气泡使用 CSS 原生延迟渲染，长对话滚动帧率显著改善，零侵入无需虚拟列表

### v1.9.3 — Thinking 实时流式展示
- **MessageBubble 流式 thinking**：Claude 思考期间，thinking 块自动展开，左侧紫色脉动边框指示进行中，末尾光标闪烁
- **底部 typing-indicator 优化**：等待回复时显示最后一行 thinking 内容摘要，替代纯"Claude 正在生成"文字
- **自动滚动跟随**：thinking 内容区超出 240px 时，JS `scrollTop` 驱动自动跟随到最新行
- **computeNavTransition 纯函数 + 测试**：NavRail 导航逻辑提取为可测函数，新增 15 个导航单元测试，总测试用例达 34 个

### v1.9.2 — Phase 4 首次启动引导 + Phase 5 工程稳态
- **Onboarding 引导**：首次启动时在聊天空状态展示功能介绍卡片（5 大功能 + 直达设置按钮），完成后写入 localStorage 不再重复显示
- **Vitest 测试体系**：引入 Vitest + Testing Library，添加 `computeLineDiff`（8 用例）和 `useAppStore`（11 用例）单元测试，19 用例全绿
- **`npm test`**：新增 test / test:watch / test:ui 脚本

### v1.9.1 — Phase 4 导航直达
- **文件 / 变更直达导航**：NavRail 将 "项目" 拆为独立的 **📁 文件** 和 **🔀 变更** 两个按钮，单击直达对应辅助面板
- **NavRail 折叠逻辑**：再次点击已激活按钮 → 收起辅助面板，回到纯聊天视图

### v1.9.0 — API 配置文件自动重启
- API Key 多档配置文件切换后 CLI 进程自动重启，无需手动停止再启动
- 配置文件增删改命名，支持设置默认文件

### v1.8.x — 功能完善
- `--disallowed-tools` 工具黑名单支持
- LLM Gateway / Microsoft Foundry 认证模式
- 系统提示（追加 / 覆盖）配置支持
- API 配置文件多档管理初始实现

### v1.7.0 — UI 重构
- **导航精简**：18 项 → 5 项（chat/project/tools/config/history），消除导航噪声
- **App.tsx 拆分**：拆分为 NavRail / WorkspaceArea / AuxPanel 三个 layout 组件
- **CSS 设计系统重构**：建立完整 Token 体系，新增 7 个主题感知语义变量
- **Diff 卡片优化**：文件修改工具 Diff 默认展开，操作按钮提升至卡片头部
- **代码分割**：`vite.config.ts` 添加 `manualChunks`，主 bundle 从 765KB 拆分为 4 个 chunk
- **视觉精修**：NavRail 左侧指示条 + CSS tooltip，消息气泡动画，输入框精修

### v1.6.0
- **工具审批修复**：GUI 中工具审批按钮无法真正批准/拒绝的问题已修复
- **非交互审批链路**：切换为 Claude Code 官方 `--permission-prompt-tool` + MCP 工具桥接
- **Windows 安装包**：生成并验证 `Claude Code GUI Setup 1.6.0.exe`

### v1.5.0
- **成本追踪面板**：Token 历史、成本统计、7 天图表
- **权限规则面板**：支持 allow/deny/ask 可视化编辑和预设模板
- **Hooks 配置面板**：HTTP headers、allowedEnvVars、mcp_tool input JSON 编辑
- **Git Worktree 管理面板**
- **MCP 服务器市场**：预设快装 + JSON 导入/导出
- **插件管理 GUI**：Plugin Panel（安装/卸载/启用/禁用）

### v1.4.0
- **`--continue`**：聊天面板新增"继续上次会话"按钮
- **`--max-turns`**：设置面板新增最大 Agentic 轮次输入框
- **`showThinkingSummaries`**：设置面板新增思维摘要显示开关
- **`alwaysThinkingEnabled`**：设置面板新增全局扩展思维开关
- **`autoMemoryEnabled`**：设置面板新增自动记忆开关
- **`env`**：设置面板新增环境变量键值对编辑器
- **`permissions.allow/deny/ask`**：设置面板新增精细权限规则动态列表

### v1.3.x
- 多标签 Tab 系统，每个 Tab 独立会话状态与 Token 统计
- Tab 重命名支持
- 修复设置面板 xhigh effort 级别缺失
- 新增 `bypassPermissions` 权限模式选项
- 新增响应语言（`language`）设置字段

### v1.2.x
- 对话历史持久化（localStorage）
- 历史记录搜索与排序
- claude doctor / claude update 一键执行

### v1.1.x
- MCP 服务器内联管理
- Agent 面板
- Git 集成面板
- 差异视图（InlineDiff / WriteDiff）

### v1.0.x
- 初始版本：聊天、终端、文件浏览器、设置面板
