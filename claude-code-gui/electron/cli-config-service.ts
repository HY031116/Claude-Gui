import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

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
    mode?: string;
  };

  // 努力程度
  effortLevel?: 'low' | 'medium' | 'high' | 'max';

  // 插件设置
  enabledPlugins?: Record<string, boolean>;

  // 扩展市场
  extraKnownMarketplaces?: Record<string, any>;

  // 更新通道
  autoUpdatesChannel?: 'stable' | 'latest';

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
