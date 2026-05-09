export interface CliOutputEvent {
  type: 'stdout' | 'stderr' | 'exit' | 'message-chunk' | 'message-stderr' | 'message-done' | 'message-error';
  data: string;
}

export interface ElectronAPI {
  cliStart: (options: { cwd: string; args?: string[]; forceBareMode?: boolean }) => Promise<{ success: boolean; pid?: number; error?: string }>;
  cliSend: (message: string) => Promise<{ success: boolean; error?: string }>;
  cliStop: () => Promise<{ success: boolean; error?: string }>;
  /** 非交互模式：每条消息独立子进程，响应通过 onCliOutput 的 message-chunk/message-done 事件流式推送 */
  cliSendMessage: (message: string, cwd?: string, sessionId?: string, imagePaths?: string[]) => Promise<{ success: boolean; error?: string }>;
  cliStopMessage: () => Promise<{ success: boolean }>;
  /** 向当前运行中的消息进程 stdin 写入数据（supervised 审批用：'y\n'/'n\n'） */
  cliSendToStdin: (data: string) => Promise<{ success: boolean; error?: string }>;
  onCliOutput: (callback: (event: CliOutputEvent) => void) => () => void;
  listDirectory: (path: string) => Promise<{ success: boolean; entries?: any[]; error?: string }>;
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
  // 系统通知
  notifySend: (title: string, body: string) => Promise<{ success: boolean; error?: string }>;
  // 保存文件对话框（导出会话）
  saveFileDialog: (options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<{ success: boolean; path: string | null }>;
  /** 将 base64 图片保存到系统临时目录，返回文件路径（图片粘贴功能用） */
  saveTempImage: (base64: string, ext?: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  // Claude-Mem 插件集成
  checkClaudeMem: () => Promise<{ installed: boolean; enabled: boolean; pluginDir?: string }>;
  searchMemory: (query: string, options?: { limit?: number; offset?: number; project?: string; type?: string }) => Promise<{ success: boolean; content?: string; error?: string }>;
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

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
