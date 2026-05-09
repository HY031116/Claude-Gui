import { contextBridge, ipcRenderer } from 'electron';

export interface CliOutputEvent {
  type: 'stdout' | 'stderr' | 'exit';
  data: string;
}

export interface ElectronAPI {
  cliStart: (options: { cwd: string; args?: string[]; forceBareMode?: boolean }) => Promise<{ success: boolean; pid?: number; error?: string }>;
  cliSend: (message: string) => Promise<{ success: boolean; error?: string }>;
  cliStop: () => Promise<{ success: boolean; error?: string }>;
  /** 非交互模式：每条消息独立子进程，响应通过 onCliOutput 的 message-chunk/message-done 事件流式推送 */
  cliSendMessage: (message: string, cwd?: string, sessionId?: string) => Promise<{ success: boolean; error?: string }>;
  cliStopMessage: () => Promise<{ success: boolean }>;
  /** 向当前运行中的消息进程 stdin 写入数据（用于 supervised 模式审批：'y\n' 或 'n\n'） */
  cliSendToStdin: (data: string) => Promise<{ success: boolean; error?: string }>;
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
  /** 弹出系统目录选择对话框，返回选中路径或 null */
  selectDirectory: (defaultPath?: string) => Promise<{ success: boolean; path: string | null }>;
  /** 弹出系统文件选择对话框，返回选中路径或 null */
  selectFile: (options?: { defaultPath?: string }) => Promise<{ success: boolean; path: string | null }>;
  loadSettings: () => Promise<{ success: boolean; settings?: any; error?: string }>;
  saveSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
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
  // 系统通知
  notifySend: (title: string, body: string) => Promise<{ success: boolean; error?: string }>;
}

const api: ElectronAPI = {
  cliStart: (options) => ipcRenderer.invoke('cli:start', options),
  cliSend: (message) => ipcRenderer.invoke('cli:send', message),
  cliStop: () => ipcRenderer.invoke('cli:stop'),
  cliSendMessage: (message, cwd, sessionId) => ipcRenderer.invoke('cli:sendMessage', message, cwd, sessionId),
  cliStopMessage: () => ipcRenderer.invoke('cli:stopMessage'),
  cliSendToStdin: (data: string) => ipcRenderer.invoke('cli:sendToStdin', data),
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
  selectDirectory: (defaultPath) => ipcRenderer.invoke('fs:selectDirectory', defaultPath),
  selectFile: (options) => ipcRenderer.invoke('fs:selectFile', options),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
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
  // 系统通知
  notifySend: (title, body) => ipcRenderer.invoke('notify:send', title, body),
};

contextBridge.exposeInMainWorld('electronAPI', api);

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
