"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const cli_service_1 = require("./cli-service");
const file_service_1 = require("./file-service");
const settings_service_1 = require("./settings-service");
const cli_config_service_1 = require("./cli-config-service");
const cliService = new cli_service_1.CliService();
const fileService = new file_service_1.FileService();
const settingsService = new settings_service_1.SettingsService();
const cliConfigService = new cli_config_service_1.CliConfigService();
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5185';
    const isDev = !electron_1.app.isPackaged;
    if (isDev) {
        win.loadURL(devServerUrl).catch(() => {
            win.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
        });
        win.webContents.openDevTools();
    }
    else {
        win.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
}
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    cliService.stop();
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
// IPC handlers for CLI
electron_1.ipcMain.handle('cli:start', async (_, options) => {
    return cliService.start(options);
});
electron_1.ipcMain.handle('cli:send', async (_, message) => {
    return cliService.send(message);
});
electron_1.ipcMain.handle('cli:stop', async () => {
    return cliService.stop();
});
// 非交互模式发送消息（每条消息独立子进程）
electron_1.ipcMain.handle('cli:sendMessage', async (_, message, cwd, sessionId) => {
    return cliService.sendMessage(message, cwd, sessionId);
});
electron_1.ipcMain.handle('cli:stopMessage', async () => {
    return cliService.stopMessage();
});
// IPC handlers for filesystem
electron_1.ipcMain.handle('fs:list', async (_, dirPath) => {
    return fileService.listDirectory(dirPath);
});
electron_1.ipcMain.handle('fs:read', async (_, filePath) => {
    return fileService.readFile(filePath);
});
electron_1.ipcMain.handle('fs:write', async (_, filePath, content) => {
    return fileService.writeFile(filePath, content);
});
electron_1.ipcMain.handle('cli:history', async () => {
    return fileService.loadCliHistory();
});
electron_1.ipcMain.handle('cli:delete-session', async (_event, projectDirName, sessionId) => {
    return fileService.deleteCliSession(projectDirName, sessionId);
});
electron_1.ipcMain.handle('cli:delete-project-sessions', async (_event, projectDirName) => {
    return fileService.deleteAllCliSessions(projectDirName);
});
// IPC handlers for settings
electron_1.ipcMain.handle('settings:load', async () => {
    const result = settingsService.load();
    if (result.success && result.settings) {
        cliService.setConfig(result.settings);
    }
    return result;
});
electron_1.ipcMain.handle('settings:save', async (_, settings) => {
    cliService.setConfig(settings);
    return settingsService.save(settings);
});
// IPC handlers for auth
electron_1.ipcMain.handle('auth:status', async () => {
    const status = cliService.getAuthStatus();
    return { success: true, status };
});
electron_1.ipcMain.handle('auth:login', async () => {
    return cliService.launchOfficialLogin();
});
// IPC handlers for Claude CLI native config (shared with VSCode)
electron_1.ipcMain.handle('cli-config:load', async () => {
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
electron_1.ipcMain.handle('cli-config:save', async (_, settings) => {
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
electron_1.ipcMain.handle('cli-config:path', async () => {
    return { success: true, path: cliConfigService.getConfigPath() };
});
