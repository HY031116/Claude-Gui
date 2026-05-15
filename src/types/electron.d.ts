export interface CliOutputEvent {
  type: 'stdout' | 'stderr' | 'exit' | 'message-chunk' | 'message-stderr' | 'message-done' | 'message-error' | 'permission-request' | 'permission-resolved' | 'question-request' | 'question-resolved';
  data: string;
  /** 发起请求的 tab ID，用于多会话并行路由 */
  tabId?: string;
}

export interface PermissionRequestEvent {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  inputPreview: string;
  suggestions?: unknown;
}

export interface AskQuestionOption {
  label: string;
  description?: string;
  recommended?: boolean;
}

export interface AskQuestionItem {
  header: string;
  question: string;
  multiSelect?: boolean;
  allowFreeformInput?: boolean;
  message?: string;
  options?: AskQuestionOption[];
}

export interface AskQuestionAnswer {
  selected?: string[];
  freeText?: string;
  skipped?: boolean;
}

export interface AskQuestionRequestEvent {
  id: string;
  toolName: 'AskUserQuestion' | 'vscode_askQuestions' | 'askquestion';
  questions: AskQuestionItem[];
}

export interface WorktreeInfo {
  path: string;
  head: string;
  branch: string;
  isMain: boolean;
  isDetached: boolean;
  isLocked: boolean;
}

export interface ElectronAPI {
  cliStart: (options: { cwd: string; args?: string[] }) => Promise<{ success: boolean; pid?: number; error?: string }>;
  cliSend: (message: string) => Promise<{ success: boolean; error?: string }>;
  cliStop: () => Promise<{ success: boolean; error?: string }>;
  /** 非交互模式：每条消息独立子进程，响应通过 onCliOutput 的 message-chunk/message-done 事件流式推送; tabId 区分并行会话 */
  cliSendMessage: (message: string, cwd?: string, sessionId?: string, imagePaths?: string[], agentOverride?: string, tabId?: string, extraArgs?: string[]) => Promise<{ success: boolean; error?: string }>;
  cliStopMessage: (tabId?: string) => Promise<{ success: boolean }>;
  /** 向当前运行中的消息进程 stdin 写入数据（supervised 审批用：'y\n'/'n\n'） */
  cliSendToStdin: (data: string) => Promise<{ success: boolean; error?: string }>;
  /** 响应 Claude Code PermissionRequest hook 审批 */
  cliRespondPermission: (requestId: string, allow: boolean) => Promise<{ success: boolean; error?: string }>;
  /** 响应 Claude Code 的 vscode_askQuestions / askquestion 工具调用 */
  cliRespondQuestion: (requestId: string, answers: Record<string, AskQuestionAnswer>) => Promise<{ success: boolean; error?: string }>;
  onCliOutput: (callback: (event: CliOutputEvent) => void) => () => void;
  listDirectory: (path: string) => Promise<{ success: boolean; entries?: any[]; error?: string }>;
  /** 递归 fuzzy 搜索工作目录内的文件，最多返回 20 条 */
  listFilesInDir: (cwd: string, query: string) => Promise<{ success: boolean; files?: string[]; error?: string }>;
  /** 列出全局和局部可用 Skills */
  listSkills: (cwd?: string) => Promise<{ success: boolean; skills?: Array<{ name: string; source: 'global' | 'local' }>; error?: string }>;
  readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
  /** 读取 ~/.claude/projects/ 下所有历史会话文件 */
  loadCliHistory: () => Promise<{ success: boolean; sessions?: import('./index').CliSessionRecord[]; error?: string }>;
  /** 删除指定 CLI 历史会话文件 */
  deleteCliSession: (projectDirName: string, sessionId: string) => Promise<{ success: boolean; error?: string }>;
  /** 删除某项目目录下所有 .jsonl 会话文件 */
  deleteAllCliSessions: (projectDirName: string) => Promise<{ success: boolean; deletedCount?: number; error?: string }>;
  /** 加载指定会话的完整消息记录（解析 .jsonl 文件重建消息列表） */
  loadSessionMessages: (projectDirName: string, sessionId: string) => Promise<{ success: boolean; messages?: import('./index').Message[]; error?: string }>;
  /** 弹出系统目录选择对话框，返回选中路径或 null */
  selectDirectory: (defaultPath?: string) => Promise<{ success: boolean; path: string | null }>;
  selectFile: (options?: { defaultPath?: string }) => Promise<{ success: boolean; path: string | null }>;
  loadSettings: () => Promise<{ success: boolean; settings?: any; error?: string }>;
  saveSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
  setNativeTheme: (theme: 'dark' | 'light') => Promise<{ success: boolean }>;
  listAgents: () => Promise<{ success: boolean; agents?: Array<{ name: string; model: string; type: 'builtin' | 'custom' }>; error?: string }>;
  getAuthStatus: () => Promise<{ success: boolean; status?: any; error?: string }>;
  launchOfficialLogin: () => Promise<{ success: boolean; error?: string }>;
  // Claude CLI native config (shared with VSCode)
  loadCliConfig: () => Promise<{ success: boolean; settings?: any; error?: string }>;
  saveCliConfig: (settings: any) => Promise<{ success: boolean; error?: string }>;
  getCliConfigPath: () => Promise<{ success: boolean; path?: string }>;
  // Git
  gitStatus: (cwd: string) => Promise<{ success: boolean; status?: GitStatus; error?: string }>;
  gitDiff: (cwd: string, filePath: string, staged: boolean) => Promise<{ success: boolean; diff?: string; error?: string }>;
  gitAdd: (cwd: string, files: string[]) => Promise<{ success: boolean; error?: string }>;
  gitUnstage: (cwd: string, files: string[]) => Promise<{ success: boolean; error?: string }>;
  gitCommit: (cwd: string, message: string) => Promise<{ success: boolean; hash?: string; error?: string }>;
  gitLog: (cwd: string, limit?: number) => Promise<{ success: boolean; log?: GitLogEntry[]; error?: string }>;
  gitIsRepo: (cwd: string) => Promise<{ success: boolean; isRepo: boolean }>;
  gitBranch: (cwd: string) => Promise<{ success: boolean; branch: string }>;
  gitRemotes: (cwd: string) => Promise<{ success: boolean; remotes: string[] }>;
  gitPush: (cwd: string, remote?: string, branch?: string, setUpstream?: boolean) => Promise<{ success: boolean; output?: string; error?: string }>;
  gitPull: (cwd: string, remote?: string, branch?: string) => Promise<{ success: boolean; output?: string; error?: string }>;
  // Git Worktree
  gitWorktreeList: (cwd: string) => Promise<{ success: boolean; worktrees?: WorktreeInfo[]; error?: string }>;
  gitWorktreeAdd: (cwd: string, worktreePath: string, branch: string, createBranch: boolean, commitIsh?: string) => Promise<{ success: boolean; error?: string }>;
  gitWorktreeRemove: (cwd: string, worktreePath: string, force: boolean) => Promise<{ success: boolean; error?: string }>;
  gitWorktreePrune: (cwd: string) => Promise<{ success: boolean; output?: string; error?: string }>;
  /** 3.6.4 Worktree 对比视图 */
  gitWorktreeFullDiff?: (wtPath: string) => Promise<{ success: boolean; diff: string; changedFiles: string[]; error?: string }>;
  // 系统通知
  notifySend: (title: string, body: string, tabId?: string) => Promise<{ success: boolean; error?: string }>;
  onNotificationClick: (cb: (tabId: string) => void) => () => void;
  // 保存文件对话框（导出会话）
  saveFileDialog: (options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<{ success: boolean; path: string | null }>;
  /** 将 base64 图片保存到系统临时目录，返回文件路径（图片粘贴功能用） */
  saveTempImage: (base64: string, ext?: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  // Claude-Mem 插件集成
  checkClaudeMem: () => Promise<{ installed: boolean; enabled: boolean; pluginDir?: string }>;
  searchMemory: (query: string | undefined, options?: { limit?: number; offset?: number; project?: string; type?: string; orderBy?: string }) => Promise<{ success: boolean; content?: string; error?: string }>;
  timelineMemory: (options?: { anchor?: string; query?: string; depthBefore?: number; depthAfter?: number; project?: string }) => Promise<{ success: boolean; content?: string; error?: string }>;
  getObservations: (ids: number[], options?: { orderBy?: string; project?: string }) => Promise<{ success: boolean; content?: string; error?: string }>;
  // CLI 维护
  cliDoctor: () => Promise<{ success: boolean; output?: string; error?: string }>;
  cliUpdate: (subcmd?: 'update' | 'upgrade') => Promise<{ success: boolean; output: string }>;
  // 自定义 Agent 管理
  agentList: () => Promise<{ success: boolean; agents?: Array<{ filename: string; name: string; model: string; description: string; prompt: string; permission_mode: string; max_turns: number | null; effort: string; allowed_tools: string[]; disallowed_tools: string[]; skills: string[]; memory_type: string; isolation: string; background: boolean; initial_prompt: string; color: string }>; error?: string }>;
  agentWrite: (filename: string, data: { name: string; model: string; description: string; prompt: string; permission_mode: string; max_turns: number | null; effort: string; allowed_tools: string[]; disallowed_tools: string[]; skills: string[]; memory_type: string; isolation: string; background: boolean; initial_prompt: string; color: string }) => Promise<{ success: boolean; error?: string }>;
  agentDelete: (filename: string) => Promise<{ success: boolean; error?: string }>;
  // Plugin 管理
  pluginList: () => Promise<{ success: boolean; plugins?: InstalledPlugin[]; error?: string }>;
  pluginToggle: (key: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  pluginInstall: (pluginSpec: string) => Promise<{ success: boolean; output: string }>;
  pluginUninstall: (pluginSpec: string) => Promise<{ success: boolean; output: string }>;
  /** 用系统默认编辑器打开文件；line 不为空时用 VS Code --goto 定位到指定行 */
  openInEditor: (filePath: string, line?: number) => Promise<{ success: boolean; error?: string }>;
  // 应用自动更新
  checkUpdate: () => Promise<{ success: boolean; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => void;
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
  // 会话持久化（v3.0 Phase 1）
  sessionSave?: (data: {
    sessionId: string; title: string; workingDirectory: string;
    createdAt: number; updatedAt: number; messages: unknown[];
    tokenSummary: { inputTokens: number; outputTokens: number; costUsd?: number };
  }) => Promise<{ success: boolean; error?: string }>;
  sessionList?: () => Promise<{ success: boolean; sessions?: Array<{
    sessionId: string; title: string; workingDirectory: string;
    createdAt: number; updatedAt: number;
    tokenSummary: { inputTokens: number; outputTokens: number; costUsd?: number };
  }>; error?: string }>;
  sessionLoad?: (sessionId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  sessionDelete?: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
  /** 3.5.7 Hook 测试运行器 */
  hookTestRun?: (command: string, cwd: string, envVars: Record<string, string>) => Promise<{
    success: boolean; stdout: string; stderr: string; exitCode: number | null; durationMs: number; error?: string;
  }>;
  /** 在默认浏览器中打开本地 Web 版本 (http://127.0.0.1:5175) */
  openInBrowser?: () => Promise<{ success: boolean }>;
}

export interface GitFile {
  path: string;
  status: string;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: GitFile[];
  unstaged: GitFile[];
  untracked: string[];
}

export interface GitLogEntry {
  hash: string;
  message: string;
  date: string;
  author: string;
}

export interface InstalledPlugin {
  key: string;         // "name@marketplace"
  name: string;
  marketplace: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  pluginDir: string;
}

/** 应用自动更新状态 */
export type UpdateStatus =
  | { type: 'checking' }
  | { type: 'available'; version: string; releaseDate?: string }
  | { type: 'not-available' }
  | { type: 'downloading'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string };

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
