export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  /** 当前消息对应回合的步骤快照，用于在对话流中保留执行历史 */
  planSteps?: PlanStep[];
  /** Claude 的扩展思考链内容（extended thinking 模式下可用） */
  thinking?: string;
  /** Turn 执行结束摘要（步骤数/token/耗时），仅 assistant 消息携带 */
  turnSummary?: {
    toolCallCount: number;
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
    durationMs?: number;
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  status: 'pending' | 'success' | 'error';
  /** Write 工具执行前的原始文件内容快照（用于 diff 展示） */
  originalContent?: string;
  /** Diff 审阅状态：accepted 为已确认，reverted 为已回滚 */
  diffReviewStatus?: 'accepted' | 'reverted';
}

/** 实时执行步骤（对标 Codex turn/plan/updated） */
export interface PlanStep {
  id: string;          // tool_use id
  toolName: string;    // 原始工具名
  label: string;       // 人类可读标签（工具类型）
  description: string; // 关键参数摘要（文件路径、命令内容等）
  status: 'running' | 'done' | 'error';
}

export interface DirEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modified: string;
}

export interface TerminalLine {
  id: string;
  type: 'stdout' | 'stderr' | 'exit' | 'system';
  content: string;
  timestamp: number;
}

export interface SessionState {
  isConnected: boolean;
  workingDirectory: string;
  pid?: number;
  /** 当前多轮对话的 session ID，用于 --resume 继续上下文 */
  conversationSessionId?: string;
}

/** 历史会话记录（持久化到 localStorage） */
export interface ConversationRecord {
  sessionId: string;
  workingDirectory: string;
  /** 第一条用户消息的前 100 个字符，作为会话预览 */
  preview: string;
  /** 会话开始时间（首条消息时间戳） */
  startedAt: number;
  /** 最后更新时间（每次收到 result.session_id 时刷新） */
  lastMessageAt: number;
}

/** 工作区（多项目工作区切换） */
/** 工作区切换时的 tabs 完整快照（每个工作区独立保持自己的会话历史） */
export interface WorkspaceTabsSnapshot {
  tabs: Array<{ id: string; label: string }>;
  activeTabId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tabSnapshots: Record<string, any>;
}

export interface Workspace {
  id: string;
  name: string;    // 显示名（默认 = path basename）
  path: string;    // 绝对路径
  addedAt: number; // 添加时间戳
  lastUsed?: number; // 最后使用时间
  /** 离开此工作区时保存的 tabs 快照（切回时恢复） */
  tabsSnapshot?: WorkspaceTabsSnapshot;
}

/** 来自 ~/.claude/projects/ 的 CLI 原生历史会话 */
export interface CliSessionRecord {
  sessionId: string;
  preview: string;
  startedAt: number;
  lastMessageAt: number;
  projectDirName: string;
  /** 从 JSONL 文件的 cwd 字段解析出的工作目录 */
  workingDirectory?: string;
}

/** Token 使用量历史记录（持久化到 localStorage） */
export interface TokenRecord {
  id: string;
  timestamp: number;
  sessionId?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
  model?: string;
  workingDirectory?: string;
}

/** 自定义 API 配置文件（用于快速切换多套 API 配置） */
export interface ApiProfile {
  id: string;
  name: string;
  authMode: 'api-key' | 'official';
  apiKey?: string;
  apiBaseUrl?: string;
  httpProxy?: string;
  provider?: string;
}

export interface AppSettings {
  apiKey: string;
  authMode: 'api-key' | 'official';
  model: string;
  permissionMode: string;
  autoConnectOnLaunch: boolean;
  allowedTools: string;
  disallowedTools?: string;
  extraArgs: string;
  addDirs?: string[];
  sessionName?: string;
  maxBudgetUsd?: number;
  httpProxy: string;
  apiBaseUrl: string;
  provider: string;
  effortLevel?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  /** Claude 响应语言（如 "japanese", "chinese", "spanish"），写入 ~/.claude/settings.json */
  language?: string;
  /** 是否启用 Claude 扩展思考（extended thinking）功能 */
  enableThinking?: boolean;
  /** 附加系统提示词 (--append-system-prompt) 或替换系统提示词 (--system-prompt) */
  systemPrompt?: string;
  /** 系统提示词模式：'append'（默认，追加）或 'replace'（完全替换） */
  systemPromptMode?: 'append' | 'replace';
  /** 指定 agent 名称（--agent <name>），默认 'default' 表示不传参 */
  agent?: string;
  // AWS Bedrock 配置
  awsRegion?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsSessionToken?: string;
  // Google Vertex AI 配置
  vertexProjectId?: string;
  vertexRegion?: string;
  // Microsoft Foundry 配置
  foundryResource?: string;
  foundryBaseUrl?: string;
  foundryApiKey?: string;
  // LLM Gateway 配置
  /** Bearer 认证 Token（ANTHROPIC_AUTH_TOKEN，优先于 API Key） */
  gatewayAuthToken?: string;
  /** 自定义请求头（ANTHROPIC_CUSTOM_HEADERS，JSON 格式） */
  gatewayCustomHeaders?: string;
  /** 启用网关模型自动发现（CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY） */
  enableGatewayModelDiscovery?: boolean;
  /** 动态 API Key 脚本路径（apiKeyHelper，写入 ~/.claude/settings.json） */
  apiKeyHelper?: string;
  /** 限制 agentic 最大轮次（--max-turns，print 模式有效） */
  maxTurns?: number;
  /** 是否在界面展示扩展思维摘要（showThinkingSummaries） */
  showThinkingSummaries?: boolean;
  /** 所有会话默认开启扩展思维（alwaysThinkingEnabled） */
  alwaysThinkingEnabled?: boolean;
  /** 自动记忆开关（autoMemoryEnabled），false 时 Claude 不读写记忆目录 */
  autoMemoryEnabled?: boolean;
  /** 会话级环境变量（env），写入 ~/.claude/settings.json 的 env 字段 */
  envVars?: Record<string, string>;
  /** 权限精细规则：允许列表（permissions.allow），如 Bash(git *) */
  permissionAllow?: string[];
  /** 权限精细规则：拒绝列表（permissions.deny），如 Read(.env) */
  permissionDeny?: string[];
  /** 权限精细规则：询问列表（permissions.ask） */
  permissionAsk?: string[];
  /** 自定义 API 配置文件列表（快速切换多套 API 配置） */
  apiProfiles?: ApiProfile[];
}

export interface AuthStatus {
  loggedIn?: boolean;
  mode?: 'api-key' | 'official';
  authMethod?: string;
  apiProvider?: string;
}

// ── 3.4 Plan Mode 审查视图类型 ────────────────────────────────────────────────

export type PlanRiskLevel = 'low' | 'medium' | 'high';
export type PlanStepStatus = 'waiting' | 'running' | 'done' | 'skipped' | 'error';

export interface ReviewablePlanStep {
  id: string;            // "plan-step-{index}"
  index: number;         // 显示序号，从 1 开始
  rawText: string;       // Claude 原始描述文字
  toolType: string;      // 推断工具类型（Read/Edit/Bash/Write/Unknown）
  riskLevel: PlanRiskLevel;
  riskReason?: string;   // 高风险时的详细说明
  target?: string;       // 文件路径或命令摘要
  checked: boolean;      // 是否被用户选中（false = 跳过）
  status: PlanStepStatus;
  toolCallId?: string;
  error?: string;
}

export type PlanReviewPhase =
  | 'idle'
  | 'generating_plan'
  | 'plan_ready'
  | 'executing'
  | 'done'
  | 'cancelled';

export interface PlanReviewState {
  phase: PlanReviewPhase;
  rawPlanText: string;
  parsedSteps: ReviewablePlanStep[];
  confirmedAt?: number;
}
