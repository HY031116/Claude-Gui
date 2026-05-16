import { useState, useEffect, useCallback } from 'react';
import { Server, Plus, Pencil, Trash2, CheckCircle, AlertTriangle, X, ChevronDown, ChevronRight, ShoppingBag, Download, Upload } from 'lucide-react';

/** 键值对编辑行 */
interface KvPair { key: string; value: string }

function kvFromObj(obj?: Record<string, string>): KvPair[] {
  if (!obj) return [];
  return Object.entries(obj).map(([key, value]) => ({ key, value }));
}

function kvToObj(pairs: KvPair[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { key, value } of pairs) {
    if (key.trim()) result[key.trim()] = value;
  }
  return result;
}

/** MCP 服务器配置（与 cli-config-service 中的 McpServerConfig 一致） */
interface McpServerConfig {
  type?: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

/** 编辑弹窗表单状态 */
interface FormState {
  name: string;
  type: 'stdio' | 'sse';
  command: string;
  args: string;    // 每行一个 arg
  env: KvPair[];
  url: string;
  headers: KvPair[];
}

function defaultForm(): FormState {
  return { name: '', type: 'stdio', command: '', args: '', env: [], url: '', headers: [] };
}

// ── 预设 MCP 服务器市场 ────────────────────────────────────────────────────────
interface PresetServer {
  id: string;
  name: string;
  description: string;
  category: string;
  config: McpServerConfig;
}

const PRESET_MCP_SERVERS: PresetServer[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: '读写本地文件系统',
    category: '文件',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/'] },
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'GitHub Issues、PR、代码搜索',
    category: '开发',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' } },
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'PostgreSQL 数据库查询',
    category: '数据库',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'] },
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    description: 'SQLite 数据库操作',
    category: '数据库',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sqlite', '/path/to/db.sqlite'] },
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Brave 搜索引擎网络搜索',
    category: '搜索',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search'], env: { BRAVE_API_KEY: '' } },
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    description: '无头浏览器自动化',
    category: '浏览器',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-puppeteer'] },
  },
  {
    id: 'memory',
    name: 'Memory',
    description: '键值对持久化记忆存储',
    category: '记忆',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    description: '结构化多步推理工具',
    category: '推理',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] },
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Slack 频道消息读写',
    category: '通讯',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-slack'], env: { SLACK_BOT_TOKEN: '', SLACK_TEAM_ID: '' } },
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Google Drive 文件访问',
    category: '云存储',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-gdrive'] },
  },
];


function serverToForm(name: string, cfg: McpServerConfig): FormState {
  return {
    name,
    type: cfg.type ?? 'stdio',
    command: cfg.command ?? '',
    args: (cfg.args ?? []).join('\n'),
    env: kvFromObj(cfg.env),
    url: cfg.url ?? '',
    headers: kvFromObj(cfg.headers),
  };
}

function formToServer(form: FormState): McpServerConfig {
  const base: McpServerConfig = { type: form.type };
  if (form.type === 'stdio') {
    base.command = form.command.trim();
    const args = form.args.split('\n').map((s) => s.trim()).filter(Boolean);
    if (args.length) base.args = args;
    const env = kvToObj(form.env);
    if (Object.keys(env).length) base.env = env;
  } else {
    base.url = form.url.trim();
    const headers = kvToObj(form.headers);
    if (Object.keys(headers).length) base.headers = headers;
    const env = kvToObj(form.env);
    if (Object.keys(env).length) base.env = env;
  }
  return base;
}

/** 键值对编辑组件 */
function KvEditor({ pairs, onChange, label }: { pairs: KvPair[]; onChange: (p: KvPair[]) => void; label: string }) {
  const update = (idx: number, field: 'key' | 'value', val: string) => {
    const next = pairs.map((p, i) => (i === idx ? { ...p, [field]: val } : p));
    onChange(next);
  };
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
      {pairs.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
          <input
            className="input"
            placeholder="键"
            value={p.key}
            onChange={(e) => update(i, 'key', e.target.value)}
            style={{ flex: 1, fontSize: 12 }}
          />
          <input
            className="input"
            placeholder="值"
            value={p.value}
            onChange={(e) => update(i, 'value', e.target.value)}
            style={{ flex: 2, fontSize: 12 }}
          />
          <button
            className="btn"
            onClick={() => onChange(pairs.filter((_, j) => j !== i))}
            style={{ padding: '3px 8px', flexShrink: 0 }}
            title="删除"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <button
        className="btn"
        onClick={() => onChange([...pairs, { key: '', value: '' }])}
        style={{ fontSize: 11, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <Plus size={11} /> 添加
      </button>
    </div>
  );
}

/**
 * McpPanel — MCP 服务器配置面板
 *
 * 读写 ~/.claude/settings.json 的 mcpServers 字段，
 * 支持 stdio 和 SSE 两种类型的服务器管理（添加/编辑/删除）。
 */
export function McpPanel() {
  const [servers, setServers] = useState<Record<string, McpServerConfig>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [editModal, setEditModal] = useState<{ open: boolean; isNew: boolean; originalName: string } | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [formError, setFormError] = useState('');
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  // 市场弹窗
  const [showMarket, setShowMarket] = useState(false);
  const [marketCategory, setMarketCategory] = useState<string>('全部');
  // JSON 导入/导出
  const [showJsonModal, setShowJsonModal] = useState<'import' | 'export' | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');

  const loadServers = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI?.loadCliConfig();
      if (result?.success && result.settings?.mcpServers) {
        setServers(result.settings.mcpServers as Record<string, McpServerConfig>);
      } else {
        setServers({});
      }
    } catch {
      setServers({});
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  /** 将更新后的 servers 合并回完整 config 并保存 */
  const saveServers = async (updated: Record<string, McpServerConfig>) => {
    setSaveStatus('saving');
    setSaveError('');
    const config = await window.electronAPI?.loadCliConfig();
    const current = config?.success ? (config.settings ?? {}) : {};
    const merged = { ...current, mcpServers: updated };
    const result = await window.electronAPI?.saveCliConfig(merged);
    if (result?.success) {
      setServers(updated);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('error');
      setSaveError(result?.error ?? '保存失败');
    }
  };

  const openAdd = () => {
    setForm(defaultForm());
    setFormError('');
    setEditModal({ open: true, isNew: true, originalName: '' });
  };

  /** 从预设市场快速填充表单 */
  const applyPreset = (preset: PresetServer) => {
    const form = serverToForm(preset.id, preset.config);
    form.name = preset.id;
    setForm(form);
    setFormError('');
    setShowMarket(false);
    setEditModal({ open: true, isNew: true, originalName: '' });
  };

  /** 打开 JSON 导出（当前 servers 序列化为格式化 JSON） */
  const openExport = () => {
    setJsonText(JSON.stringify(servers, null, 2));
    setJsonError('');
    setShowJsonModal('export');
  };

  /** 打开 JSON 导入 */
  const openImport = () => {
    setJsonText('');
    setJsonError('');
    setShowJsonModal('import');
  };

  /** 执行 JSON 导入（merge 模式：合并到现有 servers） */
  const handleJsonImport = async () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('顶层必须是 JSON 对象');
      const merged = { ...servers, ...parsed };
      setShowJsonModal(null);
      await saveServers(merged);
    } catch (e) {
      setJsonError(`JSON 解析失败：${String(e)}`);
    }
  };


  const openEdit = (name: string, cfg: McpServerConfig) => {
    setForm(serverToForm(name, cfg));
    setFormError('');
    setEditModal({ open: true, isNew: false, originalName: name });
  };

  const handleFormSave = async () => {
    const name = form.name.trim();
    if (!name) { setFormError('服务器名称不能为空'); return; }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) { setFormError('名称只允许字母、数字、-、_'); return; }
    if (editModal?.isNew && servers[name]) { setFormError(`"${name}" 已存在`); return; }
    if (form.type === 'stdio' && !form.command.trim()) { setFormError('stdio 类型必须填写命令'); return; }
    if (form.type === 'sse' && !form.url.trim()) { setFormError('SSE 类型必须填写 URL'); return; }

    const updated = { ...servers };
    // 重命名时删除旧 key
    if (!editModal?.isNew && editModal?.originalName && editModal.originalName !== name) {
      delete updated[editModal.originalName];
    }
    updated[name] = formToServer(form);
    setEditModal(null);
    await saveServers(updated);
  };

  const handleDelete = async (name: string) => {
    setDeleteConfirm(null);
    const updated = { ...servers };
    delete updated[name];
    await saveServers(updated);
  };

  const serverEntries = Object.entries(servers);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 顶部栏 */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Server size={15} color="var(--accent-color)" />
        <span style={{ fontSize: 13, fontWeight: 600 }}>MCP 服务器</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>（Model Context Protocol）</span>
        <div style={{ flex: 1 }} />
        {saveStatus === 'saved' && (
          <span style={{ fontSize: 11, color: 'var(--success-color, #4caf50)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle size={12} /> 已保存
          </span>
        )}
        {saveStatus === 'error' && (
          <span style={{ fontSize: 11, color: 'var(--error-color, #f44336)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={12} /> {saveError}
          </span>
        )}
        <button
          className="btn btn-primary"
          onClick={openAdd}
          style={{ fontSize: 12, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Plus size={13} /> 添加服务器
        </button>
        <button
          className="btn"
          onClick={() => setShowMarket(true)}
          style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
          title="浏览预设服务器市场"
        >
          <ShoppingBag size={13} /> 市场
        </button>
        <button
          className="btn"
          onClick={openImport}
          style={{ fontSize: 12, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
          title="从 JSON 批量导入"
        >
          <Upload size={13} />
        </button>
        <button
          className="btn"
          onClick={openExport}
          style={{ fontSize: 12, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
          title="导出为 JSON"
          disabled={Object.keys(servers).length === 0}
        >
          <Download size={13} />
        </button>
      </div>

      {/* 说明 */}
      <div
        style={{
          padding: '6px 14px',
          fontSize: 11,
          color: 'var(--text-muted)',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}
      >
        配置存储于 ~/.claude/settings.json（与 VSCode 插件共享）。重启 Claude Code 会话后生效。
      </div>

      {/* 列表 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>加载中…</div>
        ) : serverEntries.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
              gap: 10,
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            <Server size={28} />
            <div>暂无 MCP 服务器配置</div>
            <button className="btn btn-primary" onClick={openAdd} style={{ fontSize: 12 }}>
              添加第一个服务器
            </button>
          </div>
        ) : (
          serverEntries.map(([name, cfg]) => {
            const isExpanded = expandedServer === name;
            const typeLabel = cfg.type === 'sse' ? 'SSE' : 'stdio';
            const summary = cfg.type === 'sse' ? (cfg.url ?? '') : `${cfg.command ?? ''} ${(cfg.args ?? []).join(' ')}`.trim();
            return (
              <div key={name} style={{ borderBottom: '1px solid var(--border-color)' }}>
                {/* 服务器行 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 14px',
                    background: 'var(--bg-primary)',
                  }}
                >
                  <button
                    onClick={() => setExpandedServer(isExpanded ? null : name)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <Server size={14} color="var(--accent-color)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{name}</span>
                  <span
                    style={{
                      fontSize: 10,
                      background: cfg.type === 'sse' ? 'rgba(99,179,237,0.15)' : 'rgba(72,187,120,0.15)',
                      color: cfg.type === 'sse' ? '#63b3ed' : '#48bb78',
                      border: `1px solid ${cfg.type === 'sse' ? 'rgba(99,179,237,0.4)' : 'rgba(72,187,120,0.4)'}`,
                      borderRadius: 4,
                      padding: '1px 6px',
                      flexShrink: 0,
                    }}
                  >
                    {typeLabel}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      fontFamily: 'var(--font-mono, monospace)',
                    }}
                    title={summary}
                  >
                    {summary}
                  </span>
                  <button
                    className="btn"
                    onClick={() => openEdit(name, cfg)}
                    style={{ fontSize: 11, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}
                    title="编辑"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => setDeleteConfirm(name)}
                    style={{ fontSize: 11, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}
                    title="删除"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>

                {/* 展开详情 */}
                {isExpanded && (
                  <div
                    style={{
                      padding: '8px 14px 10px 36px',
                      background: 'var(--bg-secondary)',
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono, monospace)',
                      lineHeight: 1.7,
                    }}
                  >
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {JSON.stringify(cfg, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 编辑/添加弹窗 */}
      {editModal?.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setEditModal(null)}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: '20px 24px',
              maxWidth: 520,
              width: '92%',
              maxHeight: '88vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗标题 */}
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
              {editModal.isNew ? '添加 MCP 服务器' : `编辑 "${editModal.originalName}"`}
            </div>

            {/* 名称 */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                服务器名称 <span style={{ color: 'var(--error-color, #f44336)' }}>*</span>
              </label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如：my-db-server"
                style={{ fontSize: 12 }}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>只允许字母、数字、-、_</div>
            </div>

            {/* 类型 */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>类型</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['stdio', 'sse'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm({ ...form, type: t })}
                    style={{
                      padding: '4px 14px',
                      fontSize: 12,
                      border: '1px solid var(--border-color)',
                      borderRadius: 6,
                      background: form.type === t ? 'var(--accent-color)' : 'var(--bg-secondary)',
                      color: form.type === t ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* stdio 字段 */}
            {form.type === 'stdio' && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    命令 <span style={{ color: 'var(--error-color, #f44336)' }}>*</span>
                  </label>
                  <input
                    className="input"
                    value={form.command}
                    onChange={(e) => setForm({ ...form, command: e.target.value })}
                    placeholder="例如：node 或 python"
                    style={{ fontSize: 12 }}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    参数（每行一个）
                  </label>
                  <textarea
                    className="input"
                    value={form.args}
                    onChange={(e) => setForm({ ...form, args: e.target.value })}
                    placeholder={`/path/to/server.js\n--port\n3000`}
                    rows={3}
                    style={{ fontSize: 12, resize: 'vertical', fontFamily: 'var(--font-mono, monospace)' }}
                  />
                </div>
              </>
            )}

            {/* SSE 字段 */}
            {form.type === 'sse' && (
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  URL <span style={{ color: 'var(--error-color, #f44336)' }}>*</span>
                </label>
                <input
                  className="input"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://example.com/sse"
                  style={{ fontSize: 12 }}
                />
              </div>
            )}

            {/* 环境变量 */}
            <KvEditor
              pairs={form.env}
              onChange={(env) => setForm({ ...form, env })}
              label="环境变量（可选）"
            />

            {/* SSE 请求头 */}
            {form.type === 'sse' && (
              <KvEditor
                pairs={form.headers}
                onChange={(headers) => setForm({ ...form, headers })}
                label="请求头（可选）"
              />
            )}

            {/* 错误信息 */}
            {formError && (
              <div style={{ fontSize: 12, color: 'var(--error-color, #f44336)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12} /> {formError}
              </div>
            )}

            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn" onClick={() => setEditModal(null)} style={{ fontSize: 12 }}>取消</button>
              <button className="btn btn-primary" onClick={handleFormSave} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={13} />
                {editModal.isNew ? '添加' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: 24,
              maxWidth: 380,
              width: '90%',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={16} color="#d4a017" />
              <span style={{ fontWeight: 600, fontSize: 13 }}>删除 MCP 服务器</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              确定要删除 <strong>"{deleteConfirm}"</strong> 吗？此操作不可撤销。
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setDeleteConfirm(null)} style={{ fontSize: 12 }}>取消</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Trash2 size={12} /> 删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 市场弹窗 */}
      {showMarket && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setShowMarket(false)}
        >
          <div
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '20px 24px', maxWidth: 640, width: '94%', maxHeight: '86vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <ShoppingBag size={15} color="var(--accent-color)" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>MCP 服务器市场</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowMarket(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>

            {/* 分类筛选 */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {['全部', ...Array.from(new Set(PRESET_MCP_SERVERS.map((p) => p.category)))].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setMarketCategory(cat)}
                  style={{
                    padding: '3px 10px', fontSize: 11, borderRadius: 12,
                    border: '1px solid var(--border-color)',
                    background: marketCategory === cat ? 'var(--accent-color)' : 'var(--bg-secondary)',
                    color: marketCategory === cat ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 预设列表 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {PRESET_MCP_SERVERS
                .filter((p) => marketCategory === '全部' || p.category === marketCategory)
                .map((preset) => {
                  const alreadyAdded = Object.prototype.hasOwnProperty.call(servers, preset.id);
                  return (
                    <div
                      key={preset.id}
                      style={{
                        padding: '10px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 12, flex: 1 }}>{preset.name}</span>
                        <span style={{ fontSize: 10, background: 'var(--bg-hover)', borderRadius: 4, padding: '1px 5px', color: 'var(--text-muted)' }}>
                          {preset.category}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{preset.description}</div>
                      <button
                        className="btn btn-primary"
                        onClick={() => applyPreset(preset)}
                        disabled={alreadyAdded}
                        style={{ fontSize: 11, padding: '3px 10px', marginTop: 4, alignSelf: 'flex-start' }}
                      >
                        {alreadyAdded ? '已添加' : '配置并添加'}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* JSON 导入/导出弹窗 */}
      {showJsonModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setShowJsonModal(null)}
        >
          <div
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '20px 24px', maxWidth: 560, width: '92%', maxHeight: '80vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
              {showJsonModal === 'import' ? 'JSON 批量导入' : '导出为 JSON'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {showJsonModal === 'import'
                ? '粘贴 mcpServers 格式的 JSON（将与现有配置合并）：'
                : '复制以下 JSON 以备份或分享 MCP 配置：'}
            </div>
            <textarea
              style={{
                width: '100%', height: 240, fontFamily: 'var(--font-mono, monospace)', fontSize: 11,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: 6, padding: 10, color: 'var(--text-primary)', resize: 'vertical', boxSizing: 'border-box',
              }}
              value={jsonText}
              onChange={(e) => { if (showJsonModal === 'import') { setJsonText(e.target.value); setJsonError(''); } }}
              readOnly={showJsonModal === 'export'}
              spellCheck={false}
            />
            {jsonError && (
              <div style={{ fontSize: 11, color: 'var(--error-color, #f44336)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={11} /> {jsonError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn" onClick={() => setShowJsonModal(null)} style={{ fontSize: 12 }}>关闭</button>
              {showJsonModal === 'import' && (
                <button className="btn btn-primary" onClick={handleJsonImport} style={{ fontSize: 12 }}>
                  导入（合并）
                </button>
              )}
              {showJsonModal === 'export' && (
                <button
                  className="btn"
                  onClick={() => navigator.clipboard.writeText(jsonText)}
                  style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Download size={12} /> 复制
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
