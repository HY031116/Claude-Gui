import { contextBridge, ipcRenderer } from 'electron';

/** 应用更新状态（与 main.ts 中的 UpdateStatus 保持一致） */
export type UpdateStatus =
  | { type: 'checking' }
  | { type: 'available'; version: string; releaseDate?: string }
  | { type: 'not-available' }
  | { type: 'downloading'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string };

export interface CliOutputEvent {
  type: 'stdout' | 'stderr' | 'exit' | 'message-chunk' | 'message-stderr' | 'message-done' | 'message-error' | 'permission-request' | 'permission-resolved';
  data: string;
  /** 发起请求的 tab ID，用于多会话并行路由（仅 message-* 事件携带） */
  tabId?: string;
}

export interface ElectronAPI {
  cliStart: (options: { cwd: string; args?: string[] }) => Promise<{ success: boolean; pid?: number; error?: string }>;
  cliSend: (message: string) => Promise<{ success: boolean; error?: string }>;
  cliStop: () => Promise<{ success: boolean; error?: string }>;
  /** 非交互模式：每条消息独立子进，响应通过 onCliOutput 的 message-chunk/message-done 事件流式推送; tabId 区分多个并行会话 */
  cliSendMessage: (message: string, cwd?: string, sessionId?: string, imagePaths?: string[], agentOverride?: string, tabId?: string) => Promise<{ success: boolean; error?: string }>;
  cliStopMessage: (tabId?: string) => Promise<{ success: boolean }>;
  /** 向当前运行中的消息进程 stdin 写入数据（用于 supervised 模式审批：'y\n' 或 'n\n'） */
  cliSendToStdin: (data: string) => Promise<{ success: boolean; error?: string }>;
  /** 响应 Claude Code 的真实 PermissionRequest hook 审批 */
  cliRespondPermission: (requestId: string, allow: boolean) => Promise<{ success: boolean; error?: string }>;
  onCliOutput: (callback: (event: CliOutputEvent) => void) => () => void;
  listDirectory: (path: string) => Promise<{ success: boolean; entries?: any[]; error?: string }>;
  readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
  /** 读取 ~/.claude/projects/ 下所有历史会话文件 */
  loadCliHistory: () => Promise<{ success: boolean; sessions?: any[]; error?: string }>;
  /** 删除指定 CLI 历史会话文件 */
  deleteCliSession: (projectDirName: string, sessionId: string) => Promise<{ success: boolean; error?: string }>;
  /** 删除某项目目录下所有 .jsonl 会话文件 */
  deleteAllCliSessions: (projectDirName: string) => Promise<{ success: boolean; deletedCount?: number; error?: string }>;
  /** 加载指定会话的完整消息记录 */
  loadSessionMessages: (projectDirName: string, sessionId: string) => Promise<{ success: boolean; messages?: any[]; error?: string }>;
  /** 弹出系统目录选择对话框，返回选中路径或 null */
  selectDirectory: (defaultPath?: string) => Promise<{ success: boolean; path: string | null }>;
  /** 弹出系统文件选择对话框，返回选中路径或 null */
  selectFile: (options?: { defaultPath?: string }) => Promise<{ success: boolean; path: string | null }>;
  loadSettings: () => Promise<{ success: boolean; settings?: any; error?: string }>;
  saveSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
  setNativeTheme: (theme: 'dark' | 'light') => Promise<{ success: boolean }>;
  listAgents: () => Promise<{ success: boolean; agents?: Array<{ name: string; model: string; type: 'builtin' | 'custom' }>; error?: string }>;
  cliDoctor: () => Promise<{ success: boolean; output?: string; error?: string }>;
  cliUpdate: (subcmd?: 'update' | 'upgrade') => Promise<{ success: boolean; output: string }>;
  getAuthStatus: () => Promise<{ success: boolean; status?: any; error?: string }>;
  launchOfficialLogin: () => Promise<{ success: boolean; error?: string }>;
  // Claude CLI native config (shared with VSCode)
  loadCliConfig: () => Promise<{ success: boolean; settings?: any; error?: string }>;
  saveCliConfig: (settings: any) => Promise<{ success: boolean; error?: string }>;
  getCliConfigPath: () => Promise<{ success: boolean; path?: string }>;
  // Git
  gitStatus: (cwd: string) => Promise<{ success: boolean; status?: any; error?: string }>;
  gitDiff: (cwd: string, filePath: string, staged: boolean) => Promise<{ success: boolean; diff?: string; error?: string }>;
  gitAdd: (cwd: string, files: string[]) => Promise<{ success: boolean; error?: string }>;
  gitUnstage: (cwd: string, files: string[]) => Promise<{ success: boolean; error?: string }>;
  gitCommit: (cwd: string, message: string) => Promise<{ success: boolean; hash?: string; error?: string }>;
  gitLog: (cwd: string, limit?: number) => Promise<{ success: boolean; log?: any[]; error?: string }>;
  gitIsRepo: (cwd: string) => Promise<{ success: boolean; isRepo: boolean }>;
  gitBranch: (cwd: string) => Promise<{ success: boolean; branch: string }>;
  gitRemotes: (cwd: string) => Promise<{ success: boolean; remotes: string[] }>;
  gitPush: (cwd: string, remote?: string, branch?: string, setUpstream?: boolean) => Promise<{ success: boolean; output?: string; error?: string }>;
  gitPull: (cwd: string, remote?: string, branch?: string) => Promise<{ success: boolean; output?: string; error?: string }>;
  // Git Worktree
  gitWorktreeList: (cwd: string) => Promise<{ success: boolean; worktrees?: Array<{ path: string; head: string; branch: string; isMain: boolean; isDetached: boolean; isLocked: boolean }>; error?: string }>;
  gitWorktreeAdd: (cwd: string, worktreePath: string, branch: string, createBranch: boolean, commitIsh?: string) => Promise<{ success: boolean; error?: string }>;
  gitWorktreeRemove: (cwd: string, worktreePath: string, force: boolean) => Promise<{ success: boolean; error?: string }>;
  gitWorktreePrune: (cwd: string) => Promise<{ success: boolean; output?: string; error?: string }>;
  // 系统通知
  notifySend: (title: string, body: string) => Promise<{ success: boolean; error?: string }>;
  // 保存文件对话框（导出会话）
  saveFileDialog: (options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<{ success: boolean; path: string | null }>;
  /** 将 base64 图片保存到系统临时目录，返回文件路径（图片粘贴功能用） */
  saveTempImage: (base64: string, ext?: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  // Claude-Mem 插件集成
  checkClaudeMem: () => Promise<{ installed: boolean; enabled: boolean; pluginDir?: string }>;
  searchMemory: (query: string | undefined, options?: { limit?: number; offset?: number; project?: string; type?: string; orderBy?: string }) => Promise<{ success: boolean; content?: string; error?: string }>;
  timelineMemory: (options?: { anchor?: string; query?: string; depthBefore?: number; depthAfter?: number; project?: string }) => Promise<{ success: boolean; content?: string; error?: string }>;
  getObservations: (ids: number[], options?: { orderBy?: string; project?: string }) => Promise<{ success: boolean; content?: string; error?: string }>;
  // 自定义 Agent 管理
  agentList: () => Promise<{ success: boolean; agents?: Array<{ filename: string; name: string; model: string; description: string; prompt: string }>; error?: string }>;
  agentWrite: (filename: string, data: { name: string; model: string; description: string; prompt: string }) => Promise<{ success: boolean; error?: string }>;
  agentDelete: (filename: string) => Promise<{ success: boolean; error?: string }>;
  // Plugin 管理
  pluginList: () => Promise<{ success: boolean; plugins?: Array<{ key: string; name: string; marketplace: string; version: string; description: string; author: string; enabled: boolean; pluginDir: string }>; error?: string }>;
  pluginToggle: (key: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  pluginInstall: (pluginSpec: string) => Promise<{ success: boolean; output: string }>;
  pluginUninstall: (pluginSpec: string) => Promise<{ success: boolean; output: string }>;
  /** 用系统默认编辑器打开文件 */
  openInEditor: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  // 应用自动更新
  /** 手动触发检查更新 */
  checkUpdate: () => Promise<{ success: boolean; error?: string }>;
  /** 开始下载更新（用户确认后调用） */
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  /** 退出并立即安装已下载的更新 */
  installUpdate: () => void;
  /** 订阅更新状态事件 */
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
  // 会话持久化（v3.0 Phase 1）
  sessionSave: (data: {
    sessionId: string; title: string; workingDirectory: string;
    createdAt: number; updatedAt: number; messages: unknown[];
    tokenSummary: { inputTokens: number; outputTokens: number; costUsd?: number };
  }) => Promise<{ success: boolean; error?: string }>;
  sessionList: () => Promise<{ success: boolean; sessions?: Array<{
    sessionId: string; title: string; workingDirectory: string;
    createdAt: number; updatedAt: number;
    tokenSummary: { inputTokens: number; outputTokens: number; costUsd?: number };
  }>; error?: string }>;
  sessionLoad: (sessionId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  sessionDelete: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
}

const api: ElectronAPI = {
  cliStart: (options) => ipcRenderer.invoke('cli:start', options),
  cliSend: (message) => ipcRenderer.invoke('cli:send', message),
  cliStop: () => ipcRenderer.invoke('cli:stop'),
  cliSendMessage: (message, cwd, sessionId, imagePaths, agentOverride, tabId) => ipcRenderer.invoke('cli:sendMessage', message, cwd, sessionId, imagePaths, agentOverride, tabId),
  cliStopMessage: (tabId) => ipcRenderer.invoke('cli:stopMessage', tabId),
  cliSendToStdin: (data: string) => ipcRenderer.invoke('cli:sendToStdin', data),
  cliRespondPermission: (requestId, allow) => ipcRenderer.invoke('cli:respondPermission', requestId, allow),
  onCliOutput: (callback) => {
    const handler = (_: any, event: CliOutputEvent) => callback(event);
    ipcRenderer.on('cli:output', handler);
    return () => ipcRenderer.removeListener('cli:output', handler);
  },
  listDirectory: (path) => ipcRenderer.invoke('fs:list', path),
  readFile: (path) => ipcRenderer.invoke('fs:read', path),
  writeFile: (path, content) => ipcRenderer.invoke('fs:write', path, content),
  loadCliHistory: () => ipcRenderer.invoke('cli:history'),
  deleteCliSession: (projectDirName, sessionId) => ipcRenderer.invoke('cli:delete-session', projectDirName, sessionId),
  deleteAllCliSessions: (projectDirName) => ipcRenderer.invoke('cli:delete-project-sessions', projectDirName),
  loadSessionMessages: (projectDirName, sessionId) => ipcRenderer.invoke('cli:load-messages', projectDirName, sessionId),
  selectDirectory: (defaultPath) => ipcRenderer.invoke('fs:selectDirectory', defaultPath),
  selectFile: (options) => ipcRenderer.invoke('fs:selectFile', options),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  setNativeTheme: (theme: 'dark' | 'light') => ipcRenderer.invoke('theme:set', theme),
  listAgents: () => ipcRenderer.invoke('cli:list-agents'),
  getAuthStatus: () => ipcRenderer.invoke('auth:status'),
  launchOfficialLogin: () => ipcRenderer.invoke('auth:login'),
  loadCliConfig: () => ipcRenderer.invoke('cli-config:load'),
  saveCliConfig: (settings) => ipcRenderer.invoke('cli-config:save', settings),
  getCliConfigPath: () => ipcRenderer.invoke('cli-config:path'),
  // Git
  gitStatus: (cwd) => ipcRenderer.invoke('git:status', cwd),
  gitDiff: (cwd, filePath, staged) => ipcRenderer.invoke('git:diff', cwd, filePath, staged),
  gitAdd: (cwd, files) => ipcRenderer.invoke('git:add', cwd, files),
  gitUnstage: (cwd, files) => ipcRenderer.invoke('git:unstage', cwd, files),
  gitCommit: (cwd, message) => ipcRenderer.invoke('git:commit', cwd, message),
  gitLog: (cwd, limit = 20) => ipcRenderer.invoke('git:log', cwd, limit),
  gitIsRepo: (cwd) => ipcRenderer.invoke('git:isRepo', cwd),
  gitBranch: (cwd) => ipcRenderer.invoke('git:branch', cwd),
  gitRemotes: (cwd) => ipcRenderer.invoke('git:remotes', cwd),
  gitPush: (cwd, remote, branch, setUpstream) => ipcRenderer.invoke('git:push', cwd, remote, branch, setUpstream),
  gitPull: (cwd, remote, branch) => ipcRenderer.invoke('git:pull', cwd, remote, branch),
  // Git Worktree
  gitWorktreeList: (cwd) => ipcRenderer.invoke('git:worktree:list', cwd),
  gitWorktreeAdd: (cwd, worktreePath, branch, createBranch, commitIsh) => ipcRenderer.invoke('git:worktree:add', cwd, worktreePath, branch, createBranch, commitIsh),
  gitWorktreeRemove: (cwd, worktreePath, force) => ipcRenderer.invoke('git:worktree:remove', cwd, worktreePath, force),
  gitWorktreePrune: (cwd) => ipcRenderer.invoke('git:worktree:prune', cwd),
  // 系统通知
  notifySend: (title, body) => ipcRenderer.invoke('notify:send', title, body),
  // 保存文件对话框（导出会话）
  saveFileDialog: (options) => ipcRenderer.invoke('dialog:save-file', options),
  saveTempImage: (base64, ext) => ipcRenderer.invoke('fs:saveTempImage', base64, ext),
  // Claude-Mem 插件集成
  checkClaudeMem: () => ipcRenderer.invoke('mem:check'),
  searchMemory: (query, options) => ipcRenderer.invoke('mem:search', query, options),
  timelineMemory: (options) => ipcRenderer.invoke('mem:timeline', options),
  getObservations: (ids, options) => ipcRenderer.invoke('mem:get_observations', ids, options),
  cliDoctor: () => ipcRenderer.invoke('cli:doctor'),
  cliUpdate: (subcmd = 'update') => ipcRenderer.invoke('cli:update', subcmd),
  agentList: () => ipcRenderer.invoke('agent:list'),
  agentWrite: (filename, data) => ipcRenderer.invoke('agent:write', filename, data),
  agentDelete: (filename) => ipcRenderer.invoke('agent:delete', filename),
  // Plugin 管理
  pluginList: () => ipcRenderer.invoke('plugin:list'),
  pluginToggle: (key, enabled) => ipcRenderer.invoke('plugin:toggle', key, enabled),
  pluginInstall: (pluginSpec) => ipcRenderer.invoke('plugin:install', pluginSpec),
  pluginUninstall: (pluginSpec) => ipcRenderer.invoke('plugin:uninstall', pluginSpec),
  openInEditor: (filePath) => ipcRenderer.invoke('fs:openInEditor', filePath),
  // 应用自动更新
  checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
  downloadUpdate: () => ipcRenderer.invoke('app:downloadUpdate'),
  installUpdate: () => ipcRenderer.send('app:installUpdate'),
  // 会话持久化（v3.0 Phase 1）
  sessionSave: (data) => ipcRenderer.invoke('session:save', data),
  sessionList: () => ipcRenderer.invoke('session:list'),
  sessionLoad: (sessionId) => ipcRenderer.invoke('session:load', sessionId),
  sessionDelete: (sessionId) => ipcRenderer.invoke('session:delete', sessionId),
  onUpdateStatus: (callback) => {
    const handler = (_: unknown, status: unknown) => callback(status as any);
    ipcRenderer.on('app:updateStatus', handler);
    return () => ipcRenderer.removeListener('app:updateStatus', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
