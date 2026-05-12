import { BrowserWindow } from 'electron';
import { spawnSync, spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import * as http from 'http';
import * as path from 'path';
import * as pty from 'node-pty';
import * as os from 'os';

const IS_WIN = os.platform() === 'win32';
/** Claude CLI 可执行路径，动态获取用户主目录，避免硬编码个人路径 */
const CLAUDE_PATH = IS_WIN
  ? path.join(os.homedir(), '.local', 'bin', 'claude.exe')
  : 'claude';

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
  httpProxy?: string;
  apiBaseUrl?: string;
  provider?: string;
  /** 是否开启扩展思考（extended thinking）*/
  enableThinking?: boolean;
  effortLevel?: string;
  /** 允许使用的工具列表（--tools），逗号或空格分隔，默认 'default' 使用所有工具 */
  disallowedTools?: string;
  /** 额外授权访问的目录列表（--add-dir）*/
  addDirs?: string[];
  /** 为新会话设置显示名称（--name）*/
  sessionName?: string;
  /** API 费用上限（USD），仅 --print 模式有效（--max-budget-usd）*/
  maxBudgetUsd?: number;
  /** 附加自定义系统提示词（--append-system-prompt）*/
  systemPrompt?: string;
  /** 系统提示词模式：'append'（默认）= --append-system-prompt；'replace' = --system-prompt */
  systemPromptMode?: 'append' | 'replace';
  /** 指定 agent 名称（--agent <name>）*/
  agent?: string;
  // AWS Bedrock 配置
  awsRegion?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsSessionToken?: string;
  /** 限制 agentic 最大轮次（--max-turns，print 模式有效） */
  maxTurns?: number;
  // Google Vertex AI 配置
  vertexProjectId?: string;
  vertexRegion?: string;
  // Microsoft Foundry 配置
  foundryResource?: string;
  foundryBaseUrl?: string;
  foundryApiKey?: string;
  // LLM Gateway 配置
  gatewayAuthToken?: string;
  gatewayCustomHeaders?: string;
  enableGatewayModelDiscovery?: boolean;
}

export interface CliStartOptions {
  cwd: string;
  args?: string[];
}

interface PermissionHookPayload {
  tool_name?: string;
  toolName?: string;
  tool_input?: Record<string, unknown>;
  toolInput?: Record<string, unknown>;
  permission_suggestions?: unknown;
  permissionSuggestions?: unknown;
  [key: string]: unknown;
}

interface PermissionRequestForRenderer {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  inputPreview: string;
  suggestions?: unknown;
}

type PermissionDecision =
  | { behavior: 'allow'; updatedInput: Record<string, unknown> }
  | { behavior: 'deny'; message: string };

interface PendingPermissionRequest {
  request: PermissionRequestForRenderer;
  resolve: (decision: PermissionDecision) => void;
  timer: NodeJS.Timeout;
}

export class CliService {
  private process: pty.IPty | null = null;
  private isReady = false;
  private config: CliConfig = {};
  /** 每个 tabId 对应一个独立的 CLI 子进程，支持多标签并行 */
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private permissionServer: http.Server | null = null;
  private permissionServerPort: number | null = null;
  private permissionServerPromise: Promise<number> | null = null;
  private pendingPermissionRequests = new Map<string, PendingPermissionRequest>();
  private readonly permissionMcpServerName = 'claude_code_gui_permission';
  private readonly permissionMcpToolName = 'gui_permission_prompt';

  setConfig(config: CliConfig): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): CliConfig {
    return { ...this.config };
  }

  getAuthStatus(): AuthStatusResult {
    const claudePath = CLAUDE_PATH;

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

      const claudePath = CLAUDE_PATH;
      // 展开 ~ 为用户主目录（跨平台）
      const resolvedCwd = options.cwd.startsWith('~')
        ? path.join(os.homedir(), options.cwd.slice(1))
        : options.cwd;

      // Build command line arguments from config
      const args: string[] = [];

      // 始终添加 --bare，跳过 Claude CLI 的交互式向导（文本样式选择等）
      args.push('--bare');

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

      // Provider: Bedrock / Vertex AI 标志
      if (this.config.provider === 'bedrock') {
        args.push('--bedrock');
      } else if (this.config.provider === 'vertex') {
        args.push('--vertex');
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

      // Provider-specific credentials
      if (this.config.provider === 'bedrock') {
        if (this.config.awsRegion) env.AWS_REGION = this.config.awsRegion;
        if (this.config.awsAccessKeyId) env.AWS_ACCESS_KEY_ID = this.config.awsAccessKeyId;
        if (this.config.awsSecretAccessKey) env.AWS_SECRET_ACCESS_KEY = this.config.awsSecretAccessKey;
        if (this.config.awsSessionToken) env.AWS_SESSION_TOKEN = this.config.awsSessionToken;
      } else if (this.config.provider === 'vertex') {
        if (this.config.vertexProjectId) env.ANTHROPIC_VERTEX_PROJECT_ID = this.config.vertexProjectId;
        if (this.config.vertexRegion) env.CLOUD_ML_REGION = this.config.vertexRegion;
      }

      // Microsoft Foundry 配置
      if (this.config.provider === 'foundry') {
        env.CLAUDE_CODE_USE_FOUNDRY = '1';
        if (this.config.foundryResource) env.ANTHROPIC_FOUNDRY_RESOURCE = this.config.foundryResource;
        if (this.config.foundryBaseUrl) env.ANTHROPIC_FOUNDRY_BASE_URL = this.config.foundryBaseUrl;
        if (this.config.foundryApiKey) env.ANTHROPIC_FOUNDRY_API_KEY = this.config.foundryApiKey;
      }

      // LLM Gateway 配置
      if (this.config.gatewayAuthToken) env.ANTHROPIC_AUTH_TOKEN = this.config.gatewayAuthToken;
      if (this.config.gatewayCustomHeaders) env.ANTHROPIC_CUSTOM_HEADERS = this.config.gatewayCustomHeaders;
      if (this.config.enableGatewayModelDiscovery) env.CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY = '1';

      console.log('[CLI] Spawning claude:', claudePath, 'args:', args, 'cwd:', resolvedCwd);

      const ptyProcess = pty.spawn(claudePath, args, {
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        cwd: resolvedCwd,
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
   * @param tabId 发起请求的 tab ID，不同 tab 并行运行互不干扰
   */
  async sendMessage(message: string, cwd?: string, sessionId?: string, imagePaths?: string[], agentOverride?: string, tabId?: string): Promise<{ success: boolean; error?: string }> {
    const tid = tabId ?? 'default';
    // 只停当前 tab 的旧进程，不影响其他 tab
    const existing = this.activeProcesses.get(tid);
    if (existing) {
      existing.kill();
      this.activeProcesses.delete(tid);
    }

    const claudePath = CLAUDE_PATH;

    // 构建参数：-p 消息内容 + 流式 JSON 输出格式
    const args: string[] = ['--print', message, '--output-format', 'stream-json', '--verbose'];

    // 继续上一次会话（多轮对话）
    if (sessionId === 'CONTINUE_LAST') {
      // 用户点击“继续上次会话”按钒，相当于 claude --continue
      args.push('--continue');
    } else if (sessionId) {
      args.push('--resume', sessionId);
    }

    // 限制最大 agentic 轮次（--max-turns）
    if (this.config.maxTurns && this.config.maxTurns > 0) {
      args.push('--max-turns', String(this.config.maxTurns));
    }

    // 传递模型设置
    if (this.config.model && this.config.model !== 'default') {
      args.push('--model', this.config.model);
    }

    // 传递权限模式
    if (this.config.permissionMode && this.config.permissionMode !== 'default') {
      args.push('--permission-mode', this.config.permissionMode);
    }

    // 允许的工具（--tools）
    if (this.config.allowedTools && this.config.allowedTools !== 'default') {
      args.push('--tools', this.config.allowedTools);
    }

    // 禁止的工具（--disallowed-tools）
    if (this.config.disallowedTools?.trim()) {
      args.push('--disallowed-tools', this.config.disallowedTools.trim());
    }

    // 额外目录访问权限（--add-dir）
    if (this.config.addDirs?.length) {
      for (const dir of this.config.addDirs.filter(Boolean)) {
        args.push('--add-dir', dir);
      }
    }

    // 新会话命名（--name），仅在没有 sessionId 时生效（首条消息）
    if (!sessionId && this.config.sessionName?.trim()) {
      args.push('--name', this.config.sessionName.trim());
    }

    // API 费用上限（--max-budget-usd），仅 --print 模式有效
    if (this.config.maxBudgetUsd && this.config.maxBudgetUsd > 0) {
      args.push('--max-budget-usd', String(this.config.maxBudgetUsd));
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

    // 附加系统提示词 / 替换系统提示词
    if (this.config.systemPrompt?.trim()) {
      if (this.config.systemPromptMode === 'replace') {
        args.push('--system-prompt', this.config.systemPrompt.trim());
      } else {
        args.push('--append-system-prompt', this.config.systemPrompt.trim());
      }
    }

    // 指定 agent（--agent <name>），优先使用本次调用的临时 override
    const agentName = agentOverride ?? this.config.agent;
    if (agentName && agentName !== 'default') {
      args.push('--agent', agentName);
    }

    // Provider: Bedrock / Vertex AI 标志
    if (this.config.provider === 'bedrock') {
      args.push('--bedrock');
    } else if (this.config.provider === 'vertex') {
      args.push('--vertex');
    }

    // 图片附件（--image /path/to/img.png）
    if (imagePaths?.length) {
      for (const imgPath of imagePaths) {
        args.push('--image', imgPath);
      }
    }

    try {
      const permissionPort = await this.ensurePermissionServer();
      const mcpConfig = this.buildPermissionMcpConfig(permissionPort);
      args.push(
        '--mcp-config', JSON.stringify(mcpConfig),
        '--permission-prompt-tool', `mcp__${this.permissionMcpServerName}__${this.permissionMcpToolName}`,
        '--settings', JSON.stringify({
          hooks: {
            PermissionRequest: [
              {
                matcher: '*',
                hooks: [
                  {
                    type: 'http',
                    url: `http://127.0.0.1:${permissionPort}/permission-request`,
                    timeout: 3600,
                    statusMessage: '等待 GUI 审批工具权限',
                  },
                ],
              },
            ],
          },
        }),
      );
    } catch (err) {
      return { success: false, error: `启动权限审批桥失败：${String(err)}` };
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

    // Provider-specific credentials
    if (this.config.provider === 'bedrock') {
      if (this.config.awsRegion) env.AWS_REGION = this.config.awsRegion;
      if (this.config.awsAccessKeyId) env.AWS_ACCESS_KEY_ID = this.config.awsAccessKeyId;
      if (this.config.awsSecretAccessKey) env.AWS_SECRET_ACCESS_KEY = this.config.awsSecretAccessKey;
      if (this.config.awsSessionToken) env.AWS_SESSION_TOKEN = this.config.awsSessionToken;
    } else if (this.config.provider === 'vertex') {
      if (this.config.vertexProjectId) env.ANTHROPIC_VERTEX_PROJECT_ID = this.config.vertexProjectId;
      if (this.config.vertexRegion) env.CLOUD_ML_REGION = this.config.vertexRegion;
    }

    const rawWorkdir = cwd || os.homedir();
    const workdir = rawWorkdir.startsWith('~')
      ? path.join(os.homedir(), rawWorkdir.slice(1))
      : rawWorkdir;
    console.log('[CLI] sendMessage: spawning', claudePath, args, 'cwd:', workdir, 'tabId:', tid);

    try {
      const child = spawn(claudePath, args, {
        env,
        cwd: workdir,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.activeProcesses.set(tid, child);

      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        console.log('[CLI] sendMessage chunk:', text.slice(0, 200));
        this.emit('message-chunk', text, tid);
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        console.error('[CLI] sendMessage stderr:', text);
        this.emit('message-stderr', text, tid);
      });

      child.on('exit', (code) => {
        console.log('[CLI] sendMessage process exited with code:', code, 'tabId:', tid);
        this.activeProcesses.delete(tid);
        this.cancelPendingPermissionRequests('Claude 进程已结束，审批请求已取消。');
        this.emit('message-done', String(code ?? 0), tid);
      });

      child.on('error', (err) => {
        console.error('[CLI] sendMessage spawn error:', err);
        this.activeProcesses.delete(tid);
        this.cancelPendingPermissionRequests('Claude 进程启动失败，审批请求已取消。');
        this.emit('message-error', String(err), tid);
      });

      return { success: true };
    } catch (err) {
      console.error('[CLI] sendMessage failed to spawn:', err);
      return { success: false, error: String(err) };
    }
  }

  stopMessage(tabId?: string): { success: boolean } {
    if (tabId) {
      const proc = this.activeProcesses.get(tabId);
      if (proc) {
        proc.kill();
        this.activeProcesses.delete(tabId);
        this.emit('message-done', '-1', tabId);
      }
    } else {
      // 停止所有 tab 的进程
      for (const [tid, proc] of this.activeProcesses) {
        proc.kill();
        this.emit('message-done', '-1', tid);
      }
      this.activeProcesses.clear();
      this.cancelPendingPermissionRequests('用户已停止生成，审批请求已取消。');
    }
    return { success: true };
  }

  respondPermissionRequest(requestId: string, allow: boolean): { success: boolean; error?: string } {
    const pending = this.pendingPermissionRequests.get(requestId);
    if (!pending) {
      return { success: false, error: '审批请求不存在或已结束' };
    }

    this.pendingPermissionRequests.delete(requestId);
    clearTimeout(pending.timer);

    const decision: PermissionDecision = allow
      ? { behavior: 'allow', updatedInput: pending.request.toolInput }
      : { behavior: 'deny', message: '用户在 Claude Code GUI 中拒绝了此工具调用。' };

    pending.resolve(decision);
    this.emit('permission-resolved', JSON.stringify({ id: requestId, behavior: decision.behavior }));
    return { success: true };
  }

  /** 向指定 tab（或任意活跃）消息进程的 stdin 写入原始数据 */
  sendToMessageStdin(data: string, tabId?: string): { success: boolean; error?: string } {
    const proc = tabId
      ? this.activeProcesses.get(tabId)
      : this.activeProcesses.values().next().value;
    if (!proc || !proc.stdin) {
      return { success: false, error: 'No active message process or stdin not available' };
    }
    try {
      proc.stdin.write(data);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  resize(cols: number, rows: number): void {
    this.process?.resize(cols, rows);
  }

  private emit(type: string, data: string, tabId?: string) {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('cli:output', { type, data, tabId });
    });
  }

  private ensurePermissionServer(): Promise<number> {
    if (this.permissionServerPort) return Promise.resolve(this.permissionServerPort);
    if (this.permissionServerPromise) return this.permissionServerPromise;

    this.permissionServerPromise = new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        void this.handlePermissionHookRequest(req, res);
      });

      server.on('error', (err) => {
        this.permissionServer = null;
        this.permissionServerPort = null;
        this.permissionServerPromise = null;
        reject(err);
      });

      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          reject(new Error('无法获取权限审批桥端口'));
          return;
        }
        this.permissionServer = server;
        this.permissionServerPort = address.port;
        resolve(address.port);
      });
    });

    return this.permissionServerPromise;
  }

  private buildPermissionMcpConfig(permissionPort: number): Record<string, unknown> {
    const serverPath = path.join(__dirname, 'permission-prompt-server.js');
    return {
      mcpServers: {
        [this.permissionMcpServerName]: {
          type: 'stdio',
          command: process.execPath,
          args: [serverPath],
          env: {
            ELECTRON_RUN_AS_NODE: '1',
            CLAUDE_GUI_PERMISSION_URL: `http://127.0.0.1:${permissionPort}/permission-tool`,
          },
        },
      },
    };
  }

  private async handlePermissionHookRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      this.writeJsonResponse(res, 404, { error: 'Not found' });
      return;
    }

    const route = req.url?.split('?')[0];
    if (route === '/permission-tool') {
      await this.handlePermissionToolRequest(req, res);
      return;
    }

    if (route !== '/permission-request') {
      this.writeJsonResponse(res, 404, { error: 'Not found' });
      return;
    }

    try {
      const body = await this.readRequestBody(req);
      const payload = JSON.parse(body || '{}') as PermissionHookPayload;
      const request = this.createPermissionRequest(payload);
      const decision = await this.waitForPermissionDecision(request);

      this.writeJsonResponse(res, 200, {
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
          decision,
        },
      });
    } catch (err) {
      this.writeJsonResponse(res, 200, {
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
          decision: {
            behavior: 'deny',
            message: `GUI 权限审批桥处理失败：${String(err)}`,
          },
        },
      });
    }
  }

  private async handlePermissionToolRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const body = await this.readRequestBody(req);
      const payload = JSON.parse(body || '{}') as PermissionHookPayload;
      const request = this.createPermissionRequest(payload);
      const decision = await this.waitForPermissionDecision(request);
      this.writeJsonResponse(res, 200, decision);
    } catch (err) {
      this.writeJsonResponse(res, 200, {
        behavior: 'deny',
        message: `GUI 权限审批桥处理失败：${String(err)}`,
      });
    }
  }

  private readRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 1024 * 1024) {
          reject(new Error('权限请求体过大'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }

  private createPermissionRequest(payload: PermissionHookPayload): PermissionRequestForRenderer {
    const toolName = String(payload.tool_name ?? payload.toolName ?? payload.tool ?? payload.name ?? '工具调用');
    const rawToolInput = payload.tool_input ?? payload.toolInput ?? payload.input ?? {};
    const toolInput = rawToolInput && typeof rawToolInput === 'object' && !Array.isArray(rawToolInput)
      ? rawToolInput as Record<string, unknown>
      : {};

    return {
      id: randomUUID(),
      toolName,
      toolInput,
      inputPreview: this.formatPermissionInput(toolName, toolInput),
      suggestions: payload.permission_suggestions ?? payload.permissionSuggestions ?? payload.suggestions,
    };
  }

  private waitForPermissionDecision(request: PermissionRequestForRenderer): Promise<PermissionDecision> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingPermissionRequests.delete(request.id);
        resolve({ behavior: 'deny', message: 'GUI 权限审批超时，已自动拒绝工具调用。' });
        this.emit('permission-resolved', JSON.stringify({ id: request.id, behavior: 'deny', timeout: true }));
      }, 60 * 60 * 1000);

      this.pendingPermissionRequests.set(request.id, { request, resolve, timer });
      this.emit('permission-request', JSON.stringify(request));
    });
  }

  private cancelPendingPermissionRequests(message: string): void {
    for (const [id, pending] of this.pendingPermissionRequests) {
      clearTimeout(pending.timer);
      pending.resolve({ behavior: 'deny', message });
      this.emit('permission-resolved', JSON.stringify({ id, behavior: 'deny', cancelled: true }));
    }
    this.pendingPermissionRequests.clear();
  }

  private writeJsonResponse(res: http.ServerResponse, statusCode: number, body: unknown): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  }

  private formatPermissionInput(toolName: string, input: Record<string, unknown>): string {
    const name = toolName.toLowerCase();
    if (name === 'bash' || name === 'shell') {
      return String(input.command ?? '').split('\n')[0].slice(0, 200);
    }
    const pathLike = input.file_path ?? input.path ?? input.filename;
    if (typeof pathLike === 'string') return pathLike;
    return JSON.stringify(input).slice(0, 200);
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
      const isWin = IS_WIN;
      const claudePath = CLAUDE_PATH;

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
      const claudePath = CLAUDE_PATH;
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

  /** 运行 claude doctor 健康诊断，返回纯文本输出 */
  runDoctor(): { success: boolean; output?: string; error?: string } {
    try {
      const claudePath = CLAUDE_PATH;
      const result = spawnSync(claudePath, ['doctor'], {
        encoding: 'utf8',
        env: process.env,
        windowsHide: true,
        timeout: 15000,
      });
      const output = (result.stdout || '') + (result.stderr ? `\n[stderr]\n${result.stderr}` : '');
      return { success: result.status === 0, output: output.trim() || '（无输出）' };
    } catch (error) {
      console.error('[CLI] doctor failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /** 运行 claude update / upgrade，返回异步输出 */
  runUpdate(subcmd: 'update' | 'upgrade' = 'update'): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      const claudePath = CLAUDE_PATH;
      const chunks: string[] = [];
      let timedOut = false;

      const child = spawn(claudePath, [subcmd], {
        env: process.env,
        windowsHide: true,
        shell: false,
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, 60000);

      child.stdout.on('data', (d: Buffer) => chunks.push(d.toString()));
      child.stderr.on('data', (d: Buffer) => chunks.push(d.toString()));

      child.on('close', (code: number | null) => {
        clearTimeout(timer);
        const output = chunks.join('').trim() || '（无输出）';
        if (timedOut) resolve({ success: false, output: output + '\n[超时 60s，已终止]' });
        else resolve({ success: code === 0, output });
      });

      child.on('error', (err: Error) => {
        clearTimeout(timer);
        resolve({ success: false, output: String(err) });
      });
    });
  }

  /** 安装插件：运行 claude plugin install <pluginSpec>，流式收集输出 */
  installPlugin(pluginSpec: string): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      const claudePath = CLAUDE_PATH;
      const chunks: string[] = [];
      let timedOut = false;

      const child = spawn(claudePath, ['plugin', 'install', pluginSpec], {
        env: process.env,
        windowsHide: true,
        shell: false,
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, 120000); // 安装可能较慢，给 2 分钟

      child.stdout.on('data', (d: Buffer) => chunks.push(d.toString()));
      child.stderr.on('data', (d: Buffer) => chunks.push(d.toString()));

      child.on('close', (code: number | null) => {
        clearTimeout(timer);
        const output = chunks.join('').trim() || '（无输出）';
        if (timedOut) resolve({ success: false, output: output + '\n[超时，已终止]' });
        else resolve({ success: code === 0, output });
      });

      child.on('error', (err: Error) => {
        clearTimeout(timer);
        resolve({ success: false, output: String(err) });
      });
    });
  }

  /** 卸载插件：运行 claude plugin uninstall <pluginSpec> */
  uninstallPlugin(pluginSpec: string): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      const claudePath = CLAUDE_PATH;
      const chunks: string[] = [];

      const child = spawn(claudePath, ['plugin', 'uninstall', pluginSpec, '--yes'], {
        env: process.env,
        windowsHide: true,
        shell: false,
      });

      const timer = setTimeout(() => { child.kill(); }, 30000);

      child.stdout.on('data', (d: Buffer) => chunks.push(d.toString()));
      child.stderr.on('data', (d: Buffer) => chunks.push(d.toString()));

      child.on('close', (code: number | null) => {
        clearTimeout(timer);
        const output = chunks.join('').trim() || '（无输出）';
        resolve({ success: code === 0, output });
      });

      child.on('error', (err: Error) => {
        clearTimeout(timer);
        resolve({ success: false, output: String(err) });
      });
    });
  }
}

