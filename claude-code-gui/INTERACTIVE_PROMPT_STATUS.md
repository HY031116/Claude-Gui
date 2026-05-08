# Claude Code GUI 交互式提示功能状态报告

## 日期
2026-05-09

## 功能目标
将 Claude CLI 的交互式终端提示（如首次启动的主题选择）转换为 GUI 弹窗选项，提升用户体验。

---

## 已实现的功能

### 1. 交互式提示检测 ✅
- **文件**: `src/App.tsx`
- **功能**: 自动检测终端输出中的交互式提示（如主题选择、语法主题选择）
- **检测模式**:
  - `Choose the text style` → 主题选择弹窗
  - `Syntax theme` / `Monokai` → 语法主题弹窗
- **防抖机制**: 1.5秒延迟检测，避免过早触发
- **重复防止**: 使用 `Set` 记录已解决的提示，避免重复弹窗

### 2. GUI 弹窗组件 ✅
- **文件**: `src/App.tsx`
- **功能**: 检测到提示后显示模态弹窗，包含选项列表
- **样式**: 居中显示，圆角，阴影，半透明背景遮罩
- **选项显示**: 每个选项显示编号圆圈 + 标签

### 3. 弹窗选择处理 ✅
- **文件**: `src/App.tsx`
- **流程**:
  1. 用户点击选项 → `handlePromptSelect(value)`
  2. 记录提示为已解决
  3. 关闭弹窗 (`setPendingPrompt(null)`)
  4. 清空输出缓冲区
  5. 显示状态弹窗（"已自动填入...请按回车确认"）

---

## 当前问题 ❌

### 核心问题 1：终端输入框未显示填入的值
**现象**:
- 弹窗显示"已自动填入"1"到终端输入框"
- 但终端面板底部的输入框仍显示"输入命令..."，没有显示"1"

**原因**:
- 曾尝试通过 Zustand store 的 `pendingTerminalInput` 状态传递值
- 但用户后续改动（添加 conversationHistory 功能）覆盖了该字段
- 当前 store 中无 `pendingTerminalInput` 字段
- TerminalPanel 也未监听任何自动填入机制

### 核心问题 2：PTY 输入无法驱动 readline 交互式提示（根本限制）
**问题**: 即使终端输入框正确显示值并按回车，PTY `write()` 在 Windows 上无法驱动 readline 交互式提示

**根因**:
- Claude CLI 使用 inquirer/readline 处理交互式提示
- 这些库依赖 `keypress` 事件（模拟真实键盘按键）
- Windows ConPTY 的 `write()` 只是将字符写入 stdin，**不会触发 keypress 事件**
- 这是 node-pty 在 Windows 上的架构限制

**验证**:
```
[CLI] Writing to PTY: "1\r\n"
[CLI] Write call completed
```
→ 发送后无任何新的 `onData` 输出，证明输入未被处理

---

## 已尝试但失效的解决方案

### 方案 1: 直接通过 cliSend 发送
- 弹窗点击后直接调用 `window.electronAPI.cliSend(value)`
- **结果**: 后端日志显示写入成功，但前端无响应

### 方案 2: 通过 CustomEvent 传递
- 弹窗派发 `cli:autofill` 事件到 TerminalPanel
- **结果**: 事件监听器可能未正确建立，输入框未更新

### 方案 3: 通过 Zustand Store 共享状态（被覆盖）
- 使用 `useAppStore` 的 `pendingTerminalInput` 状态
- TerminalPanel 通过 `useEffect` 监听并调用 `setInput()`
- **状态**: 实现代码曾被用户后续改动（conversationHistory 功能）覆盖，当前不存在

---

## 代码现状（2026-05-09）

### useAppStore.ts
- `pendingPrompt` / `setPendingPrompt` ✅ 存在
- `pendingTerminalInput` / `setPendingTerminalInput` ❌ 被 conversationHistory 覆盖
- `conversationHistory` / `addOrUpdateConversation` / `clearConversationHistory` ✅ 用户新增

### TerminalPanel.tsx
- `pendingTerminalInput` 监听 `useEffect` ❌ 不存在
- 纯展示组件，无自动填入逻辑

### App.tsx
- `handlePromptSelect` 中通过 store 设置 pendingTerminalInput ❌ 已失效
- 弹窗显示和检测逻辑 ✅ 存在

---

## 下一步建议

### 选项 1：恢复并修复自动填入功能
1. 在 store 中重新添加 `pendingTerminalInput` 字段（不覆盖 conversationHistory）
2. 在 TerminalPanel 中添加 `useEffect` 监听该字段
3. 在 App.tsx 的 `handlePromptSelect` 中通过 store 设置值
4. 仍需面对根本问题：PTY 输入在 Windows 上无法驱动 readline

### 选项 2：绕过交互式提示（推荐务实方案）
1. 在启动 Claude CLI 时始终添加 `--bare` 参数
2. `--bare` 模式会跳过所有交互式向导（主题选择、语法主题等）
3. 用户通过设置面板手动配置偏好
4. 优点：100%可靠，无需处理交互式提示

### 选项 3：使用 Windows API 发送真实键盘事件
1. 在 Electron 主进程中使用 `node-gyp` 调用 `SendInput` API
2. 模拟真实键盘按键发送到 PTY 窗口
3. 优点：readline 能正确接收
4. 缺点：复杂度极高，需原生模块，焦点管理困难

### 选项 4：预先配置 Claude CLI 设置
1. 在 `~/.claude/` 目录下创建配置文件
2. 预设主题选择等设置，完全绕过首次启动向导
3. 需要研究 Claude CLI 的配置文件格式

---

## 相关文件

| 文件 | 功能 |
|------|------|
| `src/App.tsx` | 弹窗检测、显示、选择处理 |
| `src/stores/useAppStore.ts` | 状态管理（pendingPrompt, conversationHistory） |
| `src/components/TerminalPanel.tsx` | 终端输入框（无自动填入逻辑） |
| `src/types/index.ts` | CliPrompt, CliPromptOption 类型定义 |
| `electron/cli-service.ts` | PTY 进程管理、send() 方法 |

---

## 调试日志

Electron 主进程日志输出到启动时的终端。

关键日志标记：
- `[App]` - 前端 App.tsx 日志
- `[CLI]` - 后端 cli-service.ts 日志
- `[TerminalPanel]` - 终端面板组件日志
