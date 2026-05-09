import { BrowserWindow } from 'electron';
import { spawnSync, spawn, ChildProcess } from 'child_process';
import * as pty from 'node-pty';
import * as os from 'os';

interface ClaudeAuthStatus {
  loggedIn?: boolean;
  authMethod?: string;
  apiProvider?: string;
}

export interface AuthStatusResult {
  loggedIn: boolean;
  mode: 'api-key' | 'official';
  usingApiKey?: boolean;
  authMethod?: string;
  apiProvider?: string;
}

export interface CliConfig {
  apiKey?: string;
  authMode?: 'api-key' | 'official';
  model?: string;
  permissionMode?: string;
  allowedTools?: string;
  extraArgs?: string;
  useBareMode?: boolean;
  httpProxy?: string;
  apiBaseUrl?: string;
  provider?: string;
  /** 是否开启扩展思考（extended thinking）*/
  enableThinking?: boolean;
  effortLevel?: string;
  /** 附加自定义系统提示词（--append-system-prompt）*/
  systemPrompt?: string;
  /** 指定 agent 名称（--agent <name>）*/
  agent?: string;
}

export interface CliStartOptions {
  cwd: string;
  args?: string[];
  forceBareMode?: boolean;
}

export class CliService {
  private process: pty.IPty | null = null;
  private isReady = false;
  private config: CliConfig = {};
  private activeMessageProcess: ChildProcess | null = null;

  setConfig(config: CliConfig): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): CliConfig {
    return { ...this.config };
  }

  getAuthStatus(): AuthStatusResult {
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

  start(options: CliStartOptions): { success: boolean; pid?: number; error?: string } {
    try {
      if (this.process) {
        this.stop();
      }

      const isWin = os.platform() === 'win32';
      const claudePath = isWin ? 'C:\\Users\\Administrator\\.local\\bin\\claude.exe' : 'claude';

      // Build command line arguments from config
      const args: string[] = [];

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

      // Agent selection（subagent 功能）
      if (this.config.agent && this.config.agent !== 'default') {
        args.push('--agent', this.config.agent);
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
      } else {
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
    } catch (error) {
      console.error('[CLI] Start error:', error);
      return { success: false, error: String(error) };
    }
  }

  send(message: string): { success: boolean; error?: string } {
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
    } catch (error) {
      console.error('[CLI] Write threw error:', error);
      return { success: false, error: String(error) };
    }

    console.log('[CLI] =========================================');
    return { success: true };
  }

  stop(): { success: boolean; error?: string } {
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
  sendMessage(message: string, cwd?: string, sessionId?: string, imagePaths?: string[]): { success: boolean; error?: string } {
    // 如果有正在运行的消息进程，先终止
    if (this.activeMessageProcess) {
      this.activeMessageProcess.kill();
      this.activeMessageProcess = null;
    }

    const isWin = os.platform() === 'win32';
    const claudePath = isWin ? 'C:\\Users\\Administrator\\.local\\bin\\claude.exe' : 'claude';

    // 构建参数：-p 消息内容 + 流式 JSON 输出格式
    const args: string[] = ['--print', message, '--output-format', 'stream-json', '--verbose'];

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

    // 开启扩展思考（extended thinking）
    // 通过 beta header 激活，仅适用于 API Key 模式
    if (this.config.enableThinking && this.config.authMode === 'api-key') {
      args.push('--betas', 'interleaved-thinking-2025-05-14');
    }

    // 解析 extraArgs
    if (this.config.extraArgs) {
      const extraArgList = this.config.extraArgs.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
      args.push(...extraArgList);
    }

    // 附加系统提示词
    if (this.config.systemPrompt?.trim()) {
      args.push('--append-system-prompt', this.config.systemPrompt.trim());
    }

    // 图片附件（--image /path/to/img.png）
    if (imagePaths?.length) {
      for (const imgPath of imagePaths) {
        args.push('--image', imgPath);
      }
    }

    // 准备环境变量
    const env: NodeJS.ProcessEnv = { ...process.env };

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
      const child = spawn(claudePath, args, {
        env,
        cwd: workdir,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.activeMessageProcess = child;

      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        console.log('[CLI] sendMessage chunk:', text.slice(0, 200));
        this.emit('message-chunk', text);
      });

      child.stderr?.on('data', (chunk: Buffer) => {
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
    } catch (err) {
      console.error('[CLI] sendMessage failed to spawn:', err);
      return { success: false, error: String(err) };
    }
  }

  stopMessage(): { success: boolean } {
    if (this.activeMessageProcess) {
      this.activeMessageProcess.kill();
      this.activeMessageProcess = null;
      this.emit('message-done', '-1');
    }
    return { success: true };
  }

  /** 向当前消息进程的 stdin 写入原始数据（用于 supervised 模式交互审批） */
  sendToMessageStdin(data: string): { success: boolean; error?: string } {
    if (!this.activeMessageProcess || !this.activeMessageProcess.stdin) {
      return { success: false, error: 'No active message process or stdin not available' };
    }
    try {
      this.activeMessageProcess.stdin.write(data);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  resize(cols: number, rows: number): void {
    this.process?.resize(cols, rows);
  }

  private emit(type: string, data: string) {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('cli:output', { type, data });
    });
  }

  private checkOfficialAuth(claudePath: string): ClaudeAuthStatus {
    try {
      const result = spawnSync(claudePath, ['auth', 'status'], {
        encoding: 'utf8',
        env: process.env,
        windowsHide: true,
      });
      if (result.stdout) {
        return JSON.parse(result.stdout) as ClaudeAuthStatus;
      }
      return { loggedIn: false };
    } catch (error) {
      console.error('[CLI] Auth status check failed:', error);
      return { loggedIn: false };
    }
  }

  launchOfficialLogin(): { success: boolean; error?: string } {
    try {
      const isWin = os.platform() === 'win32';
      const claudePath = isWin ? 'C:\\Users\\Administrator\\.local\\bin\\claude.exe' : 'claude';

      // Spawn the login process in a new terminal window
      if (isWin) {
        spawnSync('cmd', ['/c', 'start', 'cmd', '/k', claudePath, 'auth', 'login'], {
          windowsHide: false,
        });
      } else {
        spawnSync('xterm', ['-e', claudePath, 'auth', 'login'], {
          windowsHide: false,
        });
      }

      return { success: true };
    } catch (error) {
      console.error('[CLI] Launch login failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /** 列出所有可用 agents（调用 claude agents 命令解析输出） */
  listAgents(): { success: boolean; agents?: Array<{ name: string; model: string; type: 'builtin' | 'custom' }>; error?: string } {
    try {
      const isWin = os.platform() === 'win32';
      const claudePath = isWin ? 'C:\\Users\\Administrator\\.local\\bin\\claude.exe' : 'claude';
      const result = spawnSync(claudePath, ['agents'], {
        encoding: 'utf8',
        env: process.env,
        windowsHide: true,
      });
      const output = result.stdout || '';
      const agents: Array<{ name: string; model: string; type: 'builtin' | 'custom' }> = [];
      let currentType: 'builtin' | 'custom' = 'builtin';
      for (const line of output.split('\n')) {
        if (line.includes('Built-in agents')) { currentType = 'builtin'; continue; }
        if (line.includes('Custom agents') || line.includes('User agents')) { currentType = 'custom'; continue; }
        // 格式：  name · model
        const match = line.match(/^\s{2}(.+?)\s·\s(.+)$/);
        if (match) {
          agents.push({ name: match[1].trim(), model: match[2].trim(), type: currentType });
        }
      }
      return { success: true, agents };
    } catch (error) {
      console.error('[CLI] List agents failed:', error);
      return { success: false, error: String(error) };
    }
  }
}
