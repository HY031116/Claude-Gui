"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    cliStart: (options) => electron_1.ipcRenderer.invoke('cli:start', options),
    cliSend: (message) => electron_1.ipcRenderer.invoke('cli:send', message),
    cliStop: () => electron_1.ipcRenderer.invoke('cli:stop'),
    cliSendMessage: (message, cwd, sessionId) => electron_1.ipcRenderer.invoke('cli:sendMessage', message, cwd, sessionId),
    cliStopMessage: () => electron_1.ipcRenderer.invoke('cli:stopMessage'),
    onCliOutput: (callback) => {
        const handler = (_, event) => callback(event);
        electron_1.ipcRenderer.on('cli:output', handler);
        return () => electron_1.ipcRenderer.removeListener('cli:output', handler);
    },
    listDirectory: (path) => electron_1.ipcRenderer.invoke('fs:list', path),
    readFile: (path) => electron_1.ipcRenderer.invoke('fs:read', path),
    writeFile: (path, content) => electron_1.ipcRenderer.invoke('fs:write', path, content),
    loadCliHistory: () => electron_1.ipcRenderer.invoke('cli:history'),
    deleteCliSession: (projectDirName, sessionId) => electron_1.ipcRenderer.invoke('cli:delete-session', projectDirName, sessionId),
    deleteAllCliSessions: (projectDirName) => electron_1.ipcRenderer.invoke('cli:delete-project-sessions', projectDirName),
    loadSettings: () => electron_1.ipcRenderer.invoke('settings:load'),
    saveSettings: (settings) => electron_1.ipcRenderer.invoke('settings:save', settings),
    getAuthStatus: () => electron_1.ipcRenderer.invoke('auth:status'),
    launchOfficialLogin: () => electron_1.ipcRenderer.invoke('auth:login'),
    loadCliConfig: () => electron_1.ipcRenderer.invoke('cli-config:load'),
    saveCliConfig: (settings) => electron_1.ipcRenderer.invoke('cli-config:save', settings),
    getCliConfigPath: () => electron_1.ipcRenderer.invoke('cli-config:path'),
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', api);
