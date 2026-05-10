# Claude Code GUI

为 [Claude Code CLI](https://docs.anthropic.com/claude/docs/claude-code) 提供完整图形界面的 Electron 桌面应用。

**版本：v1.4.0**

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
- 消息一键复制、文件附件上传
- 会话结束后显示 Token 用量与 USD 费用
- **继续上次会话**：工作目录栏右侧"继续上次会话"按钮，点击后下次发消息追加 `--continue`，自动接续上一次 CLI 会话

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

#### 系统提示（System Prompt）
- 支持追加（`--append-system-prompt`）和完全覆盖两种模式

#### 高级设置（可折叠）
- HTTP/HTTPS 代理（`--proxy`）
- API Base URL（适用于第三方接口）
- 裸模式（Bare Mode，跳过 CLI 初始化流程）
- 额外 CLI 参数（自由输入任意 `--flag value`）
- Session 名称（`--session-name`）
- 预算上限（`--max-budget-usd`）

#### MCP 服务器管理（设置面板内联）
- 添加 stdio / SSE 类型 MCP 服务器
- 启用/禁用单个 MCP 服务器
- 删除服务器
- 配置同步至 `~/.claude/settings.json`

#### claude doctor / claude update
- 一键运行 `claude doctor` 诊断环境
- 一键运行 `claude update` 更新 CLI

---

### 侧边栏面板

| 面板 | 功能 |
|------|------|
| **聊天** | 主对话界面 |
| **文件** | 目录树与文件内容预览 |
| **工具** | 本次会话所有工具调用历史 |
| **历史** | 对话历史记录（localStorage 持久化，最多 50 条），支持搜索、排序、重新加载 |
| **技能** | Claude Code 内置技能/斜杠命令参考 |
| **任务** | TodoWrite 工具实时任务追踪 |
| **Git** | 工作目录 Git 状态、diff |
| **变更摘要** | 本次会话文件变更汇总 |
| **记忆搜索** | 搜索 Claude 记忆文件 |
| **CLAUDE.md** | 项目级 CLAUDE.md 文件编辑 |
| **检查点** | 会话检查点管理 |
| **MCP** | MCP 服务器状态与管理 |
| **Agent** | Agent 列表与运行状态 |

---

### UI / 体验

- **明暗主题切换**：点击顶栏太阳/月亮图标切换（持久化至 localStorage）
- **可拖拽侧边栏**：鼠标拖动分隔线调整宽度（180–480px，持久化）
- **状态栏**：始终显示当前模型、认证方式、Token 用量与 USD 费用
- **交互式 CLI 提示处理**：首次启动时 CLI 要求选择终端主题，GUI 自动检测并弹出选择器，无需切换到终端

---

## 技术架构

```
Electron Main Process
  ├── cli-service.ts        # Claude CLI 进程管理（spawn / IPC）
  ├── cli-config-service.ts # ~/.claude/settings.json 读写
  ├── settings-service.ts   # userData/settings.json 读写（GUI 私有配置）
  ├── file-service.ts       # 文件系统操作
  └── preload.ts            # contextBridge IPC 暴露

Renderer Process (React 19 + Vite)
  ├── App.tsx               # 布局、主题、标签栏、侧边栏导航
  ├── stores/useAppStore.ts # Zustand 全局状态（多标签、消息、会话等）
  └── components/
      ├── ChatPanel.tsx         # 聊天主界面
      ├── SettingsPanel.tsx     # 完整设置面板
      ├── FileExplorer.tsx      # 文件浏览器
      ├── TerminalPanel.tsx     # CLI 终端输出
      ├── ToolCallView.tsx      # 工具调用详情
      ├── HistoryPanel.tsx      # 对话历史
      ├── GitPanel.tsx          # Git 集成
      ├── DiffView.tsx          # 文件差异视图
      ├── McpPanel.tsx          # MCP 管理
      ├── AgentPanel.tsx        # Agent 管理
      ├── MemoryEditPanel.tsx   # 记忆编辑
      ├── MemSearchPanel.tsx    # 记忆搜索
      ├── CheckpointPanel.tsx   # 检查点
      ├── TaskPanel.tsx         # 任务追踪
      ├── SkillsPanel.tsx       # 技能库
      ├── ChangeSummaryPanel.tsx# 变更摘要
      └── SessionList.tsx       # 会话列表
```

**依赖**：Electron、React 19、TypeScript、Vite、Zustand、marked、highlight.js、node-pty、lucide-react、electron-builder

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

### v1.4.0
- **`--continue`**：聊天面板新增"继续上次会话"按钮，点击后下次发消息追加 `--continue`
- **`--max-turns`**：设置面板新增最大 Agentic 轮次输入框，对应 CLI `--max-turns N`
- **`showThinkingSummaries`**：设置面板新增思维摘要显示开关，写入 `~/.claude/settings.json`
- **`alwaysThinkingEnabled`**：设置面板新增全局扩展思维开关，写入 `~/.claude/settings.json`
- **`autoMemoryEnabled`**：设置面板新增自动记忆开关，控制 CLAUDE.md 读写
- **`env`**：设置面板新增环境变量键值对编辑器，写入 `~/.claude/settings.json` `env` 字段
- **`permissions.allow/deny/ask`**：设置面板新增精细权限规则动态列表，支持 Tool(pattern) 格式
- 版本升级至 1.4.0

### v1.3.1
- 修复设置面板 xhigh effort 级别缺失
- 新增 `bypassPermissions` 权限模式选项
- 新增响应语言（`language`）设置字段
- 修复 package.json description 字段编码问题

### v1.3.0
- 多标签 Tab 系统，每个 Tab 独立会话状态与 Token 统计
- Tab 重命名支持

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
```
