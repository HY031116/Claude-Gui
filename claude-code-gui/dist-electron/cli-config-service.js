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
exports.CliConfigService = void 0;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
class CliConfigService {
    constructor() {
        const homeDir = os.homedir();
        this.configPath = path.join(homeDir, '.claude', 'settings.json');
    }
    /**
     * 检查配置文件是否存在
     */
    exists() {
        return fs.existsSync(this.configPath);
    }
    /**
     * 获取配置文件路径
     */
    getConfigPath() {
        return this.configPath;
    }
    /**
     * 读取配置文件
     */
    load() {
        try {
            if (!this.exists()) {
                // 如果配置文件不存在，返回默认配置
                return { success: true, settings: this.getDefaultSettings() };
            }
            const data = fs.readFileSync(this.configPath, 'utf8');
            const settings = JSON.parse(data);
            return { success: true, settings };
        }
        catch (error) {
            console.error('[CliConfig] Failed to load settings:', error);
            return { success: false, error: String(error) };
        }
    }
    /**
     * 保存配置文件（合并现有配置）
     */
    save(newSettings) {
        try {
            // 确保目录存在
            const configDir = path.dirname(this.configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            // 读取现有配置（如果存在）
            let mergedSettings;
            if (this.exists()) {
                const existing = this.load();
                mergedSettings = existing.success
                    ? { ...existing.settings, ...newSettings }
                    : newSettings;
            }
            else {
                mergedSettings = { ...this.getDefaultSettings(), ...newSettings };
            }
            // 写入配置文件
            const data = JSON.stringify(mergedSettings, null, 2);
            fs.writeFileSync(this.configPath, data, 'utf8');
            console.log('[CliConfig] Settings saved to:', this.configPath);
            return { success: true };
        }
        catch (error) {
            console.error('[CliConfig] Failed to save settings:', error);
            return { success: false, error: String(error) };
        }
    }
    /**
     * 更新特定配置项（部分更新）
     */
    update(updates) {
        return this.save(updates);
    }
    /**
     * 获取特定配置项
     */
    get(key) {
        const result = this.load();
        if (result.success && result.settings) {
            return result.settings[key];
        }
        return undefined;
    }
    /**
     * 获取默认配置
     */
    getDefaultSettings() {
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
exports.CliConfigService = CliConfigService;
