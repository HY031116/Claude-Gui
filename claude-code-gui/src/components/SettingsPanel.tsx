import { useState, useEffect, useCallback } from 'react';
import { Settings, Check, X, Loader2, Cpu, Shield, Zap, ChevronDown, ChevronUp, Database, Server, Plus, Trash2, Power } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import type { AppSettings, AuthStatus } from '../types';

const MODEL_OPTIONS = [
  { value: 'default', label: '默认 (default)' },
  { value: 'sonnet', label: 'Sonnet (推荐)' },
  { value: 'opus', label: 'Opus (最强)' },
  { value: 'haiku', label: 'Haiku (最快)' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
  { value: 'anthropic.claude-3-5-sonnet-20241022-v2:0', label: 'AWS Bedrock Sonnet v2' },
  { value: 'anthropic/claude-3.5-sonnet', label: 'OpenRouter Claude 3.5 Sonnet' },
  { value: 'meta/llama-3.1-405b-instruct', label: 'Llama 3.1 405B' },
];

const EFFORT_LEVELS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中 (默认)' },
  { value: 'high', label: '高' },
  { value: 'max', label: '最高' },
];

const CONFIG_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  settings: Partial<AppSettings>;
}> = [
  {
    id: 'developer',
    label: '开发模式',
    description: 'Sonnet + 高努力',
    settings: {
      model: 'sonnet',
      effortLevel: 'high',
    } as Partial<AppSettings>,
  },
  {
    id: 'power',
    label: '强力模式',
    description: 'Opus + 最高努力',
    settings: {
      model: 'opus',
      effortLevel: 'max',
    } as Partial<AppSettings>,
  },
  {
    id: 'fast',
    label: '快速模式',
    description: 'Haiku + 低努力',
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
  const [doctorResult, setDoctorResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [doctorRunning, setDoctorRunning] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [updateRunning, setUpdateRunning] = useState(false);

  // MCP 服务器状态
  const [mcpServers, setMcpServers] = useState<Record<string, any>>({});
  const [showMcpAdd, setShowMcpAdd] = useState(false);
  const [newMcp, setNewMcp] = useState({ name: '', type: 'stdio' as 'stdio' | 'sse', command: '', args: '', url: '' });
  // Plugins 状态
  const [enabledPlugins, setEnabledPlugins] = useState<Record<string, boolean>>({});
  // 可用 agents 列表（从 CLI 加载）
  const [availableAgents, setAvailableAgents] = useState<Array<{ name: string; model: string; type: 'builtin' | 'custom' }>>([]);

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
          },
          effortLevel: settings.effortLevel,
          mcpServers,
          enabledPlugins,
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
          <span>与 VSCode Claude Code 插件共享配置</span>
        </label>
        {nativeConfigPath && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, fontFamily: 'monospace', wordBreak: 'break-all' }}>
            配置文件: {nativeConfigPath}
          </div>
        )}
        {nativeSettings && (
          <div style={{ fontSize: 11, color: 'var(--success-text)', marginTop: 4 }}>
            ✓ 已加载 {Object.keys(nativeSettings).length} 个配置项
          </div>
        )}
      </div>

      {/* Quick Presets */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          <Zap size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          快速配置
        </label>
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
          自定义模型: <input
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

      {/* Agent 选择（--agent 参数） */}
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
          <option value="default">默认 (不指定)</option>
          {availableAgents.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name} · {a.model} {a.type === 'custom' ? '(自定义)' : ''}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          对应 CLI 参数 --agent，用于指定子代理策略
        </div>
      </div>

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
          <option value="default">默认</option>
          <option value="auto">自动 (推荐)</option>
          <option value="acceptEdits">自动接受编辑</option>
          <option value="dontAsk">不询问</option>
          <option value="plan">计划模式</option>
        </select>
      </div>

      {/* 工具控制 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          工具控制
        </label>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>允许的工具 (--tools)：</div>
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
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>禁止的工具 (--disallowed-tools)：</div>
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
            {(settings.authMode === 'api-key' && settings.apiKey) ? '✓ 自定义 API 已配置' : (authStatus?.loggedIn ? '✓ 官方已授权' : '✗ 未授权')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {settings.authMode === 'api-key' ? (
              '使用自定义 API Key 认证'
            ) : (
              <>
                {authStatus?.authMethod && `认证方式: ${authStatus.authMethod}`}
                {authStatus?.apiProvider && ` · 供应商: ${authStatus.apiProvider}`}
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
              setDoctorResult({ ok: res.success, text: res.output ?? res.error ?? '（无输出）' });
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
            {updateRunning ? '更新中...' : '⬆ 更新 CLI (update)'}
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
              Bare Mode (跳过钩子、LSP等)
            </label>
          </div>

          {/* 扩展思考 */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.enableThinking ?? false}
                onChange={(e) => setSettings({ ...settings, enableThinking: e.target.checked })}
                style={{ cursor: 'pointer' }}
              />
              🤔 扩展思考（Extended Thinking）
            </label>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, marginLeft: 20 }}>
              通过 Beta Header 激活思考链（仅 API Key 模式有效）。使用支持 Extended Thinking 的模型时，消息上方会显示可折叠的"推理过程"。
            </div>
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
                ✓ 已配置自定义 API，将跳过官方登录
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
                留空则使用 AWS 默认凭证链（~/.aws/credentials / IAM Role / 环境变量）
              </div>
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
                认证通过 Application Default Credentials（gcloud auth application-default login）
              </div>
            </div>
          )}

          {/* Extra CLI Args */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
              额外命令行参数
            </label>
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
                placeholder="0 = 不限制"
                style={{ fontSize: 12 }}
              />
            </div>
          </div>

          {/* 附加系统提示词 */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
              系统提示词
            </label>
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
                  {mode === 'append' ? '追加到默认提示词' : '完全替换系统提示词'}
                </label>
              ))}
            </div>
            {(settings.systemPromptMode ?? 'append') === 'replace' && (
              <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 6, padding: '4px 8px', background: 'rgba(245,158,11,0.1)', borderRadius: 4 }}>
                ⚠ 替换模式会完全覆盖 Claude 的默认系统提示词，仅在了解影响时使用
              </div>
            )}
            <textarea
              className="input"
              value={settings.systemPrompt ?? ''}
              onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
              placeholder={(settings.systemPromptMode ?? 'append') === 'replace'
                ? '自定义系统提示词，将完全替换默认提示词（--system-prompt）'
                : '每次对话自动追加的自定义指令（--append-system-prompt）'}
              rows={3}
              style={{ fontSize: 11, fontFamily: 'monospace', resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      )}

      {/* MCP 服务器管理 */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}
          onClick={() => setShowMcpAdd(false)}
        >
          <Server size={14} style={{ color: 'var(--accent-color)' }} />
          <span style={{ fontWeight: 500, fontSize: 12, flex: 1 }}>MCP 服务器</span>
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

        {/* 已配置的 MCP 服务器列表 */}
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

        {/* 添加新 MCP 服务器 */}
        {showMcpAdd ? (
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 10, marginBottom: 6 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <input
                type="text"
                className="input"
                placeholder="服务器名称（如 filesystem）"
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
                <option value="sse">SSE（远端 HTTP）</option>
              </select>
              {newMcp.type === 'stdio' ? (
                <>
                  <input
                    type="text"
                    className="input"
                    placeholder="命令（如 node、npx）"
                    value={newMcp.command}
                    onChange={(e) => setNewMcp({ ...newMcp, command: e.target.value })}
                    style={{ fontSize: 11, fontFamily: 'monospace' }}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="参数，空格分隔（如 /path/to/server.js）"
                    value={newMcp.args}
                    onChange={(e) => setNewMcp({ ...newMcp, args: e.target.value })}
                    style={{ fontSize: 11, fontFamily: 'monospace' }}
                  />
                </>
              ) : (
                <input
                  type="text"
                  className="input"
                  placeholder="URL（如 http://localhost:3001/sse）"
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
            <Plus size={12} /> 添加 MCP 服务器
          </button>
        )}
      </div>

      {/* Plugins 管理 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Power size={14} style={{ color: 'var(--accent-color)' }} />
          <span style={{ fontWeight: 500, fontSize: 12, flex: 1 }}>已安装插件</span>
        </div>
        {Object.keys(enabledPlugins).length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 0', fontStyle: 'italic' }}>
            暂无已安装插件（由 Claude CLI 自动管理）
          </div>
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
                {enabled ? '已启用' : '已禁用'}
              </button>
            </div>
          ))
        )}
      </div>

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
        {saveStatus === 'saving' && '保存中...'}
        {saveStatus === 'saved' && '已保存'}
        {saveStatus === 'error' && '保存失败'}
      </button>

      {/* VSCode Link */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          保存后设置将与 VSCode Claude Code 插件自动同步
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
