import { useState, useEffect, useCallback } from 'react';
import { Settings, Check, X, Loader2, Cpu, Shield, Zap, ChevronDown, ChevronUp, Database, Server, Plus, Trash2, Power } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { TabBar } from './TabBar';
import type { AppSettings, AuthStatus } from '../types';

const MODEL_OPTIONS = [
  { value: 'default', label: '默认 (default)' },
  { value: 'sonnet', label: 'Sonnet (推荐)' },
  { value: 'opus', label: 'Opus (最�?' },
  { value: 'haiku', label: 'Haiku (最�?' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
  { value: 'anthropic.claude-3-5-sonnet-20241022-v2:0', label: 'AWS Bedrock Sonnet v2' },
  { value: 'anthropic/claude-3.5-sonnet', label: 'OpenRouter Claude 3.5 Sonnet' },
  { value: 'meta/llama-3.1-405b-instruct', label: 'Llama 3.1 405B' },
];

const EFFORT_LEVELS = [
  { value: 'low', label: '�? },
  { value: 'medium', label: '�?(默认)' },
  { value: 'high', label: '�? },
  { value: 'xhigh', label: '超高 (xhigh)' },
  { value: 'max', label: '最�?(max)' },
];

const CONFIG_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  settings: Partial<AppSettings>;
}> = [
  {
    id: 'developer',
    label: '开发模�?,
    description: 'Sonnet + 高努�?,
    settings: {
      model: 'sonnet',
      effortLevel: 'high',
    } as Partial<AppSettings>,
  },
  {
    id: 'power',
    label: '强力模式',
    description: 'Opus + 最高努�?,
    settings: {
      model: 'opus',
      effortLevel: 'max',
    } as Partial<AppSettings>,
  },
  {
    id: 'fast',
    label: '快速模�?,
    description: 'Haiku + 低努�?,
    settings: {
      model: 'haiku',
      effortLevel: 'low',
    } as Partial<AppSettings>,
  },
];

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
    allowedTools: 'default',
    extraArgs: '',
    useBareMode: false,
    httpProxy: '',
    apiBaseUrl: '',
    provider: 'anthropic',
  });
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<'model' | 'permissions' | 'session' | 'connection' | 'integrations'>('model');
  const [doctorResult, setDoctorResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [doctorRunning, setDoctorRunning] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [updateRunning, setUpdateRunning] = useState(false);

  // MCP 服务器状�?  const [mcpServers, setMcpServers] = useState<Record<string, any>>({});
  const [showMcpAdd, setShowMcpAdd] = useState(false);
  const [newMcp, setNewMcp] = useState({ name: '', type: 'stdio' as 'stdio' | 'sse', command: '', args: '', url: '' });
  // Plugins 状�?  const [enabledPlugins, setEnabledPlugins] = useState<Record<string, boolean>>({});
  // 可用 agents 列表（从 CLI 加载�?  const [availableAgents, setAvailableAgents] = useState<Array<{ name: string; model: string; type: 'builtin' | 'custom' }>>([]);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    // 加载 agent 列表
    window.electronAPI?.listAgents?.().then((result) => {
      if (result?.success && result.agents) {
        setAvailableAgents(result.agents);
      }
    });
  }, []);

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
        // 初始�?MCP �?Plugins 状�?        setMcpServers(nativeResult.settings.mcpServers ?? {});
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
          useBareMode: guiResult.settings.useBareMode !== undefined ? guiResult.settings.useBareMode : prev.useBareMode,
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
  }, [settings, useNativeConfig, loadSettings]);


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
          <span>�?VSCode Claude Code 插件共享配置</span>
        </label>
        {nativeConfigPath && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, fontFamily: 'monospace', wordBreak: 'break-all' }}>
            配置文件: {nativeConfigPath}
          </div>
        )}
        {nativeSettings && (
          <div style={{ fontSize: 11, color: 'var(--success-text)', marginTop: 4 }}>
            �?已加�?{Object.keys(nativeSettings).length} 个配置项
          </div>
        )}
      </div>

      {/* Tab 导航�?*/}
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

      {/* ===== Tab: 模型 ===== */}
      {activeTab === 'model' && <>

      {/* Quick Presets */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          <Zap size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          快速配�?        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {CONFIG_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className="btn"
              style={{
                fontSize: 11,
                padding: '6px 8px',
                justifyContent: 'center',
              }}
              onClick={() => applyPreset(preset.id)}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Model Selection */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          <Cpu size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          模型选择
        </label>
        <select
          className="input"
          value={settings.model}
          onChange={(e) => setSettings({ ...settings, model: e.target.value })}
          style={{ fontSize: 12, cursor: 'pointer' }}
        >
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          自定义模�? <input
            type="text"
            className="input"
            value={settings.model === 'custom' || !MODEL_OPTIONS.some(m => m.value === settings.model) ? settings.model : ''}
            onChange={(e) => setSettings({ ...settings, model: e.target.value || 'sonnet' })}
            placeholder="输入模型名称..."
            style={{
              fontSize: 11,
              padding: '4px 8px',
              marginTop: 4,
              width: '100%',
              fontFamily: 'monospace',
            }}
          />
        </div>
      </div>

      {/* Effort Level */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          <Zap size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          努力程度 (Effort)
        </label>
        <select
          className="input"
          value={settings.effortLevel || 'medium'}
          onChange={(e) => setSettings({ ...settings, effortLevel: e.target.value as AppSettings['effortLevel'] })}
          style={{ fontSize: 12, cursor: 'pointer' }}
        >
          {EFFORT_LEVELS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* 响应语言（language 设置�?*/}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          响应语言 (language)
        </label>
        <input
          type="text"
          className="input"
          value={settings.language ?? ''}
          onChange={(e) => setSettings({ ...settings, language: e.target.value || undefined })}
          placeholder="留空 = 默认，或喆写 japanese / chinese / spanish / french"
          style={{ fontSize: 12 }}
        />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          对应 settings.json 中的 language 字段，Claude 将优先以该语言回复
        </div>
      </div>

      {/* Agent 选择�?-agent 参数�?*/}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          <Cpu size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          Agent
        </label>
        <select
          className="input"
          value={settings.agent || 'default'}
          onChange={(e) => setSettings({ ...settings, agent: e.target.value })}
          style={{ fontSize: 12, cursor: 'pointer' }}
        >
          <option value="default">默认 (不指�?</option>
          {availableAgents.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name} · {a.model} {a.type === 'custom' ? '(自定�?' : ''}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          对应 CLI 参数 --agent，用于指定子代理策略
        </div>
      </div>

      {/* Permission Mode */}
      </> /* end 模型 Tab */}

      {/* ===== Tab: 权限 ===== */}
      {activeTab === 'permissions' && <>

      {/* Permission Mode */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          <Shield size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          权限模式
        </label>
        <select
          className="input"
          value={settings.permissionMode || 'auto'}
          onChange={(e) => setSettings({ ...settings, permissionMode: e.target.value })}
          style={{ fontSize: 12, cursor: 'pointer' }}
        >
          <option value="auto">auto �?自动判断（推荐）</option>
          <option value="plan">plan �?只读计划，不执行修改</option>
          <option value="acceptEdits">acceptEdits �?自动接受文件编辑</option>
          <option value="dontAsk">dontAsk �?不询问，完全自主</option>
          <option value="bypassPermissions">�?bypassPermissions �?绕过所有权�?/option>
        </select>
      </div>

      {/* 精细权限规则 (allow / deny / ask) */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          <Shield size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          精细权限规则
        </label>
        {(
          [
            { key: 'permissionAllow' as const, label: '允许 (allow)', placeholder: '例：Bash(git *) �?Read' },
            { key: 'permissionDeny'  as const, label: '拒绝 (deny)',  placeholder: '例：Read(.env) �?Bash(rm:*)' },
            { key: 'permissionAsk'  as const, label: '询问 (ask)',   placeholder: '例：WebFetch' },
          ] as const
        ).map(({ key, label, placeholder }) => (
          <div key={key} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}�?/div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(settings[key] ?? []).map((rule, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="input"
                    value={rule}
                    onChange={(e) => {
                      const next = [...(settings[key] ?? [])];
                      next[i] = e.target.value;
                      setSettings({ ...settings, [key]: next });
                    }}
                    placeholder={placeholder}
                    style={{ fontSize: 11, fontFamily: 'monospace', flex: 1 }}
                  />
                  <button
                    onClick={() => {
                      const next = (settings[key] ?? []).filter((_, j) => j !== i);
                      setSettings({ ...settings, [key]: next });
                    }}
                    style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 4, color: '#ef4444', cursor: 'pointer', padding: '3px 7px', fontSize: 13, flexShrink: 0 }}
                    title="移除"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => setSettings({ ...settings, [key]: [...(settings[key] ?? []), ''] })}
                style={{
                  background: 'none', border: '1px dashed var(--border-color)',
                  borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer',
                  padding: '4px 10px', fontSize: 12, textAlign: 'left',
                }}
              >
                + 添加规则
              </button>
            </div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          写入 settings.json permissions.allow/deny/ask，支�?Tool(pattern) 格式
        </div>
      </div>

      {/* 工具控制 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          工具控制
        </label>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>允许的工�?(--tools)�?/div>
          <input
            type="text"
            className="input"
            value={settings.allowedTools === 'default' ? '' : (settings.allowedTools ?? '')}
            onChange={(e) => setSettings({ ...settings, allowedTools: e.target.value || 'default' })}
            placeholder="默认（全部工具），或填写 Bash,Edit,Read"
            style={{ fontSize: 11, fontFamily: 'monospace' }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>禁止的工�?(--disallowed-tools)�?/div>
          <input
            type="text"
            className="input"
            value={settings.disallowedTools ?? ''}
            onChange={(e) => setSettings({ ...settings, disallowedTools: e.target.value })}
            placeholder="留空则不禁止，或填写 Bash(git:*) WebFetch"
            style={{ fontSize: 11, fontFamily: 'monospace' }}
          />
        </div>
      </div>

      {/* 额外目录访问权限 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          额外目录访问 (--add-dir)
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(settings.addDirs ?? []).map((dir, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                className="input"
                value={dir}
                onChange={(e) => {
                  const next = [...(settings.addDirs ?? [])];
                  next[i] = e.target.value;
                  setSettings({ ...settings, addDirs: next });
                }}
                placeholder="D:\project\my-lib"
                style={{ fontSize: 11, fontFamily: 'monospace', flex: 1 }}
              />
              <button
                onClick={() => {
                  const next = (settings.addDirs ?? []).filter((_, j) => j !== i);
                  setSettings({ ...settings, addDirs: next });
                }}
                style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 4, color: '#ef4444', cursor: 'pointer', padding: '3px 7px', fontSize: 13, flexShrink: 0 }}
                title="移除"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() => setSettings({ ...settings, addDirs: [...(settings.addDirs ?? []), ''] })}
            style={{
              background: 'none', border: '1px dashed var(--border-color)',
              borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer',
              padding: '4px 10px', fontSize: 12, textAlign: 'left',
            }}
          >
            + 添加目录
          </button>
        </div>
      </div>

      {/* 思维 (Thinking) 设置 */}
      </> /* end 权限 Tab */}

      {/* ===== Tab: 会话 ===== */}
      {activeTab === 'session' && <>

      {/* 思维 (Thinking) 设置 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          思维 (Thinking) 设置
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.alwaysThinkingEnabled ?? false}
              onChange={(e) => setSettings({ ...settings, alwaysThinkingEnabled: e.target.checked })}
            />
            <span>所有会话默认开启扩展思维 (alwaysThinkingEnabled)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.showThinkingSummaries ?? false}
              onChange={(e) => setSettings({ ...settings, showThinkingSummaries: e.target.checked })}
            />
            <span>在界面中显示思维摘要 (showThinkingSummaries)</span>
          </label>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          这些选项写入 ~/.claude/settings.json，影响所有会�?        </div>
      </div>

      {/* 自动记忆 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.autoMemoryEnabled ?? true}
            onChange={(e) => setSettings({ ...settings, autoMemoryEnabled: e.target.checked })}
          />
          <span style={{ fontWeight: 500 }}>自动记忆 (autoMemoryEnabled)</span>
        </label>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, marginLeft: 20 }}>
          开启时 Claude 会读�?CLAUDE.md 记忆文件；关闭时跳过记忆目录
        </div>
      </div>

      {/* 最�?Agentic 轮次 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          最�?Agentic 轮次 (--max-turns)
        </label>
        <input
          type="number"
          className="input"
          value={settings.maxTurns ?? ''}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            setSettings({ ...settings, maxTurns: isNaN(v) || v <= 0 ? undefined : v });
          }}
          placeholder="留空 = 不限制（默认�?
          min={1}
          max={999}
          style={{ fontSize: 12, width: 140 }}
        />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          对应 CLI --max-turns 参数，限制每次任务最多执行多少轮工具调用
        </div>
      </div>

      {/* 环境变量 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          环境变量 (env)
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Object.entries(settings.envVars ?? {}).map(([k, v], i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                className="input"
                value={k}
                onChange={(e) => {
                  const entries = Object.entries(settings.envVars ?? {});
                  entries[i] = [e.target.value, entries[i][1]];
                  setSettings({ ...settings, envVars: Object.fromEntries(entries) });
                }}
                placeholder="KEY"
                style={{ fontSize: 11, fontFamily: 'monospace', flex: 1 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>=</span>
              <input
                type="text"
                className="input"
                value={v}
                onChange={(e) => {
                  const entries = Object.entries(settings.envVars ?? {});
                  entries[i] = [entries[i][0], e.target.value];
                  setSettings({ ...settings, envVars: Object.fromEntries(entries) });
                }}
                placeholder="VALUE"
                style={{ fontSize: 11, fontFamily: 'monospace', flex: 2 }}
              />
              <button
                onClick={() => {
                  const entries = Object.entries(settings.envVars ?? {}).filter((_, j) => j !== i);
                  setSettings({ ...settings, envVars: Object.fromEntries(entries) });
                }}
                style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 4, color: '#ef4444', cursor: 'pointer', padding: '3px 7px', fontSize: 13, flexShrink: 0 }}
                title="移除"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const entries = Object.entries(settings.envVars ?? {});
              entries.push(['', '']);
              setSettings({ ...settings, envVars: Object.fromEntries(entries) });
            }}
            style={{
              background: 'none', border: '1px dashed var(--border-color)',
              borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer',
              padding: '4px 10px', fontSize: 12, textAlign: 'left',
            }}
          >
            + 添加变量
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          写入 settings.json env 字段，在每次 Claude 会话中注入环境变�?        </div>
      </div>

      {/* Auth Status */}
      </> /* end 会话 Tab */}

      {/* ===== Tab: 连接 ===== */}
      {activeTab === 'connection' && <>

      {/* Auth Status */}
      <div
        style={{
          padding: 12,
          borderRadius: 6,
          background: (authStatus?.loggedIn || (settings.authMode === 'api-key' && settings.apiKey)) ? 'var(--success-bg)' : 'var(--warning-bg)',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {(authStatus?.loggedIn || (settings.authMode === 'api-key' && settings.apiKey)) ? (
          <Check size={16} style={{ color: 'var(--success-text)' }} />
        ) : (
          <X size={16} style={{ color: 'var(--warning-text)' }} />
        )}
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: (authStatus?.loggedIn || (settings.authMode === 'api-key' && settings.apiKey)) ? 'var(--success-text)' : 'var(--warning-text)' }}>
            {(settings.authMode === 'api-key' && settings.apiKey) ? '�?自定�?API 已配�? : (authStatus?.loggedIn ? '�?官方已授�? : '�?未授�?)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {settings.authMode === 'api-key' ? (
              '使用自定�?API Key 认证'
            ) : (
              <>
                {authStatus?.authMethod && `认证方式: ${authStatus.authMethod}`}
                {authStatus?.apiProvider && ` · 供应�? ${authStatus.apiProvider}`}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Official Login Button */}
      {settings.authMode === 'official' && (!authStatus?.loggedIn) && (
        <button
          className="btn"
          style={{
            width: '100%',
            marginBottom: 16,
            background: 'var(--accent-color)',
          }}
          onClick={async () => {
            await window.electronAPI.launchOfficialLogin();
          }}
        >
          官方登录
        </button>
      )}

      {/* CLI 维护 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>CLI 维护</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <button
            className="btn"
            disabled={doctorRunning}
            style={{ fontSize: 12, flex: 1 }}
            onClick={async () => {
              setDoctorRunning(true);
              setDoctorResult(null);
              const res = await window.electronAPI.cliDoctor();
              setDoctorResult({ ok: res.success, text: res.output ?? res.error ?? '（无输出�? });
              setDoctorRunning(false);
            }}
          >
            {doctorRunning ? '检查中...' : '🩺 健康诊断 (doctor)'}
          </button>
          <button
            className="btn"
            disabled={updateRunning}
            style={{ fontSize: 12, flex: 1 }}
            onClick={async () => {
              setUpdateRunning(true);
              setUpdateResult(null);
              const res = await window.electronAPI.cliUpdate('update');
              setUpdateResult({ ok: res.success, text: res.output });
              setUpdateRunning(false);
            }}
          >
            {updateRunning ? '更新�?..' : '�?更新 CLI (update)'}
          </button>
        </div>
        {doctorResult && (
          <pre style={{
            fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            background: doctorResult.ok ? 'var(--success-bg)' : 'var(--warning-bg)',
            color: doctorResult.ok ? 'var(--success-text)' : 'var(--warning-text)',
            padding: '8px 10px', borderRadius: 4, margin: 0, maxHeight: 160, overflow: 'auto',
          }}>{doctorResult.text}</pre>
        )}
        {updateResult && (
          <pre style={{
            fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            background: updateResult.ok ? 'var(--success-bg)' : 'var(--warning-bg)',
            color: updateResult.ok ? 'var(--success-text)' : 'var(--warning-text)',
            padding: '8px 10px', borderRadius: 4, margin: 0, maxHeight: 160, overflow: 'auto',
          }}>{updateResult.text}</pre>
        )}
      </div>

      {/* Advanced Settings Toggle */}
      <div
        style={{
          marginBottom: 12,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        <span>高级设置</span>
      </div>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 6 }}>
          {/* Bare Mode */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.useBareMode}
                onChange={(e) => setSettings({ ...settings, useBareMode: e.target.checked })}
                style={{ cursor: 'pointer' }}
              />
              Bare Mode (跳过钩子、LSP�?
            </label>
          </div>

          {/* 扩展思�?*/}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.enableThinking ?? false}
                onChange={(e) => setSettings({ ...settings, enableThinking: e.target.checked })}
                style={{ cursor: 'pointer' }}
              />
              🤔 扩展思考（Extended Thinking�?            </label>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, marginLeft: 20 }}>
              通过 Beta Header 激活思考链（仅 API Key 模式有效）。使用支�?Extended Thinking 的模型时，消息上方会显示可折叠的"推理过程"�?            </div>
          </div>

          {/* API Base URL for proxies */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
              API Base URL (中转/代理)
            </label>
            <input
              type="text"
              className="input"
              value={settings.apiBaseUrl}
              onChange={(e) => {
                const newApiBaseUrl = e.target.value;
                setSettings(prev => {
                  const newSettings = { ...prev, apiBaseUrl: newApiBaseUrl };
                  // If user enters custom API URL, auto-switch to api-key mode
                  if (newApiBaseUrl && newApiBaseUrl.trim() && prev.authMode === 'official') {
                    newSettings.authMode = 'api-key';
                  }
                  return newSettings;
                });
              }}
              placeholder="https://api.example.com/v1"
              style={{ fontSize: 11, fontFamily: 'monospace' }}
            />
            {settings.apiBaseUrl && settings.authMode === 'api-key' && (
              <div style={{ fontSize: 11, color: 'var(--success-text)', marginTop: 4 }}>
                �?已配置自定义 API，将跳过官方登录
              </div>
            )}
          </div>

          {/* Auth Mode Selection */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
              认证模式
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', flex: 1 }}>
                <input
                  type="radio"
                  name="authMode"
                  checked={settings.authMode === 'official'}
                  onChange={() => setSettings({ ...settings, authMode: 'official' })}
                  style={{ cursor: 'pointer' }}
                />
                官方登录
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', flex: 1 }}>
                <input
                  type="radio"
                  name="authMode"
                  checked={settings.authMode === 'api-key'}
                  onChange={() => setSettings({ ...settings, authMode: 'api-key' })}
                  style={{ cursor: 'pointer' }}
                />
                API Key
              </label>
            </div>
          </div>

          {/* API Key Input */}
          {settings.authMode === 'api-key' && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
                API Key
              </label>
              <input
                type="password"
                className="input"
                value={settings.apiKey}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                placeholder="sk-..."
                style={{ fontSize: 11, fontFamily: 'monospace' }}
              />
            </div>
          )}

          {/* HTTP Proxy */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
              HTTP 代理
            </label>
            <input
              type="text"
              className="input"
              value={settings.httpProxy}
              onChange={(e) => setSettings({ ...settings, httpProxy: e.target.value })}
              placeholder="http://127.0.0.1:7890"
              style={{ fontSize: 11, fontFamily: 'monospace' }}
            />
          </div>

          {/* LLM Gateway 高级选项 */}
          {settings.apiBaseUrl && (
            <div style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                LLM Gateway 高级选项
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                  Bearer Auth Token（ANTHROPIC_AUTH_TOKEN，优先于 API Key�?                </label>
                <input
                  type="password"
                  className="input"
                  value={settings.gatewayAuthToken || ''}
                  onChange={(e) => setSettings({ ...settings, gatewayAuthToken: e.target.value })}
                  placeholder="sk-litellm-..."
                  style={{ fontSize: 11, fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                  自定义请求头（ANTHROPIC_CUSTOM_HEADERS，JSON 格式�?                </label>
                <input
                  type="text"
                  className="input"
                  value={settings.gatewayCustomHeaders || ''}
                  onChange={(e) => setSettings({ ...settings, gatewayCustomHeaders: e.target.value })}
                  placeholder='{"X-LiteLLM-Team-Id":"team-123"}'
                  style={{ fontSize: 11, fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                  动�?Key 脚本路径（apiKeyHelper，写�?~/.claude/settings.json�?                </label>
                <input
                  type="text"
                  className="input"
                  value={settings.apiKeyHelper || ''}
                  onChange={(e) => setSettings({ ...settings, apiKeyHelper: e.target.value })}
                  placeholder="~/bin/get-litellm-key.sh"
                  style={{ fontSize: 11, fontFamily: 'monospace' }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.enableGatewayModelDiscovery ?? false}
                  onChange={(e) => setSettings({ ...settings, enableGatewayModelDiscovery: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
                启用网关模型自动发现（CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY�?              </label>
            </div>
          )}

          {/* Cloud Provider 选择 */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
              云服务商 (Provider)
            </label>
            <select
              className="input"
              value={settings.provider || 'anthropic'}
              onChange={(e) => setSettings({ ...settings, provider: e.target.value })}
              style={{ fontSize: 11 }}
            >
              <option value="anthropic">Anthropic（默认）</option>
              <option value="bedrock">AWS Bedrock</option>
              <option value="vertex">Google Vertex AI</option>
              <option value="foundry">Microsoft Azure Foundry</option>
            </select>
          </div>

          {/* AWS Bedrock 凭证 */}
          {settings.provider === 'bedrock' && (
            <div style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                AWS Bedrock 凭证
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>AWS Region</label>
                  <input
                    type="text"
                    className="input"
                    value={settings.awsRegion || ''}
                    onChange={(e) => setSettings({ ...settings, awsRegion: e.target.value })}
                    placeholder="us-east-1"
                    style={{ fontSize: 11, fontFamily: 'monospace' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Session Token（可选）</label>
                  <input
                    type="password"
                    className="input"
                    value={settings.awsSessionToken || ''}
                    onChange={(e) => setSettings({ ...settings, awsSessionToken: e.target.value })}
                    placeholder="临时会话 Token"
                    style={{ fontSize: 11, fontFamily: 'monospace' }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Access Key ID</label>
                <input
                  type="text"
                  className="input"
                  value={settings.awsAccessKeyId || ''}
                  onChange={(e) => setSettings({ ...settings, awsAccessKeyId: e.target.value })}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  style={{ fontSize: 11, fontFamily: 'monospace' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Secret Access Key</label>
                <input
                  type="password"
                  className="input"
                  value={settings.awsSecretAccessKey || ''}
                  onChange={(e) => setSettings({ ...settings, awsSecretAccessKey: e.target.value })}
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  style={{ fontSize: 11, fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                留空则使�?AWS 默认凭证链（~/.aws/credentials / IAM Role / 环境变量�?              </div>
            </div>
          )}

          {/* Google Vertex AI 配置 */}
          {settings.provider === 'vertex' && (
            <div style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                Google Vertex AI 配置
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>GCP Project ID</label>
                  <input
                    type="text"
                    className="input"
                    value={settings.vertexProjectId || ''}
                    onChange={(e) => setSettings({ ...settings, vertexProjectId: e.target.value })}
                    placeholder="my-gcp-project"
                    style={{ fontSize: 11, fontFamily: 'monospace' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Region</label>
                  <input
                    type="text"
                    className="input"
                    value={settings.vertexRegion || ''}
                    onChange={(e) => setSettings({ ...settings, vertexRegion: e.target.value })}
                    placeholder="us-east5"
                    style={{ fontSize: 11, fontFamily: 'monospace' }}
                  />
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                认证通过 Application Default Credentials（gcloud auth application-default login�?              </div>
            </div>
          )}

          {/* Microsoft Azure Foundry 配置 */}
          {settings.provider === 'foundry' && (
            <div style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                Microsoft Azure Foundry 配置
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Foundry API Key（可选，留空则使�?Entra ID 凭证链）</label>
                <input
                  type="password"
                  className="input"
                  value={settings.foundryApiKey || ''}
                  onChange={(e) => setSettings({ ...settings, foundryApiKey: e.target.value })}
                  placeholder="Azure API Key"
                  style={{ fontSize: 11, fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>资源名称（Resource Name�?/label>
                <input
                  type="text"
                  className="input"
                  value={settings.foundryResource || ''}
                  onChange={(e) => setSettings({ ...settings, foundryResource: e.target.value })}
                  placeholder="my-azure-resource"
                  style={{ fontSize: 11, fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ marginBottom: 4 }}>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Base URL（可选，替代资源名称�?/label>
                <input
                  type="text"
                  className="input"
                  value={settings.foundryBaseUrl || ''}
                  onChange={(e) => setSettings({ ...settings, foundryBaseUrl: e.target.value })}
                  placeholder="https://{resource}.services.ai.azure.com/anthropic"
                  style={{ fontSize: 11, fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                未设�?API Key 时自动使�?Azure SDK 默认凭证链（az login / Managed Identity�?              </div>
            </div>
          )}

          {/* Extra CLI Args */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
              额外命令行参�?            </label>
            <input
              type="text"
              className="input"
              value={settings.extraArgs}
              onChange={(e) => setSettings({ ...settings, extraArgs: e.target.value })}
              placeholder="--verbose --no-stream"
              style={{ fontSize: 11, fontFamily: 'monospace' }}
            />
          </div>

          {/* 会话命名 + 费用上限 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
                默认会话名称 (--name)
              </label>
              <input
                type="text"
                className="input"
                value={settings.sessionName ?? ''}
                onChange={(e) => setSettings({ ...settings, sessionName: e.target.value })}
                placeholder="我的项目 · Sprint 3"
                style={{ fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
                费用上限 USD (--max-budget-usd)
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                className="input"
                value={settings.maxBudgetUsd ?? ''}
                onChange={(e) => setSettings({ ...settings, maxBudgetUsd: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="0 = 不限�?
                style={{ fontSize: 12 }}
              />
            </div>
          </div>

          {/* 附加系统提示�?*/}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
              系统提示�?            </label>
            {/* 模式选择 */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              {(['append', 'replace'] as const).map(mode => (
                <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
                  <input
                    type="radio"
                    name="systemPromptMode"
                    value={mode}
                    checked={(settings.systemPromptMode ?? 'append') === mode}
                    onChange={() => setSettings({ ...settings, systemPromptMode: mode })}
                    style={{ accentColor: 'var(--accent-color)' }}
                  />
                  {mode === 'append' ? '追加到默认提示词' : '完全替换系统提示�?}
                </label>
              ))}
            </div>
            {(settings.systemPromptMode ?? 'append') === 'replace' && (
              <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 6, padding: '4px 8px', background: 'rgba(245,158,11,0.1)', borderRadius: 4 }}>
                �?替换模式会完全覆�?Claude 的默认系统提示词，仅在了解影响时使用
              </div>
            )}
            <textarea
              className="input"
              value={settings.systemPrompt ?? ''}
              onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
              placeholder={(settings.systemPromptMode ?? 'append') === 'replace'
                ? '自定义系统提示词，将完全替换默认提示词（--system-prompt�?
                : '每次对话自动追加的自定义指令�?-append-system-prompt�?}
              rows={3}
              style={{ fontSize: 11, fontFamily: 'monospace', resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      )}

      {/* MCP 服务器管�?*/}
      </> /* end 连接 Tab */}

      {/* ===== Tab: 集成 ===== */}
      {activeTab === 'integrations' && <>

      {/* MCP 服务器管�?*/}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}
          onClick={() => setShowMcpAdd(false)}
        >
          <Server size={14} style={{ color: 'var(--accent-color)' }} />
          <span style={{ fontWeight: 500, fontSize: 12, flex: 1 }}>MCP 服务�?/span>
          <span style={{
            background: 'var(--accent-color)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 10,
            padding: '1px 7px',
            minWidth: 20,
            textAlign: 'center',
          }}>
            {Object.keys(mcpServers).length}
          </span>
        </div>

        {/* 已配置的 MCP 服务器列�?*/}
        {Object.entries(mcpServers).map(([name, cfg]) => (
          <div key={name} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '8px 10px',
            background: 'var(--bg-tertiary)',
            borderRadius: 6,
            marginBottom: 6,
            fontSize: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{name}</div>
              <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
                {cfg.type === 'sse' ? `SSE: ${cfg.url}` : `${cfg.command}${cfg.args?.length ? ' ' + cfg.args.join(' ') : ''}`}
              </div>
            </div>
            <button
              className="btn"
              style={{ padding: '3px 7px', fontSize: 11, flexShrink: 0 }}
              title={`删除 ${name}`}
              onClick={() => {
                const updated = { ...mcpServers };
                delete updated[name];
                setMcpServers(updated);
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        {/* 添加�?MCP 服务�?*/}
        {showMcpAdd ? (
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 10, marginBottom: 6 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <input
                type="text"
                className="input"
                placeholder="服务器名称（�?filesystem�?
                value={newMcp.name}
                onChange={(e) => setNewMcp({ ...newMcp, name: e.target.value })}
                style={{ fontSize: 11 }}
              />
              <select
                className="input"
                value={newMcp.type}
                onChange={(e) => setNewMcp({ ...newMcp, type: e.target.value as 'stdio' | 'sse' })}
                style={{ fontSize: 11, cursor: 'pointer' }}
              >
                <option value="stdio">stdio（本地进程）</option>
                <option value="sse">SSE（远�?HTTP�?/option>
              </select>
              {newMcp.type === 'stdio' ? (
                <>
                  <input
                    type="text"
                    className="input"
                    placeholder="命令（如 node、npx�?
                    value={newMcp.command}
                    onChange={(e) => setNewMcp({ ...newMcp, command: e.target.value })}
                    style={{ fontSize: 11, fontFamily: 'monospace' }}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="参数，空格分隔（�?/path/to/server.js�?
                    value={newMcp.args}
                    onChange={(e) => setNewMcp({ ...newMcp, args: e.target.value })}
                    style={{ fontSize: 11, fontFamily: 'monospace' }}
                  />
                </>
              ) : (
                <input
                  type="text"
                  className="input"
                  placeholder="URL（如 http://localhost:3001/sse�?
                  value={newMcp.url}
                  onChange={(e) => setNewMcp({ ...newMcp, url: e.target.value })}
                  style={{ fontSize: 11, fontFamily: 'monospace' }}
                />
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, fontSize: 11 }}
                disabled={!newMcp.name.trim() || (newMcp.type === 'stdio' ? !newMcp.command.trim() : !newMcp.url.trim())}
                onClick={() => {
                  if (!newMcp.name.trim()) return;
                  const cfg: any = { type: newMcp.type };
                  if (newMcp.type === 'stdio') {
                    cfg.command = newMcp.command.trim();
                    cfg.args = newMcp.args.trim() ? newMcp.args.trim().split(/\s+/) : [];
                  } else {
                    cfg.url = newMcp.url.trim();
                  }
                  setMcpServers({ ...mcpServers, [newMcp.name.trim()]: cfg });
                  setNewMcp({ name: '', type: 'stdio', command: '', args: '', url: '' });
                  setShowMcpAdd(false);
                }}
              >
                <Check size={12} /> 确认添加
              </button>
              <button
                className="btn"
                style={{ flex: 1, fontSize: 11 }}
                onClick={() => { setShowMcpAdd(false); setNewMcp({ name: '', type: 'stdio', command: '', args: '', url: '' }); }}
              >
                <X size={12} /> 取消
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn"
            style={{ width: '100%', fontSize: 11, justifyContent: 'center' }}
            onClick={() => setShowMcpAdd(true)}
          >
            <Plus size={12} /> 添加 MCP 服务�?          </button>
        )}
      </div>

      {/* Plugins 管理 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Power size={14} style={{ color: 'var(--accent-color)' }} />
          <span style={{ fontWeight: 500, fontSize: 12, flex: 1 }}>已安装插�?/span>
        </div>
        {Object.keys(enabledPlugins).length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 0', fontStyle: 'italic' }}>
            暂无已安装插件（�?Claude CLI 自动管理�?          </div>
        ) : (
          Object.entries(enabledPlugins).map(([name, enabled]) => (
            <div key={name} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              background: 'var(--bg-tertiary)',
              borderRadius: 6,
              marginBottom: 6,
              fontSize: 12,
            }}>
              <span style={{ flex: 1, color: 'var(--text-primary)' }}>{name}</span>
              <button
                className={`btn ${enabled ? 'btn-primary' : ''}`}
                style={{ padding: '3px 10px', fontSize: 11 }}
                onClick={() => setEnabledPlugins({ ...enabledPlugins, [name]: !enabled })}
              >
                {enabled ? '已启�? : '已禁�?}
              </button>
            </div>
          ))
        )}
      </div>

      </> /* end 集成 Tab */}

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
        {saveStatus === 'saving' && '保存�?..'}
        {saveStatus === 'saved' && '已保�?}
        {saveStatus === 'error' && '保存失败'}
      </button>

      {/* VSCode Link */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          保存后设置将�?VSCode Claude Code 插件自动同步
        </p>
      </div>

      {/* 版本信息 */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
          Claude Code GUI &nbsp;
          <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            v{typeof window !== 'undefined' ? (window as { __APP_VERSION__?: string }).__APP_VERSION__ ?? '1.0.0' : '1.0.0'}
          </span>
        </p>
      </div>
    </div>
  );
}
