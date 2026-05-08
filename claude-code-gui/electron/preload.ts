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
  loadSettings: () => Promise<{ success: boolean; settings?: any; error?: string }>;
  saveSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
  getAuthStatus: () => Promise<{ success: boolean; status?: any; error?: string }>;
  launchOfficialLogin: () => Promise<{ success: boolean; error?: string }>;
  // Claude CLI native config (shared with VSCode)
  loadCliConfig: () => Promise<{ success: boolean; settings?: any; error?: string }>;
  saveCliConfig: (settings: any) => Promise<{ success: boolean; error?: string }>;
  getCliConfigPath: () => Promise<{ success: boolean; path?: string }>;
}

const api: ElectronAPI = {
  cliStart: (options) => ipcRenderer.invoke('cli:start', options),
  cliSend: (message) => ipcRenderer.invoke('cli:send', message),
  cliStop: () => ipcRenderer.invoke('cli:stop'),
  cliSendMessage: (message, cwd, sessionId) => ipcRenderer.invoke('cli:sendMessage', message, cwd, sessionId),
  cliStopMessage: () => ipcRenderer.invoke('cli:stopMessage'),
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
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  getAuthStatus: () => ipcRenderer.invoke('auth:status'),
  launchOfficialLogin: () => ipcRenderer.invoke('auth:login'),
  loadCliConfig: () => ipcRenderer.invoke('cli-config:load'),
  saveCliConfig: (settings) => ipcRenderer.invoke('cli-config:save', settings),
  getCliConfigPath: () => ipcRenderer.invoke('cli-config:path'),
};

contextBridge.exposeInMainWorld('electronAPI', api);

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
