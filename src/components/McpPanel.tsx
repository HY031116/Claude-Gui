import { useState, useEffect, useCallback } from 'react';
import { Server, Plus, Pencil, Trash2, CheckCircle, AlertTriangle, X, ChevronDown, ChevronRight } from 'lucide-react';

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

  const loadServers = useCallback(async () => {
    setIsLoading(true);
    const result = await window.electronAPI?.loadCliConfig();
    if (result?.success && result.settings?.mcpServers) {
      setServers(result.settings.mcpServers as Record<string, McpServerConfig>);
    } else {
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
    </div>
  );
}
