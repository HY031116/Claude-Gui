import { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Save, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Zap } from 'lucide-react';

// ─── 类型定义 ───────────────────────────────────────────────────────────────

type RuleList = 'allow' | 'deny' | 'ask';

interface ParsedRule {
  tool: string;     // 工具名，如 "Bash"、"Read"、"mcp__server__tool"
  pattern?: string; // 参数 glob，如 "git *"、"*.env"
  exclusion?: string; // 排除模式（冒号后），如 "rm *"
}

// ─── 工具选项（常用工具列表）────────────────────────────────────────────────

interface ToolOption {
  value: string;
  label: string;
  desc: string;
  placeholder: string;
}

const TOOL_OPTIONS: ToolOption[] = [
  { value: 'Bash', label: 'Bash', desc: '终端命令执行', placeholder: 'git * 或 npm run *' },
  { value: 'Read', label: 'Read', desc: '读取文件内容', placeholder: '*.env 或 /secret/*' },
  { value: 'Write', label: 'Write', desc: '写入/创建文件', placeholder: '/tmp/* 或 *.md' },
  { value: 'Edit', label: 'Edit', desc: '编辑文件（行级）', placeholder: 'src/**/*.ts' },
  { value: 'MultiEdit', label: 'MultiEdit', desc: '多处批量编辑', placeholder: '' },
  { value: 'Glob', label: 'Glob', desc: '文件路径搜索', placeholder: '' },
  { value: 'Grep', label: 'Grep', desc: '文件内容搜索', placeholder: '' },
  { value: 'LS', label: 'LS', desc: '列出目录结构', placeholder: '' },
  { value: 'WebFetch', label: 'WebFetch', desc: '抓取网页内容', placeholder: 'https://example.com/*' },
  { value: 'WebSearch', label: 'WebSearch', desc: '网络搜索', placeholder: '' },
  { value: 'TodoRead', label: 'TodoRead', desc: '读取任务列表', placeholder: '' },
  { value: 'TodoWrite', label: 'TodoWrite', desc: '写入任务列表', placeholder: '' },
  { value: 'Task', label: 'Task', desc: '运行子代理任务', placeholder: '' },
  { value: 'NotebookRead', label: 'NotebookRead', desc: 'Jupyter Notebook 读取', placeholder: '' },
  { value: 'NotebookEdit', label: 'NotebookEdit', desc: 'Jupyter Notebook 编辑', placeholder: '' },
  { value: 'Computer', label: 'Computer', desc: '计算机使用（实验性）', placeholder: '' },
  { value: 'mcp__', label: 'MCP 工具', desc: 'MCP 服务器工具（自定义输入）', placeholder: 'mcp__server__tool' },
];

// ─── 预设模板 ─────────────────────────────────────────────────────────────────

interface RulePreset {
  label: string;
  desc: string;
  list: RuleList;
  rule: string;
}

const RULE_PRESETS: RulePreset[] = [
  { label: '允许 git 操作', desc: 'Bash(git *)', list: 'allow', rule: 'Bash(git *)' },
  { label: '允许 npm/pnpm/yarn', desc: '允许包管理器命令', list: 'allow', rule: 'Bash(npm *|pnpm *|yarn *)' },
  { label: '允许读取所有文件', desc: 'Read(*)', list: 'allow', rule: 'Read(*)' },
  { label: '允许写入临时目录', desc: 'Write(/tmp/*)', list: 'allow', rule: 'Write(/tmp/*)' },
  { label: '允许 HTTPS 抓取', desc: 'WebFetch(https://*)', list: 'allow', rule: 'WebFetch(https://*)' },
  { label: '拒绝 rm -rf', desc: '阻断危险删除命令', list: 'deny', rule: 'Bash(rm -rf:rm -f *)' },
  { label: '拒绝读取 .env', desc: '保护环境变量文件', list: 'deny', rule: 'Read(*.env)' },
  { label: '拒绝写入 .env', desc: '保护环境变量文件', list: 'deny', rule: 'Write(*.env)' },
  { label: '拒绝 push/force push', desc: '防止意外推送代码', list: 'deny', rule: 'Bash(git push --force:git push *)' },
  { label: '拒绝 curl/wget', desc: '防止网络下载任意文件', list: 'deny', rule: 'Bash(curl *|wget *)' },
  { label: '询问所有 Bash', desc: '所有 shell 命令都需确认', list: 'ask', rule: 'Bash(*)' },
  { label: '询问 WebFetch', desc: '网络请求前需确认', list: 'ask', rule: 'WebFetch(*)' },
  { label: '询问写文件操作', desc: '写入前需确认', list: 'ask', rule: 'Write(*)' },
];

// ─── 工具函数：规则字符串 ↔ ParsedRule ─────────────────────────────────────

function parseRule(rule: string): ParsedRule {
  const trimmed = rule.trim();
  const match = trimmed.match(/^([^(]+)\((.+)\)$/);
  if (!match) return { tool: trimmed };
  const [, tool, inner] = match;
  const colonIdx = inner.lastIndexOf(':');
  if (colonIdx >= 0) {
    return { tool: tool.trim(), pattern: inner.slice(0, colonIdx), exclusion: inner.slice(colonIdx + 1) };
  }
  return { tool: tool.trim(), pattern: inner };
}

function buildRuleStr(parsed: ParsedRule): string {
  const tool = parsed.tool.trim();
  if (!tool) return '';
  if (!parsed.pattern) return tool;
  const inner = parsed.exclusion ? `${parsed.pattern}:${parsed.exclusion}` : parsed.pattern;
  return `${tool}(${inner})`;
}

// ─── 子组件：单条规则编辑器 ──────────────────────────────────────────────────

function RuleItem({
  rule,
  onChange,
  onDelete,
}: {
  rule: string;
  onChange: (r: string) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rawMode, setRawMode] = useState(false);
  const [parsed, setParsed] = useState<ParsedRule>(() => parseRule(rule));

  // 当父组件规则变化时同步（来自预设插入等场景）
  useEffect(() => {
    setParsed(parseRule(rule));
  }, [rule]);

  const applyParsed = (next: ParsedRule) => {
    setParsed(next);
    const str = buildRuleStr(next);
    if (str) onChange(str);
  };

  const toolOption = TOOL_OPTIONS.find((t) => t.value === parsed.tool || (t.value === 'mcp__' && parsed.tool.startsWith('mcp__')));
  const placeholder = toolOption?.placeholder ?? '';

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 6, marginBottom: 6 }}>
      {/* 规则头部 */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', cursor: 'pointer', background: 'var(--bg-secondary)', borderRadius: expanded ? '6px 6px 0 0' : 6 }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rule || <span style={{ color: 'var(--text-secondary)' }}>(空规则)</span>}
        </span>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="删除" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '1px 3px' }}>
          <Trash2 size={12} />
        </button>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </div>

      {expanded && (
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 模式切换 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setRawMode((v) => !v)} style={{ fontSize: 11, padding: '1px 8px', opacity: 0.7 }}>
              {rawMode ? '← 构建器' : '{ } 原始'}
            </button>
          </div>

          {rawMode ? (
            <label style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>规则字符串（直接编辑）</span>
              <input className="input" style={{ width: '100%', fontFamily: 'monospace' }} value={rule} onChange={(e) => { onChange(e.target.value); setParsed(parseRule(e.target.value)); }} />
            </label>
          ) : (
            <>
              {/* 工具选择 */}
              <label style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>工具</span>
                <select className="input" style={{ width: '100%' }}
                  value={parsed.tool.startsWith('mcp__') ? 'mcp__' : (TOOL_OPTIONS.find(t => t.value === parsed.tool) ? parsed.tool : '_custom')}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'mcp__') applyParsed({ ...parsed, tool: 'mcp__' });
                    else if (v === '_custom') applyParsed({ ...parsed, tool: '' });
                    else applyParsed({ ...parsed, tool: v });
                  }}>
                  {TOOL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>
                  ))}
                  <option value="_custom">自定义工具名...</option>
                </select>
              </label>

              {/* 自定义工具名输入 */}
              {(!TOOL_OPTIONS.find(t => t.value === parsed.tool && t.value !== 'mcp__') || parsed.tool === '') && (
                <label style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>工具名（手动输入）</span>
                  <input className="input" style={{ width: '100%', fontFamily: 'monospace' }}
                    value={parsed.tool}
                    onChange={(e) => applyParsed({ ...parsed, tool: e.target.value })}
                    placeholder="如 Bash 或 mcp__server__tool" />
                </label>
              )}

              {/* 参数模式 */}
              <label style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>参数模式（可选，留空表示匹配所有）</span>
                <input className="input" style={{ width: '100%', fontFamily: 'monospace' }}
                  value={parsed.pattern ?? ''}
                  onChange={(e) => applyParsed({ ...parsed, pattern: e.target.value || undefined })}
                  placeholder={placeholder || '如 git * 或 *.env'} />
              </label>

              {/* 排除模式 */}
              {parsed.pattern && (
                <label style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>排除模式（可选，冒号后的部分，匹配此模式则不生效）</span>
                  <input className="input" style={{ width: '100%', fontFamily: 'monospace' }}
                    value={parsed.exclusion ?? ''}
                    onChange={(e) => applyParsed({ ...parsed, exclusion: e.target.value || undefined })}
                    placeholder="如 rm * 表示排除 rm 命令" />
                </label>
              )}

              {/* 预览 */}
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 4 }}>
                → {buildRuleStr(parsed) || '(未完整填写)'}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 子组件：规则列表（单个 tab 的内容）─────────────────────────────────────

const LIST_META: Record<RuleList, { label: string; color: string; desc: string }> = {
  allow: { label: '允许 (allow)', color: '#22c55e', desc: '明确放行的工具/命令，无需用户二次确认' },
  deny:  { label: '拒绝 (deny)',  color: '#ef4444', desc: '明确拒绝的工具/命令，Claude 无法执行' },
  ask:   { label: '询问 (ask)',   color: '#f59e0b', desc: '执行前需用户手动确认' },
};

function RuleListEditor({
  list,
  rules,
  onChange,
}: {
  list: RuleList;
  rules: string[];
  onChange: (r: string[]) => void;
}) {
  const [showPresets, setShowPresets] = useState(false);
  const meta = LIST_META[list];
  const presets = RULE_PRESETS.filter((p) => p.list === list);

  const addRule = (r?: string) => onChange([...rules, r ?? '']);
  const updateRule = (i: number, r: string) => { const next = [...rules]; next[i] = r; onChange(next); };
  const deleteRule = (i: number) => onChange(rules.filter((_, j) => j !== i));

  return (
    <div>
      {/* 说明 */}
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 6, borderLeft: `3px solid ${meta.color}` }}>
        <strong style={{ color: meta.color }}>{meta.label}</strong>：{meta.desc}
      </div>

      {/* 常用工具快速添加 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>快速添加常用工具</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {TOOL_OPTIONS.filter(t => t.value !== 'mcp__').map((t) => (
            <button key={t.value} className="btn" title={t.desc} onClick={() => addRule(t.value)}
              style={{ fontSize: 11, padding: '1px 8px', opacity: 0.7 }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 规则列表 */}
      {rules.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
          暂无规则。点击下方按钮添加，或使用预设快速填入。
        </div>
      )}
      {rules.map((rule, i) => (
        <RuleItem key={i} rule={rule} onChange={(r) => updateRule(i, r)} onDelete={() => deleteRule(i)} />
      ))}

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn" onClick={() => addRule()} style={{ fontSize: 12 }}>
          <Plus size={12} /> 添加空规则
        </button>
        <button className="btn" onClick={() => setShowPresets((v) => !v)} style={{ fontSize: 12, opacity: 0.8 }}>
          <Zap size={12} /> 预设 {showPresets ? '▲' : '▼'}
        </button>
      </div>

      {/* 预设列表 */}
      {showPresets && (
        <div style={{ marginTop: 8, border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
          {presets.map((p) => (
            <div key={p.rule} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{p.label}</div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{p.desc}</div>
              </div>
              <button
                className="btn"
                onClick={() => { addRule(p.rule); setShowPresets(false); }}
                disabled={rules.includes(p.rule)}
                style={{ fontSize: 11, padding: '2px 10px', flexShrink: 0 }}
              >
                {rules.includes(p.rule) ? '已添加' : '添加'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 主组件 ────────────────────────────────────────────────────────────────

export function RulesPanel() {
  const [activeTab, setActiveTab] = useState<RuleList>('allow');
  const [allowRules, setAllowRules] = useState<string[]>([]);
  const [denyRules, setDenyRules] = useState<string[]>([]);
  const [askRules, setAskRules] = useState<string[]>([]);
  const [permissionMode, setPermissionMode] = useState<string>('auto');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // 加载配置
  useEffect(() => {
    window.electronAPI.loadCliConfig().then((res) => {
      if (res.success && res.settings) {
        const perms = res.settings.permissions;
        setAllowRules(perms?.allow ?? []);
        setDenyRules(perms?.deny ?? []);
        setAskRules(perms?.ask ?? []);
        setPermissionMode(perms?.mode ?? 'auto');
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const result = await window.electronAPI.saveCliConfig({
        permissions: {
          mode: permissionMode,
          allow: allowRules.filter(Boolean),
          deny: denyRules.filter(Boolean),
          ask: askRules.filter(Boolean),
        },
      });
      setSaveMsg(result.success ? { ok: true, text: '规则已保存到 ~/.claude/settings.json' } : { ok: false, text: result.error ?? '保存失败' });
    } catch (e) {
      setSaveMsg({ ok: false, text: String(e) });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  const tabCounts: Record<RuleList, number> = {
    allow: allowRules.filter(Boolean).length,
    deny: denyRules.filter(Boolean).length,
    ask: askRules.filter(Boolean).length,
  };

  const currentRules = activeTab === 'allow' ? allowRules : activeTab === 'deny' ? denyRules : askRules;
  const setCurrentRules = activeTab === 'allow' ? setAllowRules : activeTab === 'deny' ? setDenyRules : setAskRules;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 顶部工具栏 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, background: 'var(--bg-secondary)' }}>
        <Shield size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>权限规则管理</span>

        {/* permissionMode */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span>模式</span>
          <select value={permissionMode} onChange={(e) => setPermissionMode(e.target.value)} className="input" style={{ padding: '2px 6px', fontSize: 12 }}>
            <option value="auto">auto（默认，自动判断）</option>
            <option value="plan">plan（只读计划，不执行修改）</option>
            <option value="acceptEdits">acceptEdits（自动接受文件编辑）</option>
            <option value="dontAsk">dontAsk（不询问，完全自主）</option>
            <option value="bypassPermissions">bypassPermissions（旁路所有权限，危险！）</option>
          </select>
        </label>

        {/* 保存 */}
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading} style={{ fontSize: 12, padding: '4px 14px', flexShrink: 0 }}>
          <Save size={12} /> {saving ? '保存中...' : '保存'}
        </button>
      </div>

      {/* 保存状态 */}
      {saveMsg && (
        <div style={{ padding: '6px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, background: saveMsg.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: saveMsg.ok ? '#22c55e' : '#ef4444', flexShrink: 0 }}>
          {saveMsg.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
          {saveMsg.text}
        </div>
      )}

      {/* Tab 导航 */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-color)', flexShrink: 0, background: 'var(--bg-secondary)' }}>
        {(['allow', 'deny', 'ask'] as RuleList[]).map((tab) => {
          const meta = LIST_META[tab];
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom: isActive ? `2px solid ${meta.color}` : '2px solid transparent',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? meta.color : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {meta.label.split(' ')[0]}
              {tabCounts[tab] > 0 && (
                <span style={{ fontSize: 10, background: meta.color, color: '#fff', borderRadius: 10, padding: '0 5px', minWidth: 16, textAlign: 'center' }}>
                  {tabCounts[tab]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>正在加载配置...</div>
        ) : (
          <RuleListEditor list={activeTab} rules={currentRules} onChange={setCurrentRules} />
        )}
      </div>

      {/* 底部说明 */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-color)', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, background: 'var(--bg-secondary)' }}>
        规则语法：<code style={{ fontFamily: 'monospace' }}>工具名</code> 匹配全部 ·
        <code style={{ fontFamily: 'monospace' }}>工具名(pattern)</code> 匹配参数 ·
        <code style={{ fontFamily: 'monospace' }}>工具名(a:b)</code> 匹配 a 但排除 b ·
        保存到 <code style={{ fontFamily: 'monospace' }}>~/.claude/settings.json</code>
      </div>
    </div>
  );
}
