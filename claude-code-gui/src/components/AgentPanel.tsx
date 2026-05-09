import { useEffect, useState } from 'react';
import { Bot, Plus, Trash2, Save, ChevronDown, ChevronUp, X } from 'lucide-react';

interface AgentRecord {
  filename: string;
  name: string;
  model: string;
  description: string;
  prompt: string;
}

const EMPTY_AGENT: Omit<AgentRecord, 'filename'> = {
  name: '',
  model: '',
  description: '',
  prompt: '',
};

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
        [filename]: { name: agent.name, model: agent.model, description: agent.description, prompt: agent.prompt },
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

  const AVAILABLE_MODELS = [
    '', 'claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5',
    'claude-opus-4', 'claude-sonnet-4', 'claude-haiku-3-5',
  ];

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

function AgentForm({ data, onChange, models }: AgentFormProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3, display: 'block' }}>名称 *</label>
          <input
            type="text"
            className="input"
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            placeholder="my-agent"
            style={{ fontSize: 12 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3, display: 'block' }}>模型（可选）</label>
          <select
            className="input"
            value={data.model}
            onChange={(e) => onChange({ ...data, model: e.target.value })}
            style={{ fontSize: 12 }}
          >
            {models.map((m) => (
              <option key={m} value={m}>{m || '（继承默认）'}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3, display: 'block' }}>描述（可选）</label>
        <input
          type="text"
          className="input"
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          placeholder="简短描述这个 Agent 的用途"
          style={{ fontSize: 12 }}
        />
      </div>
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3, display: 'block' }}>系统提示词</label>
        <textarea
          className="input"
          value={data.prompt}
          onChange={(e) => onChange({ ...data, prompt: e.target.value })}
          placeholder="你是一个专门负责...的 AI 助手"
          rows={6}
          style={{ fontSize: 12, fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.5 }}
        />
      </div>
    </div>
  );
}
