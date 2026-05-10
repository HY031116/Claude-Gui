import { app, BrowserWindow, ipcMain, dialog, Notification, nativeTheme } from 'electron';
import path from 'path';
import fs from 'fs';
import { CliService, type CliStartOptions } from './cli-service';
import { FileService } from './file-service';
import { SettingsService } from './settings-service';
import { CliConfigService } from './cli-config-service';
import {
  getGitStatus, getGitDiff, gitAdd, gitUnstage, gitCommit,
  getGitLog, isGitRepo, getGitBranch, gitPush, gitPull, getGitRemotes,
  listWorktrees, addWorktree, removeWorktree, pruneWorktrees,
} from './git-service';

const cliService = new CliService();
const fileService = new FileService();
const settingsService = new SettingsService();
const cliConfigService = new CliConfigService();

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#09090b', // 暗色主题默认背景，防止加载时白色闪烁
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5185';
  const isDev = !app.isPackaged;

  if (isDev) {
    win.loadURL(devServerUrl).catch(() => {
      win.loadFile(path.join(__dirname, '../dist/index.html'));
    });
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // 初始化为暗色主题，让 Windows 原生菜单栏/标题栏随应用主题显示
  nativeTheme.themeSource = 'dark';

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  cliService.stop();
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for CLI
ipcMain.handle('cli:start', async (_, options: CliStartOptions) => {
  return cliService.start(options);
});

ipcMain.handle('cli:send', async (_, message: string) => {
  return cliService.send(message);
});

ipcMain.handle('cli:stop', async () => {
  return cliService.stop();
});

// 非交互模式发送消息（每条消息独立子进程）
ipcMain.handle('cli:sendMessage', async (_, message: string, cwd?: string, sessionId?: string, imagePaths?: string[], agentOverride?: string) => {
  return cliService.sendMessage(message, cwd, sessionId, imagePaths, agentOverride);
});

ipcMain.handle('cli:stopMessage', async () => {
  return cliService.stopMessage();
});

ipcMain.handle('cli:sendToStdin', async (_event, data: string) => {
  return cliService.sendToMessageStdin(data);
});

// IPC handlers for filesystem
ipcMain.handle('fs:list', async (_, dirPath: string) => {
  return fileService.listDirectory(dirPath);
});

ipcMain.handle('fs:read', async (_, filePath: string) => {
  return fileService.readFile(filePath);
});

ipcMain.handle('fs:write', async (_, filePath: string, content: string) => {
  return fileService.writeFile(filePath, content);
});

// 将 base64 图片写入系统临时目录，返回文件路径（用于图片粘贴发送）
ipcMain.handle('fs:saveTempImage', async (_event, base64: string, ext: string = 'png') => {
  try {
    const tmpDir = app.getPath('temp');
    const filename = `claude-paste-${Date.now()}.${ext}`;
    const filePath = path.join(tmpDir, filename);
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(filePath, buffer);
    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('cli:history', async () => {
  return fileService.loadCliHistory();
});

ipcMain.handle('cli:delete-session', async (_event, projectDirName: string, sessionId: string) => {
  return fileService.deleteCliSession(projectDirName, sessionId);
});

ipcMain.handle('cli:delete-project-sessions', async (_event, projectDirName: string) => {
  return fileService.deleteAllCliSessions(projectDirName);
});

ipcMain.handle('cli:load-messages', async (_event, projectDirName: string, sessionId: string) => {
  return fileService.loadSessionMessages(projectDirName, sessionId);
});

// 选择目录对话框
ipcMain.handle('fs:selectDirectory', async (_event, defaultPath?: string) => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory'],
    defaultPath: defaultPath || undefined,
  });
  if (result.canceled || result.filePaths.length === 0) return { success: true, path: null };
  return { success: true, path: result.filePaths[0] };
});

// 选择文件对话框
ipcMain.handle('fs:selectFile', async (_event, options?: { filters?: Electron.FileFilter[]; defaultPath?: string }) => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openFile'],
    defaultPath: options?.defaultPath || undefined,
    filters: options?.filters || [{ name: 'Markdown', extensions: ['md', 'txt'] }, { name: '所有文件', extensions: ['*'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return { success: true, path: null };
  return { success: true, path: result.filePaths[0] };
});

// 保存文件对话框（用于导出会话）
ipcMain.handle('dialog:save-file', async (_event, options?: { defaultPath?: string; filters?: Electron.FileFilter[] }) => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showSaveDialog(win!, {
    defaultPath: options?.defaultPath,
    filters: options?.filters || [{ name: 'Markdown', extensions: ['md'] }, { name: '文本文件', extensions: ['txt'] }, { name: '所有文件', extensions: ['*'] }],
  });
  if (result.canceled || !result.filePath) return { success: true, path: null };
  return { success: true, path: result.filePath };
});

// IPC handlers for settings
ipcMain.handle('settings:load', async () => {
  const result = settingsService.load();
  if (result.success && result.settings) {
    cliService.setConfig(result.settings);
  }
  return result;
});

ipcMain.handle('settings:save', async (_, settings: any) => {
  cliService.setConfig(settings);
  return settingsService.save(settings);
});

// 主题同步：渲染进程切换主题时更新 nativeTheme，让 Windows 原生菜单栏跟随
ipcMain.handle('theme:set', (_event, theme: 'dark' | 'light') => {
  nativeTheme.themeSource = theme;
  return { success: true };
});

// IPC handlers for auth
ipcMain.handle('auth:status', async () => {
  const status = cliService.getAuthStatus();
  return { success: true, status };
});

ipcMain.handle('auth:login', async () => {
  return cliService.launchOfficialLogin();
});

// Agent 列表
ipcMain.handle('cli:list-agents', async () => {
  return cliService.listAgents();
});

// CLI 健康诊断
ipcMain.handle('cli:doctor', async () => {
  return cliService.runDoctor();
});

// CLI 更新 / 升级
ipcMain.handle('cli:update', async (_, subcmd: 'update' | 'upgrade' = 'update') => {
  return cliService.runUpdate(subcmd);
});


// IPC handlers for Claude CLI native config (shared with VSCode)
ipcMain.handle('cli-config:load', async () => {
  const result = cliConfigService.load();
  if (result.success && result.settings) {
    // 同步 native config 中的 model、permissionMode、effortLevel 到 CliService
    cliService.setConfig({
      model: result.settings.model,
      permissionMode: result.settings.permissions?.mode,
      effortLevel: result.settings.effortLevel,
    });
  }
  return result;
});

ipcMain.handle('cli-config:save', async (_, settings: any) => {
  const result = cliConfigService.save(settings);
  if (result.success) {
    // 同步更新 CliService 配置
    cliService.setConfig({
      model: settings.model,
      permissionMode: settings.permissions?.mode,
      effortLevel: settings.effortLevel,
    });
  }
  return result;
});

ipcMain.handle('cli-config:path', async () => {
  return { success: true, path: cliConfigService.getConfigPath() };
});

// ── Git IPC handlers ──────────────────────────────────────────────────────────

ipcMain.handle('git:status', async (_e, cwd: string) => {
  try {
    const status = getGitStatus(cwd);
    return { success: true, status };
  } catch (e: unknown) {
    return { success: false, error: String(e) };
  }
});

ipcMain.handle('git:diff', async (_e, cwd: string, filePath: string, staged: boolean) => {
  try {
    const diff = getGitDiff(cwd, filePath, staged);
    return { success: true, diff };
  } catch (e: unknown) {
    return { success: false, error: String(e) };
  }
});

ipcMain.handle('git:add', async (_e, cwd: string, files: string[]) => {
  return gitAdd(cwd, files);
});

ipcMain.handle('git:unstage', async (_e, cwd: string, files: string[]) => {
  return gitUnstage(cwd, files);
});

ipcMain.handle('git:commit', async (_e, cwd: string, message: string) => {
  return gitCommit(cwd, message);
});

ipcMain.handle('git:log', async (_e, cwd: string, limit: number) => {
  try {
    const log = getGitLog(cwd, limit);
    return { success: true, log };
  } catch (e: unknown) {
    return { success: false, error: String(e) };
  }
});

ipcMain.handle('git:isRepo', async (_e, cwd: string) => {
  return { success: true, isRepo: isGitRepo(cwd) };
});

ipcMain.handle('git:branch', async (_e, cwd: string) => {
  return { success: true, branch: getGitBranch(cwd) };
});

ipcMain.handle('git:remotes', async (_e, cwd: string) => {
  return { success: true, remotes: getGitRemotes(cwd) };
});

ipcMain.handle('git:push', async (_e, cwd: string, remote?: string, branch?: string, setUpstream?: boolean) => {
  return gitPush(cwd, remote, branch, setUpstream);
});

ipcMain.handle('git:pull', async (_e, cwd: string, remote?: string, branch?: string) => {
  return gitPull(cwd, remote, branch);
});

// ── Git Worktree ──────────────────────────────────────────────────────────────

ipcMain.handle('git:worktree:list', async (_e, cwd: string) => {
  try {
    const worktrees = listWorktrees(cwd);
    return { success: true, worktrees };
  } catch (e: any) {
    return { success: false, error: String(e?.message ?? e) };
  }
});

ipcMain.handle('git:worktree:add', async (_e, cwd: string, worktreePath: string, branch: string, createBranch: boolean, commitIsh?: string) => {
  return addWorktree(cwd, worktreePath, branch, createBranch, commitIsh);
});

ipcMain.handle('git:worktree:remove', async (_e, cwd: string, worktreePath: string, force: boolean) => {
  return removeWorktree(cwd, worktreePath, force);
});

ipcMain.handle('git:worktree:prune', async (_e, cwd: string) => {
  return pruneWorktrees(cwd);
});

// ── 系统通知 ──────────────────────────────────────────────────────────────────

ipcMain.handle('notify:send', async (_e, title: string, body: string) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
    return { success: true };
  }
  return { success: false, error: '系统不支持通知' };
});

// ── Claude-Mem 插件集成 ────────────────────────────────────────────────────────

ipcMain.handle('mem:check', async () => {
  return fileService.checkClaudeMemStatus();
});

ipcMain.handle('mem:search', async (_e, query: string | undefined, options: { limit?: number; offset?: number; project?: string; type?: string; orderBy?: string }) => {
  return fileService.searchClaudeMem(query, options);
});

ipcMain.handle('mem:timeline', async (_e, options: { anchor?: string; query?: string; depthBefore?: number; depthAfter?: number; project?: string }) => {
  return fileService.timelineClaudeMem(options);
});

ipcMain.handle('mem:get_observations', async (_e, ids: number[], options?: { orderBy?: string; project?: string }) => {
  return fileService.getObservationsClaudeMem(ids, options ?? {});
});

// 自定义 Agent CRUD
ipcMain.handle('agent:list', async () => fileService.listCustomAgents());
ipcMain.handle('agent:write', async (_e, filename: string, data: { name: string; model: string; description: string; prompt: string }) =>
  fileService.writeCustomAgent(filename, data)
);
ipcMain.handle('agent:delete', async (_e, filename: string) => fileService.deleteCustomAgent(filename));

// ── Plugin 管理 ───────────────────────────────────────────────────────────────

ipcMain.handle('plugin:list', async () => fileService.listInstalledPlugins());

ipcMain.handle('plugin:toggle', async (_e, key: string, enabled: boolean) =>
  fileService.togglePlugin(key, enabled)
);

ipcMain.handle('plugin:install', async (_e, pluginSpec: string) =>
  cliService.installPlugin(pluginSpec)
);

ipcMain.handle('plugin:uninstall', async (_e, pluginSpec: string) =>
  cliService.uninstallPlugin(pluginSpec)
);

