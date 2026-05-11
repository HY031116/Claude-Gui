# Claude Code 功能全览

> 基于官方文档 https://code.claude.com/docs 整理，时间：2026-05-10

---

## 一、核心定位

Claude Code 是一个**代理式编码工具（Agentic Coding Tool）**，能够：
- 读取整个代码库，理解多文件上下文
- 编辑文件、运行命令
- 与开发工具链集成
- 自主完成任务，不只是辅助补全

运行环境：终端 CLI、VS Code、JetBrains、桌面应用、Web 浏览器、移动设备

---

## 二、使用界面

| 界面 | 说明 |
|------|------|
| **终端 CLI** | 功能最完整，直接在项目目录运行 `claude` |
| **VS Code 插件** | 内联 diff、`@` 文件引用、计划审查、快捷键 |
| **JetBrains 插件** | 支持 IntelliJ、PyCharm、WebStorm 等 |
| **桌面应用** | 并行 Session、拖拽布局、内置终端/编辑器、侧边栏聊天、应用预览 |
| **Web 应用** | 云端运行，无需本地安装，连接 GitHub 仓库直接提 PR |
| **移动端** | 通过 claude.ai 或 Claude iOS App 在手机继续本地 Session |

---

## 三、代理循环（Agentic Loop）

Claude Code 的核心工作模式：

```
接收任务 → 读取文件/运行命令 → 推理 → 执行工具 → 返回结果 → 循环直到完成
```

**内置工具：**
- 文件读写（Read/Write/Edit/MultiEdit）
- Shell 命令执行（Bash）
- 代码搜索（Grep、Glob）
- Web 内容获取
- 图片分析
- 子代理派发（Task）

---

## 四、记忆与上下文（Memory）

### CLAUDE.md
- 每次 Session 自动加载，作为持久上下文
- 放置位置：项目根目录、子目录、用户主目录 `~/.claude/`
- 用途：编码规范、构建命令、项目结构说明、"永远不要做 X"
- **最佳实践**：控制在 200 行以内，超出内容移到 Skills

### 规则文件（Rules）
- 存放于 `.claude/rules/` 目录
- 支持 frontmatter `paths` 字段，按文件路径按需加载（节省上下文）
- 比 CLAUDE.md 更细粒度

### 自动记忆（Auto Memory）
- Claude 主动将学到的项目知识写入 `~/.claude/` 下的记忆文件
- 无需手动维护

### @文件引用
- 在对话中 `@src/utils/auth.js` 直接引入文件内容
- `@src/components/` 引入目录结构
- `@github:repos/owner/repo/issues` 引入 MCP 资源

---

## 五、权限模式（Permission Modes）

| 模式 | 行为 |
|------|------|
| **auto** | 自动判断安全性，自动执行低风险操作 |
| **plan** | 只读文件、输出计划，不做任何修改（审查后再执行）|
| **acceptEdits** | 自动接受文件编辑，命令执行仍需确认 |
| **dontAsk** | 完全自主，不询问 |

- CLI：`Shift+Tab` 切换模式
- 启动时：`claude --permission-mode plan`
- Auto 模式支持细粒度规则：`allowRules` / `denyRules`（硬拒绝）

---

## 六、扩展功能

### 6.1 Skills（技能）
- Markdown 文件，包含知识、工作流或指令
- 存放于 `.claude/skills/`
- 用法：
  - 用 `/deploy` 等斜杠命令触发
  - Claude 根据任务描述自动匹配加载
  - 在 Subagent 的 `skills:` 字段预加载
- 控制可见性：`disable-model-invocation: true` → 仅手动触发

**内置 Skills（Bundled Skills）：**
`/simplify` `/batch` `/debug` `/ultraplan` `/ultrareview` `/powerup` `/loop` `/autofix-pr` `/team-onboarding` `/usage` 等

### 6.2 Subagents（子代理）
- 隔离上下文的独立 Worker，执行结束后只返回摘要
- 用途：大规模文件读取、并行任务、专项工作
- 定义位置：`.claude/agents/`
- 可预加载特定 Skills

**自定义字段：**
```yaml
---
name: security-reviewer
description: 专职安全代码审查
model: claude-sonnet-4-6
skills:
  - security-checklist
---
```

### 6.3 Agent Teams（代理团队）⚠️ 实验性
- 多个独立 Claude Code Session 协同工作
- 共享任务列表，支持点对点消息传递
- 适合：并行代码审查、大型功能开发、竞争性假设验证

### 6.4 Hooks（钩子）
- 在生命周期事件上自动触发 Shell 脚本、HTTP 请求、LLM Prompt 或 Subagent
- **Hook 事件：**

| 事件 | 时机 |
|------|------|
| `PreToolUse` | 工具调用前（可阻断） |
| `PostToolUse` | 工具调用后 |
| `SessionStart` | Session 开始 |
| `SessionEnd` | Session 结束 |
| `Prompt` | 用户提交 Prompt 时 |
| `Notification` | Claude 需要用户输入时 |
| `PostCompact` | 上下文压缩后 |

- **典型用例：** 保存后自动 ESLint/Prettier、阻止 `rm -rf /`、发送 Slack 通知、记录日志、在 Stop hook 中要求当前闭环后继续推进明确的最小下一步

### 6.5 MCP（Model Context Protocol）
- 连接外部服务：数据库、Slack、浏览器、GitHub、Jira 等
- 配置位置：`~/.claude/settings.json` 的 `mcpServers`
- 支持 stdio、SSE 两种传输类型
- 支持大规模 Tool Search（自动发现相关工具）

### 6.6 Plugins（插件）
- 将 Skills、Hooks、Subagents、MCP 服务器打包为可分发单元
- Plugin Skills 自动命名空间化（如 `/my-plugin:review`）
- 支持从 `.zip` 文件或 URL 加载
- 支持 **Plugin Marketplace**（团队/社区分发）

---

## 七、常用工作流

### 代码库探索
```text
give me an overview of this codebase
explain the main architecture patterns
trace the login process from front-end to database
```

### 修复 Bug
```text
I'm seeing an error when I run npm test
suggest a few ways to fix the @ts-ignore in user.ts
```

### 重构代码
```text
find deprecated API usage in our codebase
refactor utils.js to use ES2024 features while maintaining the same behavior
```

### 编写测试
```text
find functions in NotificationsService.swift that are not covered by tests
add test cases for edge conditions in the notification service
```

### 创建 PR
```text
create a pr
enhance the PR description with more context about the security improvements
```
- 创建 PR 后 Session 自动与该 PR 绑定，`claude --from-pr <number>` 可恢复

### 生成文档
```text
find functions without proper JSDoc comments in the auth module
add JSDoc comments to the undocumented functions in auth.js
```

---

## 八、会话管理（Sessions）

| 命令 | 说明 |
|------|------|
| `claude --continue` | 恢复当前目录最近一次会话 |
| `claude --resume` | 选择历史会话 |
| `/resume` | Session 内打开选择器 |
| `claude --from-pr <number>` | 从 PR 恢复关联 Session |
| `Ctrl+R` | 跨项目搜索命令历史 |

---

## 九、并行 Session（Worktrees）

```bash
claude --worktree feature-auth      # 新建独立分支 worktree 并启动 Session
claude --worktree feature-auth --base-branch main  # 基于 main 分支
```

- 多个终端并行工作，互不干扰
- 支持从远程默认分支创建 worktree

---

## 十、计划模式（Plan Mode）

```bash
claude --permission-mode plan
```

- Claude 只读文件、分析、输出计划，**不执行任何修改**
- 适合：大型重构前的方案审查
- 计划可在文本编辑器中修改后再执行

---

## 十一、检查点（Checkpointing）

- 自动记录每次文件修改前的状态
- 可随时回滚到任意历史状态
- 对话和文件变更可独立回滚
- CLI 命令：`/checkpoint`、`/rewind`

---

## 十二、定时任务与自动化

| 方案 | 运行位置 | 适用场景 |
|------|---------|---------|
| **Routines** | Anthropic 云基础设施 | 机器关机时也需运行；支持 API 触发、GitHub 事件触发 |
| **Desktop 定时任务** | 本机 | 需访问本地文件/工具 |
| **GitHub Actions** | CI 流水线 | 与仓库事件绑定 |
| **`/loop`** | 当前 CLI Session | Session 内轮询 |

---

## 十三、CI/CD 集成

### GitHub Actions
- 在 PR 上自动运行 Claude Code
- 代码审查、Bug 修复、Issue 分类

### GitHub Code Review
- 每个 PR 自动进行多代理代码审查
- 检测逻辑错误、安全漏洞、回归问题

### GitLab CI/CD
- 集成 GitLab 流水线

---

## 十四、高级功能

### 快速模式（Fast Mode）
- 切换到更快的 Haiku 模型响应速度
- 适合不需要深度推理的简单任务

### 扩展思考（Extended Thinking）
- 使用更多思考 Token，更复杂的推理
- 可配置 `effortLevel`：`low` / `medium` / `high` / `max` / `xhigh`（Opus 4.7+）

### Computer Use（计算机操控，macOS）
- Claude 直接控制屏幕：打开应用、点击、输入
- 适合：GUI 测试、视觉 Bug 调试、无 API 工具自动化

### Chrome 集成（Beta）
- 连接 Chrome 浏览器
- 功能：测试 Web 应用、读取控制台日志、自动填表、页面数据提取

### 声音输入（Voice Dictation）
- 在 CLI 中语音输入 Prompt
- 支持按住录音（hold-to-record）和点击录音（tap-to-record）

### Ultraplan（云端规划）
- `/ultraplan` 在云端起草计划，回到终端执行
- 适合：大型功能规划

### Ultrareview（深度代码审查）
- `/ultrareview` 启动多代理云端代码审查
- 查找并验证合并前的 Bug

### Remote Control（远程控制）
- 从手机/平板/任意浏览器继续本地 Session
- 无需 SSH，通过 claude.ai/code 接入

### Channels（事件推送）
- 通过 MCP 服务器向运行中的 Session 推送消息
- 支持 Telegram、Discord、iMessage、Webhook、CI 结果
- Claude 可在后台自动响应事件

### Deep Links（深度链接）
- `claude-cli://` URL 协议，点击直接打开指定仓库的 Claude Code
- 嵌入 Runbook、告警、Dashboard

### 全屏渲染（Fullscreen Rendering）
- 更流畅无闪烁的渲染模式
- 支持鼠标，长对话稳定内存占用

### 沙箱执行（Sandboxing）
- Bash 工具的文件系统和网络隔离
- 更安全的自主代理执行

---

## 十五、输出格式控制

### 流式 JSON 输出
```bash
claude --print --output-format stream-json
```
输出 `assistant` / `tool_result` / `session_end` 事件，适合程序集成。

### 非交互（Headless）模式
```bash
echo "总结最近20条提交" | claude -p
git log --oneline -20 | claude -p "summarize these recent commits"
```
适合 CI、pre-commit 钩子、批处理脚本。

### 输出样式（Output Styles）
- 适配软件工程之外的用途（写作、数据分析等）

---

## 十六、Agent SDK

用于将 Claude Code 作为库集成到自定义应用中：

| 功能 | 说明 |
|------|------|
| **Python SDK** | 完整 API，支持所有 Claude Code 特性 |
| **TypeScript SDK** | 完整 API，支持流式输出 |
| **自定义工具** | 通过内置 MCP 服务器定义函数 |
| **文件检查点** | 跟踪并回滚文件变更 |
| **Hook** | 在关键执行点拦截和控制行为 |
| **Subagents** | 并行独立任务 |
| **结构化输出** | JSON Schema / Zod / Pydantic 校验返回 |
| **会话管理** | continue / resume / fork |
| **OpenTelemetry** | 可观测性追踪 |
| **成本追踪** | Token 用量和费用统计 |

---

## 十七、企业功能

| 功能 | 说明 |
|------|------|
| **管理员设置** | 集中配置、权限管控、使用监控 |
| **服务端托管设置** | 无需设备管理基础设施，统一下发配置 |
| **Analytics 仪表盘** | 团队用量指标、工程速度追踪 |
| **网络配置** | 代理服务器、自定义 CA、mTLS |
| **零数据保留（ZDR）** | Enterprise 计划，数据不落盘 |
| **GitHub Enterprise Server** | 自托管 GHE 集成 |
| **LLM Gateway** | 接入企业 LLM 网关 |
| **开发容器（devcontainer）** | 团队统一隔离环境 |

---

## 十八、云提供商支持

| 提供商 | 支持 |
|--------|------|
| Anthropic 原生 | 默认，API Key 或 OAuth |
| Amazon Bedrock | IAM 配置 |
| Google Vertex AI | GCP IAM 配置 |
| Microsoft Azure Foundry | Azure 配置 |
| 第三方 API（OpenRouter 等）| `apiBaseUrl` + `apiKey` |

---

## 十九、配置体系

### 文件层级（优先级从高到低）
```
Managed（企业下发）
  → User（~/.claude/settings.json）
    → Project（.claude/settings.json）
      → Plugin
```

### 主要配置项
```json
{
  "model": "sonnet",
  "permissionMode": "auto",
  "effortLevel": "high",
  "apiKey": "...",
  "apiBaseUrl": "...",
  "httpProxy": "...",
  "mcpServers": { ... },
  "enabledPlugins": { ... }
}
```

### 环境变量（部分）
- `ANTHROPIC_API_KEY`
- `CLAUDE_MODEL`
- `HTTPS_PROXY` / `HTTP_PROXY`
- `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR`

---

## 二十、安全性

- **权限模式**：细粒度控制工具调用权限
- **允许/拒绝规则**：白名单/黑名单控制文件和命令访问
- **沙箱执行**：文件系统和网络隔离
- **Prompt 注入防护**：内置检测机制
- **审计日志**：所有操作可追踪
- **企业合规**：SOC 2、GDPR 等认证（见 Legal 页面）

---

## 二十一、功能选择速查

| 需求 | 推荐功能 |
|------|---------|
| 每次都需要的项目规范 | CLAUDE.md |
| 按需加载的参考文档或工作流 | Skills |
| 大量文件读取，不想污染主上下文 | Subagent |
| 多路并行复杂任务 | Agent Teams |
| 每次编辑后自动格式化 | Hook（PostToolUse） |
| 阻止危险命令 | Hook（PreToolUse，硬拒绝） |
| 连接 Slack/数据库/浏览器 | MCP |
| 跨仓库复用同一套配置 | Plugin |
| 在不改文件的情况下审查方案 | Plan Mode |
| 回滚误操作 | Checkpointing |
| 无人值守定时任务 | Routines |
| 手机继续桌面任务 | Remote Control |

---

> 官方文档：https://code.claude.com/docs  
> 完整 CLI 参考：https://code.claude.com/docs/en/cli-reference.md  
> 工具参考：https://code.claude.com/docs/en/tools-reference.md  
> 更新日志：https://code.claude.com/docs/en/changelog.md
