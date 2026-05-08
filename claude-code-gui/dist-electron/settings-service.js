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
exports.SettingsService = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_SETTINGS = {
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
class SettingsService {
    constructor() {
        const userDataPath = electron_1.app.getPath('userData');
        if (!fs.existsSync(userDataPath)) {
            fs.mkdirSync(userDataPath, { recursive: true });
        }
        this.settingsPath = path.join(userDataPath, 'settings.json');
    }
    load() {
        try {
            if (fs.existsSync(this.settingsPath)) {
                const data = fs.readFileSync(this.settingsPath, 'utf8');
                const settings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
                return { success: true, settings };
            }
            return { success: true, settings: { ...DEFAULT_SETTINGS } };
        }
        catch (error) {
            console.error('[Settings] Load error:', error);
            return { success: false, error: String(error) };
        }
    }
    save(settings) {
        try {
            const data = JSON.stringify(settings, null, 2);
            fs.writeFileSync(this.settingsPath, data, 'utf8');
            return { success: true };
        }
        catch (error) {
            console.error('[Settings] Save error:', error);
            return { success: false, error: String(error) };
        }
    }
}
exports.SettingsService = SettingsService;
