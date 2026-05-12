import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface AppSettings {
  apiKey: string;
  authMode: 'api-key' | 'official';
  model: string;
  permissionMode: string;
  autoConnectOnLaunch: boolean;
  allowedTools: string;
  disallowedTools?: string;
  extraArgs: string;
  addDirs?: string[];
  sessionName?: string;
  maxBudgetUsd?: number;
  httpProxy: string;
  apiBaseUrl: string;
  provider: string;
  effortLevel?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  enableThinking?: boolean;
  /** Claude 响应语言（写入 native settings.json） */
  language?: string;
  systemPrompt?: string;
  /** 'append'（默认）= --append-system-prompt；'replace' = --system-prompt */
  systemPromptMode?: 'append' | 'replace';
  agent?: string;  // AWS Bedrock 配置
  awsRegion?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsSessionToken?: string;
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
  apiKeyHelper?: string;
  /** 限制 agentic 最大轮次（--max-turns，print 模式有效） */
  maxTurns?: number;
  /** 是否展示扩展思维摘要 */
  showThinkingSummaries?: boolean;
  /** 所有会话默认开启扩展思维 */
  alwaysThinkingEnabled?: boolean;
  /** 自动记忆开关 */
  autoMemoryEnabled?: boolean;
  /** 会话级环境变量 */
  envVars?: Record<string, string>;
  /** 权限精细规则：允许 */
  permissionAllow?: string[];
  /** 权限精细规则：拒绝 */
  permissionDeny?: string[];
  /** 权限精细规则：询问 */
  permissionAsk?: string[];
  /** 自定义 API 配置文件列表（快速切换多套 API 配置） */
  apiProfiles?: ApiProfile[];
}

/** 自定义 API 配置文件 */
export interface ApiProfile {
  id: string;
  name: string;
  authMode: 'api-key' | 'official';
  apiKey?: string;
  apiBaseUrl?: string;
  httpProxy?: string;
  provider?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  authMode: 'official',
  model: 'sonnet',
  permissionMode: 'auto',
  autoConnectOnLaunch: true,
  allowedTools: 'default',
  extraArgs: '',
  httpProxy: '',
  apiBaseUrl: '',
  provider: 'anthropic',
};

export class SettingsService {
  private settingsPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    this.settingsPath = path.join(userDataPath, 'settings.json');
  }

  load(): { success: boolean; settings?: AppSettings; error?: string } {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf8');
        const settings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
        return { success: true, settings };
      }
      return { success: true, settings: { ...DEFAULT_SETTINGS } };
    } catch (error) {
      console.error('[Settings] Load error:', error);
      return { success: false, error: String(error) };
    }
  }

  save(settings: AppSettings): { success: boolean; error?: string } {
    try {
      const data = JSON.stringify(settings, null, 2);
      fs.writeFileSync(this.settingsPath, data, 'utf8');
      return { success: true };
    } catch (error) {
      console.error('[Settings] Save error:', error);
      return { success: false, error: String(error) };
    }
  }
}
