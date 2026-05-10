import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * MCP 服务器配置
 */
export interface McpServerConfig {
  /** stdio（默认）或 sse */
  type?: 'stdio' | 'sse';
  /** stdio 模式下可执行程序 */
  command?: string;
  /** stdio 模式下命令行参数 */
  args?: string[];
  /** 环境变量（stdio/sse 均适用） */
  env?: Record<string, string>;
  /** sse 模式下服务端 URL */
  url?: string;
  /** sse 模式下请求头 */
  headers?: Record<string, string>;
}

/**
 * Hook handler 定义
 */
export interface HookHandler {
  /** handler 类型 */
  type: 'command' | 'http' | 'mcp_tool' | 'prompt' | 'agent';
  /** command 类型：Shell 命令 */
  command?: string;
  /** command 类型：是否异步执行 */
  async?: boolean;
  /** command 类型：Shell 类型（Windows 下可用 powershell） */
  shell?: 'bash' | 'powershell';
  /** http 类型：请求 URL */
  url?: string;
  /** http 类型：额外请求头 */
  headers?: Record<string, string>;
  /** http 类型：允许插值的环境变量名 */
  allowedEnvVars?: string[];
  /** mcp_tool 类型：MCP 服务器名 */
  server?: string;
  /** mcp_tool 类型：工具名 */
  tool?: string;
  /** mcp_tool 类型：工具参数 */
  input?: Record<string, unknown>;
  /** prompt/agent 类型：提示词（$ARGUMENTS 占位符） */
  prompt?: string;
  /** prompt/agent 类型：使用的模型 */
  model?: string;
  /** 通用：按权限规则语法过滤触发条件 */
  if?: string;
  /** 通用：超时秒数 */
  timeout?: number;
  /** 通用：运行时状态栏提示 */
  statusMessage?: string;
  /** 通用：仅运行一次（仅 skill frontmatter 中有效） */
  once?: boolean;
}

/**
 * Hook matcher group（一个事件下的一个 matcher 分组）
 */
export interface HookMatcherGroup {
  /** 匹配规则（工具名、事件来源等；省略则匹配全部） */
  matcher?: string;
  /** 该分组下的 handler 列表 */
  hooks: HookHandler[];
}

/**
 * 所有 Hooks 配置（按事件名分组）
 */
export type HooksConfig = {
  [event: string]: HookMatcherGroup[];
};

/**
 * Claude CLI 原生配置文件服务
 * 与 VSCode Claude Code 插件共享配置
 * 配置文件位置: ~/.claude/settings.json
 */
export interface ClaudeCliSettings {
  // 模型设置
  model?: string;

  // 权限设置
  permissions?: {
    allow?: string[];
    deny?: string[];
    ask?: string[];
    mode?: string;
  };

  // 努力程度
  effortLevel?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';

  // 响应语言（如 "japanese", "chinese", "spanish", "french"）
  language?: string;

  // 插件设置
  enabledPlugins?: Record<string, boolean>;

  // MCP 服务器（Model Context Protocol）
  mcpServers?: Record<string, McpServerConfig>;

  // Hooks 配置
  hooks?: HooksConfig;

  // 是否禁用所有 Hooks
  disableAllHooks?: boolean;

  // 扩展市场
  extraKnownMarketplaces?: Record<string, any>;

  // 更新通道
  autoUpdatesChannel?: 'stable' | 'latest';

  /** 是否在界面展示扩展思维摘要 */
  showThinkingSummaries?: boolean;

  /** 所有会话默认开启扩展思维 */
  alwaysThinkingEnabled?: boolean;

  /** 自动记忆开关（false = 不读写记忆目录） */
  autoMemoryEnabled?: boolean;

  /** 会话级环境变量，写入 env 字段 */
  env?: Record<string, string>;

  // 其他可能的配置项
  [key: string]: any;
}

export class CliConfigService {
  private configPath: string;

  constructor() {
    const homeDir = os.homedir();
    this.configPath = path.join(homeDir, '.claude', 'settings.json');
  }

  /**
   * 检查配置文件是否存在
   */
  exists(): boolean {
    return fs.existsSync(this.configPath);
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 读取配置文件
   */
  load(): { success: boolean; settings?: ClaudeCliSettings; error?: string } {
    try {
      if (!this.exists()) {
        // 如果配置文件不存在，返回默认配置
        return { success: true, settings: this.getDefaultSettings() };
      }

      const data = fs.readFileSync(this.configPath, 'utf8');
      const settings = JSON.parse(data) as ClaudeCliSettings;
      return { success: true, settings };
    } catch (error) {
      console.error('[CliConfig] Failed to load settings:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 保存配置文件（合并现有配置）
   */
  save(newSettings: Partial<ClaudeCliSettings>): { success: boolean; error?: string } {
    try {
      // 确保目录存在
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // 读取现有配置（如果存在）
      let mergedSettings: ClaudeCliSettings;
      if (this.exists()) {
        const existing = this.load();
        mergedSettings = existing.success
          ? { ...existing.settings, ...newSettings }
          : newSettings;
      } else {
        mergedSettings = { ...this.getDefaultSettings(), ...newSettings };
      }

      // 写入配置文件
      const data = JSON.stringify(mergedSettings, null, 2);
      fs.writeFileSync(this.configPath, data, 'utf8');

      console.log('[CliConfig] Settings saved to:', this.configPath);
      return { success: true };
    } catch (error) {
      console.error('[CliConfig] Failed to save settings:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 更新特定配置项（部分更新）
   */
  update(updates: Partial<ClaudeCliSettings>): { success: boolean; error?: string } {
    return this.save(updates);
  }

  /**
   * 获取特定配置项
   */
  get<K extends keyof ClaudeCliSettings>(key: K): ClaudeCliSettings[K] | undefined {
    const result = this.load();
    if (result.success && result.settings) {
      return result.settings[key];
    }
    return undefined;
  }

  /**
   * 获取默认配置
   */
  private getDefaultSettings(): ClaudeCliSettings {
    return {
      model: 'sonnet',
      effortLevel: 'medium',
      autoUpdatesChannel: 'latest',
      permissions: {
        allow: [],
      },
      enabledPlugins: {},
      extraKnownMarketplaces: {},
    };
  }
}
