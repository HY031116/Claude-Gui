import { useState, useRef } from 'react';
import { Check, X, ChevronDown, ChevronUp, BookmarkPlus, Trash2 } from 'lucide-react';
import type { AppSettings, AuthStatus, ApiProfile } from '../../types';

interface ConnectionTabProps {
  settings: AppSettings;
  setSettings: (s: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
  authStatus: AuthStatus | null;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
}

/** 从 settings 中提取配置文件字段 */
function extractProfileFields(s: AppSettings): Omit<ApiProfile, 'id' | 'name'> {
  return {
    authMode: s.authMode,
    apiKey: s.apiKey,
    apiBaseUrl: s.apiBaseUrl,
    httpProxy: s.httpProxy,
    provider: s.provider,
  };
}

export function ConnectionTab({
  settings,
  setSettings,
  authStatus,
  showAdvanced,
  setShowAdvanced,
}: ConnectionTabProps) {
  const [doctorRunning, setDoctorRunning] = useState(false);
  const [doctorResult, setDoctorResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [updateRunning, setUpdateRunning] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ ok: boolean; text: string } | null>(null);
  // 配置文件管理状态
  const [newProfileName, setNewProfileName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const profileNameRef = useRef<HTMLInputElement>(null);

  const profiles = settings.apiProfiles ?? [];
  const isAuthenticated =
    authStatus?.loggedIn || (settings.authMode === 'api-key' && settings.apiKey);

  /** 切换到选中的配置文件 */
  const handleApplyProfile = (profileId: string) => {
    const p = profiles.find((x) => x.id === profileId);
    if (!p) return;
    setSettings((prev) => ({
      ...prev,
      authMode: p.authMode,
      apiKey: p.apiKey ?? '',
      apiBaseUrl: p.apiBaseUrl ?? '',
      httpProxy: p.httpProxy ?? '',
      provider: p.provider ?? 'anthropic',
    }));
  };

  /** 另存为新配置文件 */
  const handleSaveProfile = () => {
    const name = newProfileName.trim();
    if (!name) return;
    const newProfile: ApiProfile = {
      id: `profile-${Date.now()}`,
      name,
      ...extractProfileFields(settings),
    };
    setSettings((prev) => ({
      ...prev,
      apiProfiles: [...(prev.apiProfiles ?? []), newProfile],
    }));
    setNewProfileName('');
    setSavingProfile(false);
  };

  /** 删除配置文件 */
  const handleDeleteProfile = (profileId: string) => {
    setSettings((prev) => ({
      ...prev,
      apiProfiles: (prev.apiProfiles ?? []).filter((p) => p.id !== profileId),
    }));
  };

  return (
    <>
      {/* ── API 配置文件快速切换 ── */}
      {(profiles.length > 0 || savingProfile) && (
        <div style={{
          marginBottom: 14, padding: '10px 12px',
          background: 'var(--bg-tertiary)', borderRadius: 6,
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            API 配置文件
          </div>
          {profiles.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <button
                onClick={() => handleApplyProfile(p.id)}
                title={`切换到：${p.name}`}
                style={{
                  flex: 1, textAlign: 'left', padding: '4px 8px',
                  fontSize: 12, borderRadius: 4, cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                <span style={{ marginRight: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                  {p.authMode === 'api-key' ? '🔑' : '🔐'}
                </span>
                {p.name}
                {p.apiBaseUrl && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>
                    {p.apiBaseUrl.replace(/^https?:\/\//, '').split('/')[0]}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleDeleteProfile(p.id)}
                title="删除此配置"
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '4px 6px', borderRadius: 4, cursor: 'pointer',
                  border: 'none', background: 'none',
                  color: 'var(--text-muted)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-danger, #ef4444)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {savingProfile && (
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <input
                ref={profileNameRef}
                type="text"
                className="input"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveProfile(); if (e.key === 'Escape') setSavingProfile(false); }}
                placeholder="配置文件名称…"
                style={{ fontSize: 12, flex: 1, padding: '4px 8px' }}
                autoFocus
              />
              <button className="btn" onClick={handleSaveProfile} style={{ fontSize: 11, padding: '4px 10px' }}>确认</button>
              <button className="btn" onClick={() => { setSavingProfile(false); setNewProfileName(''); }} style={{ fontSize: 11, padding: '4px 10px' }}>取消</button>
            </div>
          )}
        </div>
      )}
      {/* 另存为配置文件按钮（始终可见） */}
      <div style={{ marginBottom: 14 }}>
        <button
          className="btn"
          onClick={() => { setSavingProfile(true); setTimeout(() => profileNameRef.current?.focus(), 50); }}
          style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <BookmarkPlus size={13} />
          保存当前 API 配置
        </button>
      </div>

      {/* Auth Status */}
      <div
        style={{
          padding: 12,
          borderRadius: 6,
          background: isAuthenticated ? 'var(--success-bg)' : 'var(--warning-bg)',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {isAuthenticated ? (
          <Check size={16} style={{ color: 'var(--success-text)' }} />
        ) : (
          <X size={16} style={{ color: 'var(--warning-text)' }} />
        )}
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: isAuthenticated ? 'var(--success-text)' : 'var(--warning-text)' }}>
            {(settings.authMode === 'api-key' && settings.apiKey)
              ? '✓ 自定义 API 已配置'
              : authStatus?.loggedIn
                ? '✓ 官方已授权'
                : '✗ 未授权'}
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
      {settings.authMode === 'official' && !authStatus?.loggedIn && (
        <button
          className="btn"
          style={{ width: '100%', marginBottom: 16, background: 'var(--accent-color)' }}
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
          marginBottom: 12, cursor: 'pointer', display: 'flex',
          alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)',
        }}
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        <span>高级设置</span>
      </div>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 6 }}>
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

          {/* API Base URL */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
              API Base URL（中转/代理）
            </label>
            <input
              type="text"
              className="input"
              value={settings.apiBaseUrl}
              onChange={(e) => {
                const newApiBaseUrl = e.target.value;
                setSettings((prev) => {
                  const next = { ...prev, apiBaseUrl: newApiBaseUrl };
                  if (newApiBaseUrl && newApiBaseUrl.trim() && prev.authMode === 'official') {
                    next.authMode = 'api-key';
                  }
                  return next;
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

          {/* LLM Gateway 高级选项 */}
          {settings.apiBaseUrl && (
            <div style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                LLM Gateway 高级选项
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                  Bearer Auth Token（ANTHROPIC_AUTH_TOKEN，优先于 API Key）
                </label>
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
                  自定义请求头（ANTHROPIC_CUSTOM_HEADERS，JSON 格式）
                </label>
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
                  动态 Key 脚本路径（apiKeyHelper，写入 ~/.claude/settings.json）
                </label>
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
                启用网关模型自动发现（CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY）
              </label>
            </div>
          )}

          {/* Cloud Provider */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
              云服务商（Provider）
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

          {/* AWS Bedrock */}
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

          {/* Google Vertex AI */}
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

          {/* Microsoft Azure Foundry */}
          {settings.provider === 'foundry' && (
            <div style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                Microsoft Azure Foundry 配置
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Foundry API Key（可选，留空则使用 Entra ID 凭证链）</label>
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
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>资源名称（Resource Name）</label>
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
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Base URL（可选，替代资源名称）</label>
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
                未设置 API Key 时自动使用 Azure SDK 默认凭证链（az login / Managed Identity）
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
                默认会话名称（--name）
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
                费用上限 USD（--max-budget-usd）
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
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              {(['append', 'replace'] as const).map((mode) => (
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
              placeholder={
                (settings.systemPromptMode ?? 'append') === 'replace'
                  ? '自定义系统提示词，将完全替换默认提示词（--system-prompt）'
                  : '每次对话自动追加的自定义指令（--append-system-prompt）'
              }
              rows={3}
              style={{ fontSize: 11, fontFamily: 'monospace', resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      )}
    </>
  );
}
