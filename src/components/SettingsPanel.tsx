import { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, Check, X, Loader2, Database, RefreshCw } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { TabBar } from './TabBar';
import type { AppSettings, AuthStatus } from '../types';
import { ModelTab, PermissionsTab, SessionTab, ConnectionTab, IntegrationsTab } from './settings';
import { CONFIG_PRESETS } from './settings/constants';

export function SettingsPanel() {
  const { setCurrentStatus } = useAppStore();
  // Config mode: native = use CLI native config (shared with VSCode)
  const [useNativeConfig, setUseNativeConfig] = useState(true);
  const [nativeConfigPath, setNativeConfigPath] = useState('');
  const [nativeSettings, setNativeSettings] = useState<any>(null);

  const [settings, setSettings] = useState<AppSettings>({
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
  });
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  // 检查更新状态
  const [checkUpdateStatus, setCheckUpdateStatus] = useState<'idle' | 'checking' | 'latest' | 'error'>('idle');
  const checkUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<'model' | 'permissions' | 'session' | 'connection' | 'integrations'>('model');

  // MCP 服务器状态
  const [mcpServers, setMcpServers] = useState<Record<string, any>>({});
  // Plugins 状态
  const [enabledPlugins, setEnabledPlugins] = useState<Record<string, boolean>>({});
  // 可用 agents 列表（从 CLI 加载）
  const [availableAgents, setAvailableAgents] = useState<Array<{ name: string; model: string; type: 'builtin' | 'custom' }>>([]);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load CLI native config path first
      const pathResult = await window.electronAPI.getCliConfigPath();
      if (pathResult.success && pathResult.path) {
        setNativeConfigPath(pathResult.path);
      }

      // Load from native config (shared with VSCode)
      const nativeResult = await window.electronAPI.loadCliConfig();
      if (nativeResult.success && nativeResult.settings) {
        setNativeSettings(nativeResult.settings);
        // Merge native config into our settings
        setSettings((prev) => ({
          ...prev,
          model: nativeResult.settings.model || prev.model,
          permissionMode: nativeResult.settings.permissions?.mode || prev.permissionMode,
          language: nativeResult.settings.language || prev.language,
          showThinkingSummaries: nativeResult.settings.showThinkingSummaries ?? prev.showThinkingSummaries,
          alwaysThinkingEnabled: nativeResult.settings.alwaysThinkingEnabled ?? prev.alwaysThinkingEnabled,
          autoMemoryEnabled: nativeResult.settings.autoMemoryEnabled ?? prev.autoMemoryEnabled,
          envVars: nativeResult.settings.env ?? prev.envVars,
          permissionAllow: nativeResult.settings.permissions?.allow ?? prev.permissionAllow,
          permissionDeny: nativeResult.settings.permissions?.deny ?? prev.permissionDeny,
          permissionAsk: nativeResult.settings.permissions?.ask ?? prev.permissionAsk,
        }));
        // 初始化 MCP 和 Plugins 状态
        setMcpServers(nativeResult.settings.mcpServers ?? {});
        setEnabledPlugins(nativeResult.settings.enabledPlugins ?? {});
      }

      // Load GUI-specific settings (apiKey, authMode, apiBaseUrl, etc.)
      const guiResult = await window.electronAPI.loadSettings();
      if (guiResult.success && guiResult.settings) {
        setSettings((prev) => ({
          ...prev,
          apiKey: guiResult.settings.apiKey || prev.apiKey,
          authMode: guiResult.settings.authMode || prev.authMode,
          apiBaseUrl: guiResult.settings.apiBaseUrl || prev.apiBaseUrl,
          httpProxy: guiResult.settings.httpProxy || prev.httpProxy,
          autoConnectOnLaunch: guiResult.settings.autoConnectOnLaunch ?? prev.autoConnectOnLaunch,
          extraArgs: guiResult.settings.extraArgs || prev.extraArgs,
          disallowedTools: guiResult.settings.disallowedTools ?? prev.disallowedTools,
          addDirs: guiResult.settings.addDirs ?? prev.addDirs,
          sessionName: guiResult.settings.sessionName ?? prev.sessionName,
          maxBudgetUsd: guiResult.settings.maxBudgetUsd ?? prev.maxBudgetUsd,
          systemPrompt: guiResult.settings.systemPrompt ?? prev.systemPrompt,
          systemPromptMode: guiResult.settings.systemPromptMode ?? prev.systemPromptMode,
          agent: guiResult.settings.agent ?? prev.agent,
          provider: guiResult.settings.provider ?? prev.provider,
          awsRegion: guiResult.settings.awsRegion ?? prev.awsRegion,
          awsAccessKeyId: guiResult.settings.awsAccessKeyId ?? prev.awsAccessKeyId,
          awsSecretAccessKey: guiResult.settings.awsSecretAccessKey ?? prev.awsSecretAccessKey,
          awsSessionToken: guiResult.settings.awsSessionToken ?? prev.awsSessionToken,
          vertexProjectId: guiResult.settings.vertexProjectId ?? prev.vertexProjectId,
          vertexRegion: guiResult.settings.vertexRegion ?? prev.vertexRegion,
          foundryResource: guiResult.settings.foundryResource ?? prev.foundryResource,
          foundryBaseUrl: guiResult.settings.foundryBaseUrl ?? prev.foundryBaseUrl,
          foundryApiKey: guiResult.settings.foundryApiKey ?? prev.foundryApiKey,
          gatewayAuthToken: guiResult.settings.gatewayAuthToken ?? prev.gatewayAuthToken,
          gatewayCustomHeaders: guiResult.settings.gatewayCustomHeaders ?? prev.gatewayCustomHeaders,
          enableGatewayModelDiscovery: guiResult.settings.enableGatewayModelDiscovery ?? prev.enableGatewayModelDiscovery,
          apiKeyHelper: guiResult.settings.apiKeyHelper ?? prev.apiKeyHelper,
          maxTurns: guiResult.settings.maxTurns ?? prev.maxTurns,
        }));
      }

      // Load auth status
      const authResult = await window.electronAPI.getAuthStatus();
      if (authResult.success && authResult.status) {
        setAuthStatus(authResult.status);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    // 加载 agent 列表
    window.electronAPI?.listAgents?.().then((result) => {
      if (result?.success && result.agents) {
        setAvailableAgents(result.agents);
      }
    });
  }, [loadSettings]);

  const applyPreset = useCallback((presetId: string) => {
    const preset = CONFIG_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setSettings((prev) => ({ ...prev, ...preset.settings }));
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      // Save to native CLI config (shared with VSCode)
      if (useNativeConfig) {
        const nativeSave = await window.electronAPI.saveCliConfig({
          model: settings.model,
          permissions: {
            mode: settings.permissionMode,
            allow: settings.permissionAllow?.filter(Boolean),
            deny: settings.permissionDeny?.filter(Boolean),
            ask: settings.permissionAsk?.filter(Boolean),
          },
          effortLevel: settings.effortLevel,
          mcpServers,
          enabledPlugins,
          language: settings.language || undefined,
          showThinkingSummaries: settings.showThinkingSummaries,
          alwaysThinkingEnabled: settings.alwaysThinkingEnabled,
          autoMemoryEnabled: settings.autoMemoryEnabled,
          env: Object.keys(settings.envVars ?? {}).length > 0 ? settings.envVars : undefined,
          apiKeyHelper: settings.apiKeyHelper || undefined,
        });
        if (!nativeSave.success) {
          throw new Error(nativeSave.error || 'Failed to save native config');
        }
      }

      // Also save to GUI own settings
      await window.electronAPI.saveSettings(settings);
      // 同步到状态栏 store
      setCurrentStatus(settings.model ?? '', settings.authMode ?? '');

      setSaveStatus('saved');

      // Reload settings to confirm
      setTimeout(() => {
        loadSettings();
        setSaveStatus('idle');
      }, 1000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
    }
  }, [settings, useNativeConfig, loadSettings, mcpServers, enabledPlugins, setCurrentStatus]);


  if (isLoading) {
    return (
      <div style={{ padding: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Settings size={18} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Claude Code 设置</span>
      </div>

      {/* Config Mode Toggle - VSCode Sharing */}
      <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Database size={14} style={{ color: 'var(--accent-color)' }} />
          <span style={{ fontWeight: 500, fontSize: 12 }}>配置文件同步</span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={useNativeConfig}
            onChange={(e) => setUseNativeConfig(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span>与 VSCode Claude Code 插件共享配置</span>
        </label>
        {nativeConfigPath && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, fontFamily: 'monospace', wordBreak: 'break-all' }}>
            配置文件: {nativeConfigPath}
          </div>
        )}
        {nativeSettings && (
          <div style={{ fontSize: 11, color: 'var(--success-text)', marginTop: 4 }}>
            ✓ 已加载{Object.keys(nativeSettings).length} 个配置项
          </div>
        )}
      </div>

      {/* Tab 导航栏 */}
      <TabBar
        tabs={[
          { key: 'model', label: '模型' },
          { key: 'permissions', label: '权限' },
          { key: 'session', label: '会话' },
          { key: 'connection', label: '连接' },
          { key: 'integrations', label: '集成' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'model' && (
        <ModelTab
          settings={settings}
          setSettings={setSettings}
          availableAgents={availableAgents}
          applyPreset={applyPreset}
        />
      )}
      {activeTab === 'permissions' && (
        <PermissionsTab settings={settings} setSettings={setSettings} />
      )}
      {activeTab === 'session' && (
        <SessionTab settings={settings} setSettings={setSettings} />
      )}
      {activeTab === 'connection' && (
        <ConnectionTab
          settings={settings}
          setSettings={setSettings}
          authStatus={authStatus}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
        />
      )}
      {activeTab === 'integrations' && (
        <IntegrationsTab
          mcpServers={mcpServers}
          setMcpServers={setMcpServers}
          enabledPlugins={enabledPlugins}
          setEnabledPlugins={setEnabledPlugins}
        />
      )}

      {/* Save Button */}
      <button
        className="btn btn-primary"
        style={{ width: '100%' }}
        onClick={handleSave}
        disabled={saveStatus === 'saving'}
      >
        {saveStatus === 'saving' && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
        {saveStatus === 'saved' && <Check size={14} />}
        {saveStatus === 'error' && <X size={14} />}
        {saveStatus === 'idle' && '保存设置'}
        {saveStatus === 'saving' && '保存中..'}
        {saveStatus === 'saved' && '已保存'}
        {saveStatus === 'error' && '保存失败'}
      </button>

      {/* VSCode Link */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          保存后设置将与 VSCode Claude Code 插件自动同步
        </p>
      </div>

      {/* 版本信息 + 检查更新 */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px 0' }}>
          Claude Code GUI &nbsp;
          <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            v{typeof window !== 'undefined' ? (window as { __APP_VERSION__?: string }).__APP_VERSION__ ?? '1.0.0' : '1.0.0'}
          </span>
        </p>
        <button
          onClick={async () => {
            if (checkUpdateStatus === 'checking') return;
            setCheckUpdateStatus('checking');
            if (checkUpdateTimerRef.current) clearTimeout(checkUpdateTimerRef.current);
            // 监听一次 updateStatus，捕获 not-available（available 由 UpdateBanner 处理）
            let unsubscribed = false;
            const unsub = window.electronAPI?.onUpdateStatus?.((s) => {
              if (unsubscribed) return;
              if (s.type === 'not-available') {
                setCheckUpdateStatus('latest');
                checkUpdateTimerRef.current = setTimeout(() => setCheckUpdateStatus('idle'), 3000);
                unsubscribed = true;
                unsub?.();
              } else if (s.type === 'available' || s.type === 'downloaded') {
                // UpdateBanner 会接管显示，这里只重置按钮
                setCheckUpdateStatus('idle');
                unsubscribed = true;
                unsub?.();
              } else if (s.type === 'error') {
                setCheckUpdateStatus('error');
                checkUpdateTimerRef.current = setTimeout(() => setCheckUpdateStatus('idle'), 4000);
                unsubscribed = true;
                unsub?.();
              }
            });
            const result = await window.electronAPI?.checkUpdate?.();
            if (!result?.success) {
              setCheckUpdateStatus('error');
              checkUpdateTimerRef.current = setTimeout(() => setCheckUpdateStatus('idle'), 4000);
              unsubscribed = true;
              unsub?.();
            }
          }}
          disabled={checkUpdateStatus === 'checking'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
            padding: '4px 10px', borderRadius: 5, cursor: checkUpdateStatus === 'checking' ? 'not-allowed' : 'pointer',
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            color: checkUpdateStatus === 'latest' ? 'var(--color-success)' : checkUpdateStatus === 'error' ? 'var(--color-error)' : 'var(--text-secondary)',
          }}
        >
          <RefreshCw size={11} className={checkUpdateStatus === 'checking' ? 'spinning' : ''} />
          {checkUpdateStatus === 'checking' ? '检查中…' : checkUpdateStatus === 'latest' ? '✓ 已是最新版' : checkUpdateStatus === 'error' ? '检查失败' : '检查更新'}
        </button>
      </div>
    </div>
  );
}
