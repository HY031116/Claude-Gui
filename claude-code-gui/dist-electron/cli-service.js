"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CliService = void 0;
const electron_1 = require("electron");
const child_process_1 = require("child_process");
const pty = __importStar(require("node-pty"));
const os = __importStar(require("os"));
class CliService {
    constructor() {
        this.process = null;
        this.isReady = false;
        this.config = {};
        this.activeMessageProcess = null;
    }
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
    getConfig() {
        return { ...this.config };
    }
    getAuthStatus() {
        const isWin = os.platform() === 'win32';
        const claudePath = isWin ? 'C:\\Users\\Administrator\\.local\\bin\\claude.exe' : 'claude';
        if (this.config.authMode === 'api-key' && this.config.apiKey) {
            return {
                loggedIn: true,
                mode: 'api-key',
                usingApiKey: true,
            };
        }
        const officialStatus = this.checkOfficialAuth(claudePath);
        return {
            loggedIn: officialStatus.loggedIn || false,
            mode: 'official',
            authMethod: officialStatus.authMethod,
            apiProvider: officialStatus.apiProvider,
        };
    }
    start(options) {
        try {
            if (this.process) {
                this.stop();
            }
            const isWin = os.platform() === 'win32';
            const claudePath = isWin ? 'C:\\Users\\Administrator\\.local\\bin\\claude.exe' : 'claude';
            // Build command line arguments from config
            const args = [];
            // Add bare mode if enabled (simpler mode, uses only API key)
            if (this.config.useBareMode || options.forceBareMode) {
                args.push('--bare');
            }
            // Model selection
            if (this.config.model && this.config.model !== 'default') {
                args.push('--model', this.config.model);
            }
            // Permission mode
            if (this.config.permissionMode && this.config.permissionMode !== 'default') {
                args.push('--permission-mode', this.config.permissionMode);
            }
            // Allowed tools
            if (this.config.allowedTools && this.config.allowedTools !== 'default') {
                args.push('--tools', this.config.allowedTools);
            }
            // Extra arguments from user
            if (this.config.extraArgs) {
                // Parse extra args safely
                const extraArgList = this.config.extraArgs.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
                args.push(...extraArgList);
            }
            // Add any additional args passed in
            if (options.args) {
                args.push(...options.args);
            }
            // Prepare environment
            const env = { ...process.env };
            // Set API key if provided (api-key mode)
            if (this.config.authMode === 'api-key') {
                if (!this.config.apiKey) {
                    return {
                        success: false,
                        error: '请在设置中填写 API Key',
                    };
                }
                env.ANTHROPIC_API_KEY = this.config.apiKey;
                console.log('[CLI] Using API Key authentication - skipping official login check');
            }
            else {
                // Official mode - check official auth status
                const authStatus = this.checkOfficialAuth(claudePath);
                if (!authStatus.loggedIn) {
                    return {
                        success: false,
                        error: 'Claude CLI 未登录，请先进行官方授权，或在设置中配置自定义 API',
                    };
                }
            }
            // Set HTTP proxy if provided
            if (this.config.httpProxy) {
                env.HTTP_PROXY = this.config.httpProxy;
                env.HTTPS_PROXY = this.config.httpProxy;
                console.log('[CLI] Using HTTP proxy:', this.config.httpProxy);
            }
            // Set API base URL if provided (for third-party providers)
            if (this.config.apiBaseUrl) {
                env.ANTHROPIC_BASE_URL = this.config.apiBaseUrl;
                console.log('[CLI] Using custom API base URL:', this.config.apiBaseUrl);
            }
            console.log('[CLI] Spawning claude:', claudePath, 'args:', args, 'cwd:', options.cwd);
            const ptyProcess = pty.spawn(claudePath, args, {
                name: 'xterm-256color',
                cols: 120,
                rows: 40,
                cwd: options.cwd,
                env: env,
                useConpty: true,
            });
            this.process = ptyProcess;
            console.log('[CLI] Claude spawned, pid:', ptyProcess.pid);
            ptyProcess.onData((data) => {
                // Log first 300 chars for debugging
                const preview = data.slice(0, 300);
                console.log('[CLI] onData received:', JSON.stringify(preview));
                this.emit('stdout', data);
            });
            ptyProcess.onExit(({ exitCode, signal }) => {
                console.log('[CLI] onExit:', exitCode, signal);
                this.emit('exit', `Process exited with code ${exitCode ?? 'unknown'}${signal ? ` (signal: ${signal})` : ''}`);
                if (this.process === ptyProcess) {
                    this.process = null;
                    this.isReady = false;
                }
            });
            this.isReady = true;
            console.log('[CLI] isReady = true');
            return { success: true, pid: ptyProcess.pid };
        }
        catch (error) {
            console.error('[CLI] Start error:', error);
            return { success: false, error: String(error) };
        }
    }
    send(message) {
        console.log('[CLI] =========================================');
        console.log('[CLI] SEND called');
        console.log('[CLI] Raw message:', JSON.stringify(message));
        console.log('[CLI] Message length:', message.length);
        console.log('[CLI] isReady:', this.isReady);
        console.log('[CLI] hasProcess:', !!this.process);
        console.log('[CLI] Process PID:', this.process?.pid);
        if (!this.process) {
            console.log('[CLI] ERROR: No process running');
            return { success: false, error: 'CLI process not running' };
        }
        if (!this.isReady) {
            console.log('[CLI] ERROR: Not ready yet');
            return { success: false, error: 'CLI still initializing' };
        }
        const data = message + '\r\n';
        console.log('[CLI] Writing to PTY:', JSON.stringify(data));
        console.log('[CLI] PTY cols:', this.process.cols, 'rows:', this.process.rows);
        try {
            this.process.write(data);
            console.log('[CLI] Write call completed (node-pty write returns void on Windows)');
        }
        catch (error) {
            console.error('[CLI] Write threw error:', error);
            return { success: false, error: String(error) };
        }
        console.log('[CLI] =========================================');
        return { success: true };
    }
    stop() {
        console.log('[CLI] stop called');
        if (this.process) {
            this.process.kill();
            this.process = null;
            this.isReady = false;
        }
        return { success: true };
    }
    /**
     * 非交互模式发送消息：使用 claude -p --output-format stream-json
     * 每条消息独立启动子进程，流式推送响应到渲染进程
     */
    sendMessage(message, cwd, sessionId) {
        // 如果有正在运行的消息进程，先终止
        if (this.activeMessageProcess) {
            this.activeMessageProcess.kill();
            this.activeMessageProcess = null;
        }
        const isWin = os.platform() === 'win32';
        const claudePath = isWin ? 'C:\\Users\\Administrator\\.local\\bin\\claude.exe' : 'claude';
        // 构建参数：-p 消息内容 + 流式 JSON 输出格式
        const args = ['--print', message, '--output-format', 'stream-json', '--verbose'];
        // 继续上一次会话（多轮对话）
        if (sessionId) {
            args.push('--resume', sessionId);
        }
        // 传递模型设置
        if (this.config.model && this.config.model !== 'default') {
            args.push('--model', this.config.model);
        }
        // 传递权限模式
        if (this.config.permissionMode && this.config.permissionMode !== 'default') {
            args.push('--permission-mode', this.config.permissionMode);
        }
        // 传递 effort 等级
        if (this.config.effortLevel && this.config.effortLevel !== 'default') {
            args.push('--effort', this.config.effortLevel);
        }
        // 解析 extraArgs
        if (this.config.extraArgs) {
            const extraArgList = this.config.extraArgs.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
            args.push(...extraArgList);
        }
        // 准备环境变量
        const env = { ...process.env };
        if (this.config.authMode === 'api-key') {
            if (!this.config.apiKey) {
                return { success: false, error: '请在设置中填写 API Key' };
            }
            env.ANTHROPIC_API_KEY = this.config.apiKey;
        }
        if (this.config.httpProxy) {
            env.HTTP_PROXY = this.config.httpProxy;
            env.HTTPS_PROXY = this.config.httpProxy;
        }
        if (this.config.apiBaseUrl) {
            env.ANTHROPIC_BASE_URL = this.config.apiBaseUrl;
        }
        const workdir = cwd || os.homedir();
        console.log('[CLI] sendMessage: spawning', claudePath, args, 'cwd:', workdir);
        try {
            const child = (0, child_process_1.spawn)(claudePath, args, {
                env,
                cwd: workdir,
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            this.activeMessageProcess = child;
            child.stdout?.on('data', (chunk) => {
                const text = chunk.toString();
                console.log('[CLI] sendMessage chunk:', text.slice(0, 200));
                this.emit('message-chunk', text);
            });
            child.stderr?.on('data', (chunk) => {
                const text = chunk.toString();
                console.error('[CLI] sendMessage stderr:', text);
                // 将 stderr 也作为 chunk 发送，前缀标记
                this.emit('message-stderr', text);
            });
            child.on('exit', (code) => {
                console.log('[CLI] sendMessage process exited with code:', code);
                this.activeMessageProcess = null;
                this.emit('message-done', String(code ?? 0));
            });
            child.on('error', (err) => {
                console.error('[CLI] sendMessage spawn error:', err);
                this.activeMessageProcess = null;
                this.emit('message-error', String(err));
            });
            return { success: true };
        }
        catch (err) {
            console.error('[CLI] sendMessage failed to spawn:', err);
            return { success: false, error: String(err) };
        }
    }
    stopMessage() {
        if (this.activeMessageProcess) {
            this.activeMessageProcess.kill();
            this.activeMessageProcess = null;
            this.emit('message-done', '-1');
        }
        return { success: true };
    }
    resize(cols, rows) {
        this.process?.resize(cols, rows);
    }
    emit(type, data) {
        electron_1.BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send('cli:output', { type, data });
        });
    }
    checkOfficialAuth(claudePath) {
        try {
            const result = (0, child_process_1.spawnSync)(claudePath, ['auth', 'status'], {
                encoding: 'utf8',
                env: process.env,
                windowsHide: true,
            });
            if (result.stdout) {
                return JSON.parse(result.stdout);
            }
            return { loggedIn: false };
        }
        catch (error) {
            console.error('[CLI] Auth status check failed:', error);
            return { loggedIn: false };
        }
    }
    launchOfficialLogin() {
        try {
            const isWin = os.platform() === 'win32';
            const claudePath = isWin ? 'C:\\Users\\Administrator\\.local\\bin\\claude.exe' : 'claude';
            // Spawn the login process in a new terminal window
            if (isWin) {
                (0, child_process_1.spawnSync)('cmd', ['/c', 'start', 'cmd', '/k', claudePath, 'auth', 'login'], {
                    windowsHide: false,
                });
            }
            else {
                (0, child_process_1.spawnSync)('xterm', ['-e', claudePath, 'auth', 'login'], {
                    windowsHide: false,
                });
            }
            return { success: true };
        }
        catch (error) {
            console.error('[CLI] Launch login failed:', error);
            return { success: false, error: String(error) };
        }
    }
}
exports.CliService = CliService;
