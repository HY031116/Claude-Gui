import React, { useEffect, useState } from 'react';
import { Bot, Plus, Trash2, Save, ChevronDown, ChevronUp, X, ChevronRight } from 'lucide-react';

interface AgentRecord {
  filename: string;
  name: string;
  model: string;
  description: string;
  prompt: string;
  permission_mode: string;
  max_turns: number | null;
  effort: string;
  allowed_tools: string[];
  disallowed_tools: string[];
  skills: string[];
  memory_type: string;
  isolation: string;
  background: boolean;
  initial_prompt: string;
  color: string;
}

const EMPTY_AGENT: Omit<AgentRecord, 'filename'> = {
  name: '',
  model: '',
  description: '',
  prompt: '',
  permission_mode: '',
  max_turns: null,
  effort: '',
  allowed_tools: [],
  disallowed_tools: [],
  skills: [],
  memory_type: '',
  isolation: '',
  background: false,
  initial_prompt: '',
  color: '',
};

const AVAILABLE_MODELS = [
  '', 'claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5',
  'claude-opus-4', 'claude-sonnet-4', 'claude-haiku-3-5',
];

/** 将 name 转换为合法文件名（小写、连字符） */
function nameToFilename(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '') + '.md';
}

export function AgentPanel() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFilename, setExpandedFilename] = useState<string | null>(null);
  const [editMap, setEditMap] = useState<Record<string, Omit<AgentRecord, 'filename'>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 新建 Agent 状态
  const [showCreate, setShowCreate] = useState(false);
  const [newAgent, setNewAgent] = useState<Omit<AgentRecord, 'filename'>>(EMPTY_AGENT);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await window.electronAPI.agentList();
    if (res.success && res.agents) {
      setAgents(res.agents);
    } else {
      setError(res.error ?? '加载失败');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleExpand = (filename: string, agent: AgentRecord) => {
    if (expandedFilename === filename) {
      setExpandedFilename(null);
    } else {
      setExpandedFilename(filename);
      // 初始化编辑副本
      setEditMap((prev) => ({
        ...prev,
        [filename]: {
          name: agent.name, model: agent.model, description: agent.description, prompt: agent.prompt,
          permission_mode: agent.permission_mode ?? '', max_turns: agent.max_turns ?? null,
          effort: agent.effort ?? '', allowed_tools: agent.allowed_tools ?? [],
          disallowed_tools: agent.disallowed_tools ?? [], skills: agent.skills ?? [],
          memory_type: agent.memory_type ?? '', isolation: agent.isolation ?? '',
          background: agent.background ?? false, initial_prompt: agent.initial_prompt ?? '',
          color: agent.color ?? '',
        },
      }));
    }
  };

  const handleSave = async (filename: string) => {
    const data = editMap[filename];
    if (!data) return;
    setSaving(filename);
    const res = await window.electronAPI.agentWrite(filename, data);
    if (res.success) {
      await load();
      setExpandedFilename(null);
    } else {
      setError(res.error ?? '保存失败');
    }
    setSaving(null);
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`确认删除 Agent "${filename}"？`)) return;
    setDeleting(filename);
    const res = await window.electronAPI.agentDelete(filename);
    if (res.success) {
      setAgents((prev) => prev.filter((a) => a.filename !== filename));
      if (expandedFilename === filename) setExpandedFilename(null);
    } else {
      setError(res.error ?? '删除失败');
    }
    setDeleting(null);
  };

  const handleCreate = async () => {
    if (!newAgent.name.trim()) { setError('请填写 Agent 名称'); return; }
    setCreating(true);
    setError(null);
    const filename = nameToFilename(newAgent.name);
    const res = await window.electronAPI.agentWrite(filename, newAgent);
    if (res.success) {
      setShowCreate(false);
      setNewAgent(EMPTY_AGENT);
      await load();
    } else {
      setError(res.error ?? '创建失败');
    }
    setCreating(false);
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px 12px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* 顶部标题栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          <Bot size={16} />
          自定义 Agents
        </div>
        <button
          className="btn"
          style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px' }}
          onClick={() => { setShowCreate(true); setNewAgent(EMPTY_AGENT); setError(null); }}
        >
          <Plus size={13} />
          新建
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div style={{ background: 'var(--error-bg, #fee)', color: 'var(--error-text, #c00)', padding: '6px 10px', borderRadius: 4, fontSize: 12, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {error}
          <X size={13} style={{ cursor: 'pointer' }} onClick={() => setError(null)} />
        </div>
      )}

      {/* 新建表单 */}
      {showCreate && (
        <div style={{ border: '1px solid var(--accent-color)', borderRadius: 6, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--accent-color)' }}>新建 Agent</div>
          <AgentForm data={newAgent} onChange={setNewAgent} models={AVAILABLE_MODELS} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn" disabled={creating} style={{ fontSize: 12, flex: 1, background: 'var(--accent-color)' }} onClick={handleCreate}>
              {creating ? '创建中...' : '✓ 创建'}
            </button>
            <button className="btn" style={{ fontSize: 12 }} onClick={() => { setShowCreate(false); setError(null); }}>取消</button>
          </div>
        </div>
      )}

      {/* Agent 列表 */}
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>加载中...</div>
      ) : agents.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
          暂无自定义 Agent。<br />点击"新建"创建第一个。
        </div>
      ) : (
        agents.map((agent) => {
          const isExpanded = expandedFilename === agent.filename;
          const edit = editMap[agent.filename] ?? agent;
          return (
            <div key={agent.filename} style={{ border: '1px solid var(--border-color)', borderRadius: 6, marginBottom: 8, overflow: 'hidden' }}>
              {/* 折叠头 */}
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', cursor: 'pointer', background: isExpanded ? 'var(--bg-secondary)' : 'transparent' }}
                onClick={() => toggleExpand(agent.filename, agent)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Bot size={13} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.name || agent.filename}</span>
                  </div>
                  {agent.description && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.description}</div>
                  )}
                  {agent.model && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>模型: {agent.model}</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button
                    className="btn"
                    disabled={deleting === agent.filename}
                    style={{ fontSize: 11, color: '#ef4444', background: 'none', border: '1px solid #ef4444', padding: '2px 7px' }}
                    onClick={(e) => { e.stopPropagation(); handleDelete(agent.filename); }}
                  >
                    <Trash2 size={11} />
                  </button>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>

              {/* 展开编辑区 */}
              {isExpanded && (
                <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-color)' }}>
                  <AgentForm
                    data={edit}
                    onChange={(d) => setEditMap((prev) => ({ ...prev, [agent.filename]: d }))}
                    models={AVAILABLE_MODELS}
                  />
                  <button
                    className="btn"
                    disabled={saving === agent.filename}
                    style={{ fontSize: 12, marginTop: 10, width: '100%', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                    onClick={() => handleSave(agent.filename)}
                  >
                    <Save size={13} />
                    {saving === agent.filename ? '保存中...' : '保存修改'}
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* 说明 */}
      <div style={{ marginTop: 'auto', paddingTop: 12, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Agent 文件存储于 <code style={{ fontSize: 10 }}>~/.claude/agents/</code><br />
        在对话中使用 <code style={{ fontSize: 10 }}>--agent &lt;name&gt;</code> 指定调用。
      </div>
    </div>
  );
}

// ---- 编辑表单子组件 ----
interface AgentFormProps {
  data: Omit<AgentRecord, 'filename'>;
  onChange: (d: Omit<AgentRecord, 'filename'>) => void;
  models: string[];
}

const AVAILABLE_TOOLS = ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch', 'Agent'];
const PALETTE_COLORS = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

const SECTION_HEADER_STYLE: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
  color: 'var(--text-secondary)', cursor: 'pointer', padding: '5px 0', userSelect: 'none',
  borderTop: '1px solid var(--border-color)', marginTop: 4,
};

const LABEL_STYLE: React.CSSProperties = { fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3, display: 'block' };

function RadioGroup({ label, value, options, onChange }: { label: string; value: string; options: { v: string; l: string }[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={LABEL_STYLE}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
        {options.map(({ v, l }) => (
          <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, cursor: 'pointer', color: 'var(--text-primary)' }}>
            <input type="radio" name={label} checked={value === v} onChange={() => onChange(v)} style={{ accentColor: 'var(--accent-color)', margin: 0 }} />
            {l}
          </label>
        ))}
      </div>
    </div>
  );
}

function AgentForm({ data, onChange, models }: AgentFormProps) {
  const [openSections, setOpenSections] = useState({ exec: false, tools: false, advanced: false });
  const toggleSection = (k: keyof typeof openSections) => setOpenSections((p) => ({ ...p, [k]: !p[k] }));

  const toggleTool = (tool: string) => {
    const cur = data.allowed_tools ?? [];
    onChange({ ...data, allowed_tools: cur.includes(tool) ? cur.filter((t) => t !== tool) : [...cur, tool] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* ── 基础信息 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end' }}>
        <div>
          <label style={LABEL_STYLE}>名称 *</label>
          <input type="text" className="input" value={data.name} onChange={(e) => onChange({ ...data, name: e.target.value })} placeholder="my-agent" style={{ fontSize: 12 }} />
        </div>
        <div>
          <label style={LABEL_STYLE}>颜色</label>
          <div style={{ display: 'flex', gap: 3, paddingBottom: 6 }}>
            {PALETTE_COLORS.map((c) => (
              <div
                key={c}
                title={c || '（无颜色）'}
                style={{ width: 15, height: 15, borderRadius: '50%', background: c || 'var(--border-color)', border: data.color === c ? '2px solid var(--accent-color)' : '1px solid var(--border-color)', cursor: 'pointer', flexShrink: 0 }}
                onClick={() => onChange({ ...data, color: c })}
              />
            ))}
          </div>
        </div>
      </div>

      <div>
        <label style={LABEL_STYLE}>描述（Claude 用此决定何时委派）</label>
        <textarea className="input" value={data.description} onChange={(e) => onChange({ ...data, description: e.target.value })} placeholder="Expert code reviewer. Use immediately after code changes." rows={2} style={{ fontSize: 12, resize: 'vertical', lineHeight: 1.4 }} />
      </div>

      <div>
        <label style={LABEL_STYLE}>模型</label>
        <select className="input" value={data.model} onChange={(e) => onChange({ ...data, model: e.target.value })} style={{ fontSize: 12 }}>
          {models.map((m) => (<option key={m} value={m}>{m || '（继承默认）'}</option>))}
        </select>
      </div>

      {/* ── 执行配置（折叠） ── */}
      <div>
        <div style={SECTION_HEADER_STYLE} onClick={() => toggleSection('exec')}>
          {openSections.exec ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          执行配置（权限 / 轮次 / Effort）
        </div>
        {openSections.exec && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 6 }}>
            <RadioGroup
              label="权限模式"
              value={data.permission_mode}
              options={[
                { v: '', l: '继承' }, { v: 'default', l: 'default' },
                { v: 'acceptEdits', l: 'acceptEdits' }, { v: 'auto', l: 'auto' },
                { v: 'plan', l: 'plan' }, { v: 'dontAsk', l: 'dontAsk' },
              ]}
              onChange={(v) => onChange({ ...data, permission_mode: v })}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={LABEL_STYLE}>最大轮次（空 = 不限）</label>
                <input
                  type="number" min={1} className="input"
                  value={data.max_turns ?? ''}
                  onChange={(e) => onChange({ ...data, max_turns: e.target.value ? parseInt(e.target.value, 10) : null })}
                  placeholder="不限"
                  style={{ fontSize: 12 }}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Effort 级别</label>
                <select className="input" value={data.effort} onChange={(e) => onChange({ ...data, effort: e.target.value })} style={{ fontSize: 12 }}>
                  <option value="">继承</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 工具访问（折叠） ── */}
      <div>
        <div style={SECTION_HEADER_STYLE} onClick={() => toggleSection('tools')}>
          {openSections.tools ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          工具访问（允许 / 禁止）
        </div>
        {openSections.tools && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 6 }}>
            <div>
              <label style={LABEL_STYLE}>允许工具（默认继承，选中则仅允许这些工具）</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px 0' }}>
                {AVAILABLE_TOOLS.map((tool) => (
                  <label key={tool} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer', color: 'var(--text-primary)' }}>
                    <input type="checkbox" checked={(data.allowed_tools ?? []).includes(tool)} onChange={() => toggleTool(tool)} style={{ accentColor: 'var(--accent-color)', margin: 0 }} />
                    {tool}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label style={LABEL_STYLE}>禁止工具（逗号分隔，如 Write,Edit）</label>
              <input
                type="text" className="input"
                value={(data.disallowed_tools ?? []).join(', ')}
                onChange={(e) => onChange({ ...data, disallowed_tools: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                placeholder="Write, Edit, Bash"
                style={{ fontSize: 12 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 高级配置（折叠） ── */}
      <div>
        <div style={SECTION_HEADER_STYLE} onClick={() => toggleSection('advanced')}>
          {openSections.advanced ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          高级配置（Skills / 记忆 / 隔离 / 后台）
        </div>
        {openSections.advanced && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 6 }}>
            <div>
              <label style={LABEL_STYLE}>Skills 预加载（逗号分隔，如 api-conventions,error-patterns）</label>
              <input
                type="text" className="input"
                value={(data.skills ?? []).join(', ')}
                onChange={(e) => onChange({ ...data, skills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                placeholder="api-conventions, error-patterns"
                style={{ fontSize: 12 }}
              />
            </div>
            <RadioGroup
              label="持久记忆"
              value={data.memory_type}
              options={[{ v: '', l: 'none' }, { v: 'user', l: 'user' }, { v: 'project', l: 'project' }, { v: 'local', l: 'local' }]}
              onChange={(v) => onChange({ ...data, memory_type: v })}
            />
            <RadioGroup
              label="隔离模式"
              value={data.isolation}
              options={[{ v: '', l: 'none' }, { v: 'worktree', l: 'worktree（独立 git worktree）' }]}
              onChange={(v) => onChange({ ...data, isolation: v })}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={data.background} onChange={(e) => onChange({ ...data, background: e.target.checked })} style={{ accentColor: 'var(--accent-color)', margin: 0 }} />
              始终作为后台任务运行（background: true）
            </label>
            <div>
              <label style={LABEL_STYLE}>初始提示词（首次运行时自动提交的第一条消息）</label>
              <input type="text" className="input" value={data.initial_prompt} onChange={(e) => onChange({ ...data, initial_prompt: e.target.value })} placeholder="你好，请先阅读项目 README..." style={{ fontSize: 12 }} />
            </div>
          </div>
        )}
      </div>

      {/* ── System Prompt ── */}
      <div>
        <label style={LABEL_STYLE}>System Prompt（Markdown 正文）</label>
        <textarea className="input" value={data.prompt} onChange={(e) => onChange({ ...data, prompt: e.target.value })} placeholder="你是一个专门负责...的 AI 助手" rows={6} style={{ fontSize: 12, fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.5 }} />
      </div>
    </div>
  );
}
