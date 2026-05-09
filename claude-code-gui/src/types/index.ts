export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  /** Claude 的扩展思考链内容（extended thinking 模式下可用） */
  thinking?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  status: 'pending' | 'success' | 'error';
  /** Write 工具执行前的原始文件内容快照（用于 diff 展示） */
  originalContent?: string;
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

/** 来自 ~/.claude/projects/ 的 CLI 原生历史会话 */
export interface CliSessionRecord {
  sessionId: string;
  preview: string;
  startedAt: number;
  lastMessageAt: number;
  projectDirName: string;
}

export interface AppSettings {
  apiKey: string;
  authMode: 'api-key' | 'official';
  model: string;
  permissionMode: string;
  allowedTools: string;
  disallowedTools?: string;
  extraArgs: string;
  addDirs?: string[];
  sessionName?: string;
  maxBudgetUsd?: number;
  useBareMode: boolean;
  httpProxy: string;
  apiBaseUrl: string;
  provider: string;
  effortLevel?: 'low' | 'medium' | 'high' | 'max';
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
}

export interface AuthStatus {
  loggedIn?: boolean;
  mode?: 'api-key' | 'official';
  authMethod?: string;
  apiProvider?: string;
}

export interface CliPromptOption {
  value: string;
  label: string;
}

export interface CliPrompt {
  id: string;
  title: string;
  description?: string;
  options: CliPromptOption[];
}
