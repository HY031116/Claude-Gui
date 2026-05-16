import { useState, useEffect, useCallback } from 'react';
import type { InstalledPlugin } from '../types/electron';

// ── 预设插件清单（快速安装入口） ───────────────────────────────────────────────
const PRESET_PLUGINS: Array<{ spec: string; name: string; description: string }> = [
  { spec: 'thedotmack/claude-mem',        name: 'Claude-Mem',        description: '跨会话持久化记忆' },
  { spec: 'anthropic/typescript-lsp',     name: 'TypeScript LSP',    description: 'TypeScript 语言服务器支持' },
  { spec: 'anthropic/github',             name: 'GitHub',            description: 'GitHub Issues/PR 集成' },
  { spec: 'anthropic/commit-commands',    name: 'Commit Commands',   description: '智能 Git 提交助手' },
  { spec: 'anthropic/sequential-thinking', name: 'Sequential Thinking', description: '结构化多步推理' },
];

type TabId = 'installed' | 'discover' | 'presets';

export default function PluginPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('installed');
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [uninstallingKey, setUninstallingKey] = useState<string | null>(null);
  // 安装相关
  const [installSpec, setInstallSpec] = useState('');
  const [installLog, setInstallLog] = useState('');
  const [installing, setInstalling] = useState(false);
  // 预设安装
  const [presetLog, setPresetLog] = useState('');
  const [presetInstalling, setPresetInstalling] = useState<string | null>(null);

  // ── 读取已安装插件列表 ──────────────────────────────────────────────────────
  const loadPlugins = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.pluginList();
      if (result.success && result.plugins) {
        setPlugins(result.plugins);
      }
    } catch {
      // 无后端时静默忽略
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  // ── 启用/禁用插件 ──────────────────────────────────────────────────────────
  const handleToggle = async (plugin: InstalledPlugin) => {
    setTogglingKey(plugin.key);
    try {
      const result = await window.electronAPI.pluginToggle(plugin.key, !plugin.enabled);
      if (result.success) {
        setPlugins((prev) =>
          prev.map((p) => (p.key === plugin.key ? { ...p, enabled: !plugin.enabled } : p))
        );
      }
    } finally {
      setTogglingKey(null);
    }
  };

  // ── 卸载插件 ───────────────────────────────────────────────────────────────
  const handleUninstall = async (plugin: InstalledPlugin) => {
    if (!window.confirm(`确定要卸载插件 ${plugin.name}（${plugin.key}）吗？`)) return;
    setUninstallingKey(plugin.key);
    try {
      const result = await window.electronAPI.pluginUninstall(plugin.key);
      if (result.success) {
        setPlugins((prev) => prev.filter((p) => p.key !== plugin.key));
      } else {
        alert(`卸载失败：${result.output}`);
      }
    } finally {
      setUninstallingKey(null);
    }
  };

  // ── 手动安装插件 ───────────────────────────────────────────────────────────
  const handleInstall = async () => {
    const spec = installSpec.trim();
    if (!spec) return;
    setInstalling(true);
    setInstallLog('正在安装，请稍候...\n');
    try {
      const result = await window.electronAPI.pluginInstall(spec);
      setInstallLog(result.output || (result.success ? '安装成功' : '安装失败'));
      if (result.success) {
        await loadPlugins();
        setInstallSpec('');
      }
    } finally {
      setInstalling(false);
    }
  };

  // ── 预设快速安装 ───────────────────────────────────────────────────────────
  const handlePresetInstall = async (spec: string) => {
    setPresetInstalling(spec);
    setPresetLog('正在安装，请稍候...\n');
    try {
      const result = await window.electronAPI.pluginInstall(spec);
      setPresetLog(result.output || (result.success ? '安装成功' : '安装失败'));
      if (result.success) await loadPlugins();
    } finally {
      setPresetInstalling(null);
    }
  };

  // ── 渲染 ────────────────────────────────────────────────────────────────────
  return (
    <div className="plugin-panel">
      {/* 标签页切换 */}
      <div className="plugin-tabs">
        {([
          ['installed', '已安装'],
          ['discover',  '发现与安装'],
          ['presets',   '常用插件'],
        ] as [TabId, string][]).map(([id, label]) => (
          <button
            key={id}
            className={`plugin-tab-btn${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
        <button className="plugin-refresh-btn" onClick={loadPlugins} disabled={loading} title="刷新列表">
          ↻
        </button>
      </div>

      {/* ── Tab 1: 已安装 ── */}
      {activeTab === 'installed' && (
        <div className="plugin-list-section">
          {loading && <div className="plugin-loading">读取中...</div>}
          {!loading && plugins.length === 0 && (
            <div className="plugin-empty">
              <p>尚未安装任何插件</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                插件缓存目录：~/.claude/plugins/cache/
              </p>
            </div>
          )}
          {plugins.map((p) => (
            <div key={p.key} className={`plugin-item${p.enabled ? '' : ' disabled'}`}>
              <div className="plugin-info">
                <div className="plugin-name">{p.name}</div>
                <div className="plugin-meta">
                  {p.marketplace} · v{p.version}
                  {p.author && ` · ${p.author}`}
                </div>
                {p.description && (
                  <div className="plugin-desc">{p.description}</div>
                )}
              </div>
              <div className="plugin-actions">
                {/* 启用/禁用切换 */}
                <button
                  className={`plugin-toggle${p.enabled ? ' on' : ' off'}`}
                  onClick={() => handleToggle(p)}
                  disabled={togglingKey === p.key}
                  title={p.enabled ? '点击禁用' : '点击启用'}
                >
                  {togglingKey === p.key ? '…' : p.enabled ? '启用' : '禁用'}
                </button>
                {/* 卸载 */}
                <button
                  className="plugin-uninstall-btn"
                  onClick={() => handleUninstall(p)}
                  disabled={uninstallingKey === p.key}
                  title="卸载此插件"
                >
                  {uninstallingKey === p.key ? '卸载中…' : '卸载'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab 2: 发现与安装 ── */}
      {activeTab === 'discover' && (
        <div className="plugin-install-section">
          <p className="plugin-install-hint">
            输入插件规格（格式：<code>name@marketplace</code> 或 <code>marketplace/name</code>）
          </p>
          <div className="plugin-install-row">
            <input
              type="text"
              className="plugin-spec-input"
              placeholder="例如：claude-mem@thedotmack"
              value={installSpec}
              onChange={(e) => setInstallSpec(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !installing) handleInstall(); }}
              disabled={installing}
            />
            <button
              className="plugin-install-btn"
              onClick={handleInstall}
              disabled={installing || !installSpec.trim()}
            >
              {installing ? '安装中…' : '安装'}
            </button>
          </div>
          {installLog && (
            <pre className="plugin-log">{installLog}</pre>
          )}
        </div>
      )}

      {/* ── Tab 3: 常用插件 ── */}
      {activeTab === 'presets' && (
        <div className="plugin-presets-section">
          <p className="plugin-install-hint">点击安装按钮快速安装常用插件</p>
          {PRESET_PLUGINS.map((preset) => {
            const installed = plugins.some((p) => p.key.startsWith(preset.spec.split('/')[1] ?? ''));
            return (
              <div key={preset.spec} className="plugin-preset-item">
                <div className="plugin-info">
                  <div className="plugin-name">{preset.name}</div>
                  <div className="plugin-desc">{preset.description}</div>
                  <div className="plugin-meta">{preset.spec}</div>
                </div>
                <button
                  className="plugin-install-btn"
                  onClick={() => handlePresetInstall(preset.spec)}
                  disabled={presetInstalling === preset.spec || installed}
                >
                  {presetInstalling === preset.spec ? '安装中…' : installed ? '已安装' : '安装'}
                </button>
              </div>
            );
          })}
          {presetLog && (
            <pre className="plugin-log">{presetLog}</pre>
          )}
        </div>
      )}
    </div>
  );
}
