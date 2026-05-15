/**
 * transport.ts
 * 通信适配器：根据运行环境自动选择通信方式。
 *   - Electron 环境：直接使用 window.electronAPI（IPC）
 *   - 浏览器环境：使用 HTTP fetch + SSE（连接到本地 Web 服务器 127.0.0.1:5175）
 *
 * 使用方式：import { api } from '@/lib/transport';
 * 替代直接调用 window.electronAPI，保证 Web 模式下功能等价。
 */

import type { CliOutputEvent, ElectronAPI } from '../types/electron';

const WEB_SERVER = 'http://127.0.0.1:5175';

/** 判断当前是否在 Electron 环境中运行 */
export const isElectron = (): boolean =>
  typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';

// ── Web 模式核心工具函数 ──────────────────────────────────────────────────────

/** 向 Web 服务器发起 API 调用 */
async function webInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const res = await fetch(`${WEB_SERVER}/api/invoke/${channel}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    throw new Error(`[transport] HTTP ${res.status}: ${channel}`);
  }
  return res.json() as Promise<T>;
}

/** SSE 事件监听器注册表（订阅 cli:output 事件） */
const cliOutputListeners = new Set<(event: CliOutputEvent) => void>();
const notifyListeners = new Set<(title: string, body: string, tabId?: string) => void>();
let sseSource: EventSource | null = null;

/** 确保 SSE 连接已建立 */
function ensureSSE(): void {
  if (sseSource) return;
  sseSource = new EventSource(`${WEB_SERVER}/api/events`);
  sseSource.onmessage = (e: MessageEvent<string>) => {
    try {
      const envelope = JSON.parse(e.data) as { channel: string; payload: unknown };
      if (envelope.channel === 'cli:output') {
        const event = envelope.payload as CliOutputEvent;
        cliOutputListeners.forEach((cb) => cb(event));
      } else if (envelope.channel === 'notify:send') {
        const { title, body, tabId } = envelope.payload as { title: string; body: string; tabId?: string };
        notifyListeners.forEach((cb) => cb(title, body, tabId));
        // 使用浏览器 Notification API
        if (Notification.permission === 'granted') {
          new Notification(title, { body });
        }
      }
    } catch { /* 忽略无效消息 */ }
  };
  sseSource.onerror = () => {
    // SSE 断开后，等待 2s 重连
    sseSource?.close();
    sseSource = null;
    setTimeout(ensureSSE, 2000);
  };
}

// ── Web 模式完整 API 实现 ────────────────────────────────────────────────────

const webAPI: ElectronAPI = {
  // ── CLI ──
  cliStart: (options) => webInvoke('cli:start', options),
  cliSend: (msg) => webInvoke('cli:send', msg),
  cliStop: () => webInvoke('cli:stop'),
  cliSendMessage: (msg, cwd, sessionId, imagePaths, agentOverride, tabId, extraArgs) =>
    webInvoke('cli:sendMessage', msg, cwd, sessionId, imagePaths, agentOverride, tabId, extraArgs),
  cliStopMessage: (tabId) => webInvoke('cli:stopMessage', tabId),
  cliSendToStdin: (data) => webInvoke('cli:sendToStdin', data),
  cliRespondPermission: (requestId, allow) => webInvoke('cli:respondPermission', requestId, allow),

  onCliOutput: (callback) => {
    ensureSSE();
    cliOutputListeners.add(callback);
    return () => cliOutputListeners.delete(callback);
  },

  // ── 文件系统 ──
  listDirectory: (path) => webInvoke('fs:list', path),
  readFile: (path) => webInvoke('fs:read', path),
  writeFile: (path, content) => webInvoke('fs:write', path, content),
  loadCliHistory: () => webInvoke('cli:history'),
  deleteCliSession: (projectDirName, sessionId) => webInvoke('cli:delete-session', projectDirName, sessionId),
  deleteAllCliSessions: (projectDirName) => webInvoke('cli:delete-project-sessions', projectDirName),
  loadSessionMessages: (projectDirName, sessionId) => webInvoke('cli:load-messages', projectDirName, sessionId),
  saveTempImage: (base64, ext) => webInvoke('fs:saveTempImage', base64, ext),

  // Web 模式下对话框降级：返回 null，触发时组件应切换为文本输入
  selectDirectory: () => Promise.resolve({ success: true, path: null }),
  selectFile: () => Promise.resolve({ success: true, path: null }),
  saveFileDialog: () => Promise.resolve({ success: true, path: null }),

  openInEditor: (filePath, line) => webInvoke('fs:openInEditor', filePath, line),

  // ── 设置 ──
  loadSettings: () => webInvoke('settings:load'),
  saveSettings: (settings) => webInvoke('settings:save', settings),
  setNativeTheme: () => Promise.resolve({ success: true }), // Web 模式下无 nativeTheme

  // ── 认证 ──
  getAuthStatus: () => webInvoke('auth:status'),
  launchOfficialLogin: () => webInvoke('auth:login'),

  // ── CLI Config ──
  loadCliConfig: () => webInvoke('cli-config:load'),
  saveCliConfig: (settings) => webInvoke('cli-config:save', settings),
  getCliConfigPath: () => webInvoke('cli-config:path'),

  // ── Agent ──
  listAgents: () => webInvoke('cli:list-agents'),
  cliDoctor: () => webInvoke('cli:doctor'),
  cliUpdate: (subcmd) => webInvoke('cli:update', subcmd ?? 'update'),
  agentList: () => webInvoke('agent:list'),
  agentWrite: (filename, data) => webInvoke('agent:write', filename, data),
  agentDelete: (filename) => webInvoke('agent:delete', filename),

  // ── Plugin ──
  pluginList: () => webInvoke('plugin:list'),
  pluginToggle: (key, enabled) => webInvoke('plugin:toggle', key, enabled),
  pluginInstall: (spec) => webInvoke('plugin:install', spec),
  pluginUninstall: (spec) => webInvoke('plugin:uninstall', spec),

  // ── Git ──
  gitStatus: (cwd) => webInvoke('git:status', cwd),
  gitDiff: (cwd, filePath, staged) => webInvoke('git:diff', cwd, filePath, staged),
  gitAdd: (cwd, files) => webInvoke('git:add', cwd, files),
  gitUnstage: (cwd, files) => webInvoke('git:unstage', cwd, files),
  gitCommit: (cwd, message) => webInvoke('git:commit', cwd, message),
  gitLog: (cwd, limit) => webInvoke('git:log', cwd, limit),
  gitIsRepo: (cwd) => webInvoke('git:isRepo', cwd),
  gitBranch: (cwd) => webInvoke('git:branch', cwd),
  gitRemotes: (cwd) => webInvoke('git:remotes', cwd),
  gitPush: (cwd, remote, branch, setUpstream) => webInvoke('git:push', cwd, remote, branch, setUpstream),
  gitPull: (cwd, remote, branch) => webInvoke('git:pull', cwd, remote, branch),
  gitWorktreeList: (cwd) => webInvoke('git:worktree:list', cwd),
  gitWorktreeAdd: (cwd, worktreePath, branch, createBranch, commitIsh) =>
    webInvoke('git:worktree:add', cwd, worktreePath, branch, createBranch, commitIsh),
  gitWorktreeRemove: (cwd, worktreePath, force) => webInvoke('git:worktree:remove', cwd, worktreePath, force),
  gitWorktreePrune: (cwd) => webInvoke('git:worktree:prune', cwd),
  gitWorktreeFullDiff: (wtPath) => webInvoke('git:worktree:fullDiff', wtPath),

  // ── 通知 ──
  notifySend: (title, body, tabId) => {
    // 请求浏览器通知权限
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    return webInvoke('notify:send', title, body, tabId);
  },
  onNotificationClick: (callback) => {
    ensureSSE();
    // Web 模式下通知点击通过 SSE 的 notify:send 事件模拟
    const handler = (_title: string, _body: string, tabId?: string) => {
      if (tabId) callback(tabId);
    };
    notifyListeners.add(handler);
    return () => notifyListeners.delete(handler);
  },

  // ── 会话持久化 ──
  sessionSave: (data) => webInvoke('session:save', data),
  sessionList: () => webInvoke('session:list'),
  sessionLoad: (sessionId) => webInvoke('session:load', sessionId),
  sessionDelete: (sessionId) => webInvoke('session:delete', sessionId),

  // ── Claude-Mem ──
  checkClaudeMem: () => webInvoke('mem:check'),
  searchMemory: (query, options) => webInvoke('mem:search', query, options),
  timelineMemory: (options) => webInvoke('mem:timeline', options),
  getObservations: (ids, options) => webInvoke('mem:get_observations', ids, options),

  // ── Hook 测试 ──
  hookTestRun: (command, cwd, envVars) => webInvoke('hook:test', command, cwd, envVars),

  // ── 更新（Web 模式：打开 GitHub Releases 页面）──
  checkUpdate: () => webInvoke('update:check'),
  downloadUpdate: () => webInvoke('update:download'),
  installUpdate: () => {
    window.open('https://github.com/HY031116/Claude-Gui/releases', '_blank');
  },
  onUpdateStatus: () => () => {}, // Web 模式下无自动更新

  // ── Web 模式无此功能，提供空实现 ──
  openInBrowser: () => Promise.resolve({ success: true }),
};

/**
 * 全局通信 API 实例。
 * 在 Electron 环境中直接代理 window.electronAPI，
 * 在浏览器环境中使用 HTTP/SSE 与本地 Web 服务器通信。
 */
export const api: ElectronAPI = isElectron()
  ? (window.electronAPI as ElectronAPI)
  : webAPI;
