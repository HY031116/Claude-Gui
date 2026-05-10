import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface AppSettings {
  apiKey: string;
  authMode: 'api-key' | 'official';
  model: string;
  permissionMode: string;
  allowedTools: string;
  disallowedTools?: string;
  extraArgs: string;
  addDirs?: string[];
  sessionName?: string;
  maxBudgetUsd?: number;
  useBareMode: boolean;
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
  vertexRegion?: string;}

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  authMode: 'official',
  model: 'sonnet',
  permissionMode: 'auto',
  allowedTools: 'default',
  extraArgs: '',
  useBareMode: false,
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
