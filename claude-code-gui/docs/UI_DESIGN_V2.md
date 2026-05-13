# Claude Code GUI — UI 重构设计文档 v2.0

> 本文档遵循第一性原则驱动设计：先拆解用户核心任务，再推导最小必要界面结构，最后定义实现规范。

---

## 一、第一性原则分析

### 1.1 事实（Facts）

| # | 事实 |
|---|---|
| F1 | 用户的唯一内核是 Claude Code CLI，GUI 不增加任何 AI 能力 |
| F2 | 用户 90% 时间在执行任务：发消息 → 看执行过程 → 确认结果 |
| F3 | 当前导航项 18 个，但真正高频的只有：对话、文件、Git、设置 |
| F4 | 工具调用详情（Diff、步骤）在独立面板，用户需要频繁跳转 |
| F5 | 当前 App.tsx 870+ 行，无组件级 CSS 隔离，维护困难 |

### 1.2 被质疑的假设（Challenged Assumptions）

| 假设 | 质疑 | 结论 |
|---|---|---|
| "需要 18 个导航项" | 大部分功能属于管理类，极低频 | 折叠为 5 个一级入口 |
| "侧边栏切换面板是主流" | IDE 侧边栏切换会让主内容区被替换 | 对话流永远是主区域，工具面板为辅助层 |
| "玻璃态是设计亮点" | 过度的 blur + 半透明叠加，性能负担且视觉噪音高 | 减少滥用，仅在浮层/Modal 中使用 |
| "多面板 = 功能强大" | 功能暴露过多 = 认知负担，新用户失焦 | 默认只暴露核心路径，高级功能进入二级 |

### 1.3 推导（Reasoning）

1. **对话流是核心路径** → 主区域 100% 给对话，不可被其他面板替换
2. **工具调用结果属于对话上下文** → 内联嵌入对话流，不跳出
3. **文件/Git/配置属于辅助上下文** → 右侧可折叠面板，不影响主流程
4. **18 个导航项中 14 个是低频管理功能** → 归并为一级入口下的二级页签

### 1.4 结论（Conclusion）

**三区布局 + 对话永置主区 + 辅助面板按需展开**

---

## 二、信息架构（IA）

```
Claude Code GUI
├── 对话区（永置主区，flex: 1）
│   ├── 标签栏（多会话）
│   ├── 消息流
│   │   ├── 用户消息气泡
│   │   ├── Assistant 消息
│   │   │   ├── 文本内容
│   │   │   ├── 工具调用卡片（内联，可折叠）
│   │   │   │   ├── Bash 执行
│   │   │   │   ├── 文件读/写 + Diff
│   │   │   │   └── 权限审批横幅
│   │   │   └── Turn 汇总卡片（步骤统计/成本/回滚）
│   │   └── 系统消息（连接状态/错误）
│   ├── 输入区
│   │   ├── 文本输入框（多行，支持 Shift+Enter）
│   │   ├── 附件/截图按钮
│   │   └── 发送按钮 + 连接状态指示
│   └── 顶部工具栏
│       ├── 工作目录选择器
│       ├── 连接/断开按钮
│       └── 辅助面板切换按钮组
│
├── 辅助面板区（右侧，可折叠，280~480px）
│   ├── 文件树（FileExplorer）
│   ├── Git 面板（status / diff / log）
│   ├── 终端（TerminalPanel，底部抽屉 or 右侧）
│   └── 快照/回滚（CheckpointPanel）
│
└── 导航栏（左侧，48px，图标+tooltip）
    ├── 对话（Chat）          ← 默认激活
    ├── 项目（Project）       ← 打开右侧文件树+Git
    ├── 工具（Tools）         ← MCP / Agents / Plugins / Hooks / Skills
    ├── 配置（Config）        ← 设置 / Rules / CLAUDE.md
    └── 历史（History）       ← 历史会话 / 成本 / 记忆搜索
        └── 主题切换 + 帮助（底部固定）
```

---

## 三、核心交互流程

### 3.1 主流程：发送任务 → 看执行 → 确认结果

```
用户输入
    ↓
消息出现在对话流（打字机效果）
    ↓
工具调用卡片内联展开（Bash/Read/Write）
    ↓
  ┌─ Write/Edit → 内联展示 Diff（接受/拒绝操作在卡片内）
  ├─ Bash → 展示命令 + 折叠输出
  └─ 权限审批 → 消息流内横幅（Allow/Deny 按钮）
    ↓
Turn 汇总卡片（步骤数 / token / 耗时 / 一键回滚）
    ↓
用户继续输入下一轮
```

### 3.2 辅助流程：查看文件/Git

```
点击导航"项目"
    ↓
右侧面板展开（不影响对话流宽度，对话区略微收窄）
    ↓
  ┌─ 文件树：单击预览，双击打开编辑器/在对话流引用
  └─ Git：status / diff / commit（对话流同步变更摘要）
```

### 3.3 多会话流程

```
顶部标签栏 → 点击新增 (+) → 新 Tab 独立会话状态
双击标签 → 内联重命名
拖拽标签 → 排序
右键标签 → 关闭 / 复制路径
```

---

## 四、布局规范

### 4.1 整体布局网格

```
┌────────────┬──────────────────────────────────┬──────────────────┐
│ 导航栏     │         对话区（主区域）           │   辅助面板        │
│            │                                  │  （按需展开）     │
│  48px      │           flex: 1                │   0 or 280~480px │
│  固定宽    │           最小宽 480px            │   可拖拽调整      │
│            ├──────────────────────────────────┤                  │
│            │  标签栏  36px                    │                  │
│            │  工具栏  48px                    │                  │
│            │  消息流  flex: 1 overflow: auto  │                  │
│            │  输入区  max 200px               │                  │
└────────────┴──────────────────────────────────┴──────────────────┘
```

### 4.2 消息流宽度约束

| 场景 | 最大宽度 |
|---|---|
| 只有对话区（无辅助面板） | `min(900px, 100% - 64px)` |
| 辅助面板展开 | `min(820px, 100% - 64px)` |
| 对话内容居中 | `margin: 0 auto` |

### 4.3 辅助面板展开行为

- **展开方式**：Push（对话区收窄），不使用 Overlay（避免遮挡对话流）
- **宽度范围**：280px ~ 480px，`localStorage` 持久化
- **关闭方式**：再次点击导航图标，或面板内 ✕ 按钮
- **默认状态**：收起（`width: 0`，无渡 `transition: width 200ms ease`）

---

## 五、组件清单

### 5.1 布局层组件

| 组件名 | 职责 | 当前对应 |
|---|---|---|
| `AppShell` | 三区布局容器，管理辅助面板开关状态 | `App.tsx` 布局部分 |
| `NavRail` | 左侧 48px 导航栏，5 个一级图标 | `App.tsx` navItems |
| `SessionTabBar` | 多会话标签条，支持新增/关闭/重命名/拖拽 | `App.tsx` + `TabBar.tsx` |
| `AuxPanel` | 右侧辅助面板容器，管理子面板切换 | `App.tsx` sidebar |
| `ResizeHandle` | 辅助面板拖拽调整宽度 | `App.tsx` |

### 5.2 对话层组件

| 组件名 | 职责 | 当前对应 |
|---|---|---|
| `ConversationView` | 消息流列表容器 + 自动滚底 | `ChatPanel.tsx` |
| `MessageBubble` | 单条消息外壳（用户/助手/系统区分） | `ChatPanel.tsx` 内部 |
| `AssistantMessage` | 助手消息：文本 + 工具卡片 + Turn 汇总 | `ChatPanel.tsx` 内部 |
| `ToolCallCard` | 单个工具调用卡片（折叠/展开） | `ToolCallView.tsx` |
| `DiffBlock` | 内联 Diff 展示 + 接受/拒绝操作 | `DiffView.tsx` |
| `PermissionBanner` | 权限审批横幅（内联于消息流） | `App.tsx` |
| `TurnSummaryCard` | Turn 结束汇总卡片（步骤/成本/回滚） | `ChatPanel.tsx` 内部 |
| `MessageInput` | 多行输入框 + 附件 + 发送控制 | `ChatPanel.tsx` 内部 |
| `TopBar` | 工作目录 + 连接控制 + 辅助面板切换 | `App.tsx` 顶部区域 |

### 5.3 辅助面板组件

| 组件名 | 职责 | 当前对应 |
|---|---|---|
| `FileTreePanel` | 文件浏览器（辅助面板子页） | `FileExplorer.tsx` |
| `GitStatusPanel` | Git status + diff + commit | `GitPanel.tsx` |
| `TerminalDrawer` | 底部抽屉式终端（可选） | `TerminalPanel.tsx` |
| `CheckpointDrawer` | 文件快照 + 一键回滚 | `CheckpointPanel.tsx` |

### 5.4 管理页面（导航二级）

| 导航入口 | 子页 |
|---|---|
| 工具（Tools） | MCP 服务器 / Agents / Plugins / Hooks / Skills |
| 配置（Config） | 设置 / Rules / CLAUDE.md / Worktrees |
| 历史（History） | 会话列表 / 成本追踪 / 记忆搜索 |

---

## 六、设计系统

### 6.1 颜色系统

#### 语义化颜色变量（精简版）

```css
:root {
  /* ── 背景层级（3层，去除多余层级） ── */
  --bg-app:         #08080f;   /* App 根背景 */
  --bg-surface:     #0f0f1e;   /* 面板/卡片背景 */
  --bg-elevated:    #16162a;   /* 悬浮/选中状态 */

  /* ── 边框 ── */
  --border:         rgba(255,255,255,0.07);
  --border-strong:  rgba(255,255,255,0.14);

  /* ── 文字 ── */
  --text-1:         #f0f0ff;   /* 主要文本 */
  --text-2:         #8890aa;   /* 次要文本 */
  --text-3:         #4a5068;   /* 禁用/placeholder */

  /* ── 强调色 ── */
  --accent:         #7c3aed;   /* 主品牌色（紫） */
  --accent-light:   #a78bfa;   /* 悬停/激活 */
  --accent-blue:    #3b82f6;   /* 信息/链接 */

  /* ── 状态色 ── */
  --success:        #22c55e;
  --warning:        #f59e0b;
  --error:          #ef4444;

  /* ── 工具调用类型色 ── */
  --tool-bash:      #f59e0b;   /* Bash 命令 */
  --tool-write:     #22c55e;   /* 写文件 */
  --tool-read:      #3b82f6;   /* 读文件 */
  --tool-edit:      #a78bfa;   /* 编辑文件 */
}
```

#### 亮色主题覆盖

```css
[data-theme="light"] {
  --bg-app:         #f8f8fc;
  --bg-surface:     #ffffff;
  --bg-elevated:    #f0f0f8;
  --border:         rgba(0,0,0,0.07);
  --border-strong:  rgba(0,0,0,0.14);
  --text-1:         #1a1a2e;
  --text-2:         #5a6080;
  --text-3:         #9aa0b8;
}
```

### 6.2 字体系统

```css
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;

  /* 字号阶梯 */
  --text-xs:   11px;
  --text-sm:   12px;
  --text-base: 14px;
  --text-md:   15px;
  --text-lg:   16px;
  --text-xl:   18px;

  /* 行高 */
  --leading-tight:  1.4;
  --leading-normal: 1.6;
  --leading-loose:  1.8;
}
```

### 6.3 间距系统

使用 4px 基准网格：

| Token | 值 | 用途 |
|---|---|---|
| `--space-1` | 4px | 图标内边距、标签间距 |
| `--space-2` | 8px | 按钮内边距（小） |
| `--space-3` | 12px | 列表项内边距 |
| `--space-4` | 16px | 卡片内边距（标准） |
| `--space-5` | 20px | 区块间距 |
| `--space-6` | 24px | 大区块间距 |

### 6.4 圆角系统

```css
:root {
  --radius-sm:  4px;   /* 标签、chip */
  --radius-md:  8px;   /* 按钮、输入框 */
  --radius-lg:  12px;  /* 卡片、面板 */
  --radius-xl:  16px;  /* 大卡片 */
  --radius-full: 9999px; /* 圆形按钮、徽标 */
}
```

### 6.5 阴影系统

```css
:root {
  /* 仅用于浮层，不用于内嵌卡片 */
  --shadow-sm:  0 1px 4px rgba(0,0,0,0.4);
  --shadow-md:  0 4px 16px rgba(0,0,0,0.5);
  --shadow-lg:  0 12px 40px rgba(0,0,0,0.7);
}
```

> **原则**：内嵌卡片用 `border` 区分层级，`box-shadow` 只给浮层（Tooltip / Modal / Dropdown）

### 6.6 动效规范

```css
:root {
  --duration-fast:   100ms;   /* 悬停高亮 */
  --duration-normal: 200ms;   /* 面板展开/收起 */
  --duration-slow:   300ms;   /* 页面级过渡 */
  --ease-out:  cubic-bezier(0.0, 0.0, 0.2, 1.0);
  --ease-in:   cubic-bezier(0.4, 0.0, 1.0, 1.0);
  --ease-inout: cubic-bezier(0.4, 0.0, 0.2, 1.0);
}
```

---

## 七、关键组件规范

### 7.1 NavRail（左侧导航栏）

```
宽度：48px，固定
背景：var(--bg-app) + border-right: 1px solid var(--border)
不使用 backdrop-filter（避免性能损耗）

图标按钮状态：
  默认：color: var(--text-3)，background: transparent
  悬停：color: var(--text-2)，background: var(--bg-elevated)
  激活：color: var(--accent-light)，background: rgba(124,58,237,0.15)
       left border: 2px solid var(--accent)

徽标：右上角，min-width: 16px，var(--accent)背景

固定在底部：主题切换按钮
```

### 7.2 SessionTabBar（标签栏）

```
高度：36px
单个 Tab：
  最大宽度：180px
  内边距：0 12px
  激活：border-bottom: 2px solid var(--accent)
  关闭按钮：仅悬停 Tab 时出现（opacity 过渡）
  
新建按钮：+ 号，悬停高亮
```

### 7.3 ToolCallCard（工具调用卡片）

```
样式：
  左边框：4px solid var(--tool-{type})
  背景：var(--bg-surface)
  圆角：var(--radius-md)
  内边距：12px 16px

状态区域（顶部）：
  工具图标 + 工具名 + 运行状态 chip
  折叠/展开 chevron（点击整行切换）

折叠时：只显示顶部状态行（高度约 40px）
展开时：显示参数/输出/Diff 内容

Diff 区域（Write/Edit 类工具）：
  内联显示（不跳出到 DiffView 面板）
  接受按钮（绿色）/ 拒绝按钮（红色）在 Diff 底部
  操作后按钮消失，显示操作结果状态
```

### 7.4 MessageInput（输入区）

```
容器：
  border-top: 1px solid var(--border)
  padding: 12px 16px
  background: var(--bg-app)

文本框：
  min-height: 48px，max-height: 200px
  auto-resize（根据内容高度）
  border-radius: var(--radius-md)
  background: var(--bg-surface)
  border: 1px solid var(--border)
  focus: border-color: var(--accent)

快捷键：
  Enter → 发送
  Shift+Enter → 换行
  Ctrl+K → 清空输入
  ↑ → 历史消息回填

底部工具栏（输入框外部，不内嵌）：
  左侧：附件 / 截图 / @提及
  右侧：发送按钮 + 状态指示（loading/connected）
```

### 7.5 TurnSummaryCard（Turn 汇总卡片）

```
在每个 Assistant 消息末尾展示（当 Turn 完成时）
样式：
  background: var(--bg-elevated)
  border: 1px solid var(--border)
  border-radius: var(--radius-md)
  padding: 10px 14px
  font-size: var(--text-sm)
  
内容：
  左侧：步骤数（N 步完成）+ 工具调用计数
  中间：Token 用量 + 预估成本
  右侧：一键回滚按钮（仅当有 Checkpoint 时显示）
```

---

## 八、导航归并方案

### 当前 18 项 → 5 个一级导航

| 一级导航 | 对应原面板 | 展示方式 |
|---|---|---|
| 💬 对话 | chat | 主区域（默认） |
| 📁 项目 | files, git, changes, worktrees, checkpoints | 右侧辅助面板（子标签切换） |
| 🔧 工具 | mcp, agents, plugins, hooks, skills, tasks | 右侧辅助面板（子标签切换） |
| ⚙️ 配置 | settings, rules, claude-md | 右侧辅助面板（子标签切换） |
| 📜 历史 | history, mem, cost | 右侧辅助面板（子标签切换） |

### 辅助面板内部子标签

**项目面板：**
```
[文件树] [Git] [变更] [Worktree] [快照]
```

**工具面板：**
```
[MCP] [Agents] [Plugins] [Hooks] [Skills] [任务]
```

**配置面板：**
```
[设置] [权限规则] [CLAUDE.md]
```

**历史面板：**
```
[会话历史] [记忆搜索] [成本]
```

---

## 九、实现路线图

### Phase 1：导航收缩（最小改动，最大认知改善）

- [ ] 将 18 个 navItems 归并为 5 个一级入口
- [ ] 辅助面板内增加子标签切换
- [ ] 设置面板迁移到辅助面板（而非替换主区域）
- [ ] 验证：新用户首次使用不迷失

**预计改动量**：App.tsx + 各面板调整，约 2~3 天

### Phase 2：工具调用内联

- [ ] `ToolCallCard` 增加内联 Diff 展示
- [ ] Diff 内增加接受/拒绝操作按钮
- [ ] 操作结果反馈到对话流
- [ ] `TurnSummaryCard` 内增加一键回滚

**预计改动量**：DiffView + ToolCallCard + 状态联动，约 3~4 天

### Phase 3：设计系统统一

- [ ] 将 index.css 中颜色变量精简为本文档规范
- [ ] 移除过度使用的 `backdrop-filter`
- [ ] 统一间距/圆角 token
- [ ] 优化消息流 Wireframe（宽度约束 / 气泡 / 头像）

**预计改动量**：CSS 重构 + 各组件调整，约 2~3 天

### Phase 4：App.tsx 拆分

- [ ] 提取 `AppShell` 布局组件
- [ ] 提取 `NavRail` 组件
- [ ] 提取 `TopBar` 组件
- [ ] 提取 `AuxPanel` 容器组件
- [ ] `App.tsx` 目标：≤ 200 行

**预计改动量**：纯重构，约 1~2 天

---

## 十、风险与约束

| 风险 | 等级 | 应对 |
|---|---|---|
| 辅助面板收起后原有面板状态丢失 | 中 | 保持组件 mount，用 CSS `display:none` 隐藏而非 unmount |
| 工具调用卡片内联 Diff 后高度过大 | 中 | 默认折叠，点击展开；Diff 最大高度 400px + 滚动 |
| 现有 `useAppStore` 中 `activePanel` 语义变化 | 低 | 新增 `activeAuxPanel` 状态，兼容现有 `activePanel` |
| CSS 变量重命名影响所有组件 | 高 | 先只新增变量，逐步迁移，保留旧变量作为别名 |

---

*文档版本：v2.0-draft*  
*创建日期：2026-05-11*  
*负责人：Claude Code GUI Team*
