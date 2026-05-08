import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { CliService, type CliStartOptions } from './cli-service';
import { FileService } from './file-service';
import { SettingsService } from './settings-service';
import { CliConfigService } from './cli-config-service';

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
ipcMain.handle('cli:sendMessage', async (_, message: string, cwd?: string, sessionId?: string) => {
  return cliService.sendMessage(message, cwd, sessionId);
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

ipcMain.handle('cli:history', async () => {
  return fileService.loadCliHistory();
});

ipcMain.handle('cli:delete-session', async (_event, projectDirName: string, sessionId: string) => {
  return fileService.deleteCliSession(projectDirName, sessionId);
});

ipcMain.handle('cli:delete-project-sessions', async (_event, projectDirName: string) => {
  return fileService.deleteAllCliSessions(projectDirName);
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

// IPC handlers for auth
ipcMain.handle('auth:status', async () => {
  const status = cliService.getAuthStatus();
  return { success: true, status };
});

ipcMain.handle('auth:login', async () => {
  return cliService.launchOfficialLogin();
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
