import { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, Plus, Trash2, ChevronDown, ChevronUp, Save, AlertCircle, CheckCircle, ToggleLeft, ToggleRight, Copy, FlaskConical, Play } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';

// ─── 类型定义 ───────────────────────────────────────────────────────────────

interface HookHandler {
  type: 'command' | 'http' | 'mcp_tool' | 'prompt' | 'agent';
  command?: string;
  async?: boolean;
  shell?: 'bash' | 'powershell';
  url?: string;
  headers?: Record<string, string>;
  allowedEnvVars?: string[];
  server?: string;
  tool?: string;
  input?: Record<string, unknown>;
  prompt?: string;
  model?: string;
  if?: string;
  timeout?: number;
  statusMessage?: string;
}

interface HookMatcherGroup {
  matcher?: string;
  hooks: HookHandler[];
}

type HooksConfig = Record<string, HookMatcherGroup[]>;

// ─── 常量 ───────────────────────────────────────────────────────────────────

/** 所有支持的 Hook 事件，按用途分组 */
const HOOK_EVENTS = {
  '工具调用': ['PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PostToolBatch', 'PermissionRequest', 'PermissionDenied'],
  '会话生命周期': ['SessionStart', 'SessionEnd', 'Setup'],
  '用户交互': ['UserPromptSubmit', 'UserPromptExpansion', 'Stop', 'StopFailure'],
  '文件与配置': ['FileChanged', 'CwdChanged', 'ConfigChange', 'InstructionsLoaded'],
  'Worktree': ['WorktreeCreate', 'WorktreeRemove'],
  '子代理': ['SubagentStart', 'SubagentStop', 'TaskCreated', 'TaskCompleted', 'TeammateIdle'],
  '其他': ['PreCompact', 'PostCompact', 'Notification', 'Elicitation', 'ElicitationResult'],
};

const ALL_EVENTS = Object.values(HOOK_EVENTS).flat();
void ALL_EVENTS; // 备用：供其他功能使用

/** 各事件的常用 matcher 建议 */
const MATCHER_SUGGESTIONS: Record<string, string[]> = {
  PreToolUse: ['Bash', 'Write', 'Edit', 'Read', '*', 'mcp__.*'],
  PostToolUse: ['Bash', 'Write', 'Edit', 'Write|Edit', '*'],
  PostToolUseFailure: ['Bash', '*'],
  PermissionRequest: ['Bash', 'Write', '*'],
  SessionStart: ['startup', 'resume'],
  SessionEnd: ['clear', 'resume', 'other'],
  Notification: ['permission_prompt', 'idle_prompt'],
  SubagentStart: ['Explore', 'Plan', 'general-purpose'],
  SubagentStop: ['Explore', 'Plan', 'general-purpose'],
  ConfigChange: ['user_settings', 'project_settings'],
  PreCompact: ['manual', 'auto'],
  PostCompact: ['manual', 'auto'],
};

/** 预设模板 */
const PRESETS: Array<{ label: string; desc: string; event: string; group: HookMatcherGroup }> = [
  {
    label: '文件保存后自动 lint',
    desc: 'Write/Edit 工具后运行 lint',
    event: 'PostToolUse',
    group: {
      matcher: 'Write|Edit',
      hooks: [{ type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/lint.sh', async: true }],
    },
  },
  {
    label: '阻断 rm -rf 命令',
    desc: '阻止危险的 rm -rf 删除命令',
    event: 'PreToolUse',
    group: {
      matcher: 'Bash',
      hooks: [{ type: 'command', if: 'Bash(rm -rf *)', command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/block-rm.sh' }],
    },
  },
  {
    label: 'Session 开始时注入上下文',
    desc: '每次 session 启动时加载当前 git 分支等信息',
    event: 'SessionStart',
    group: {
      matcher: 'startup',
      hooks: [{ type: 'command', command: 'git branch --show-current 2>/dev/null | jq -Rn --arg branch "$(cat)" \'{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":("当前分支: "+$branch)}}\'' }],
    },
  },
  {
    label: '任务完成前运行测试',
    desc: '阻止 Claude 在测试未通过时结束',
    event: 'Stop',
    group: {
      hooks: [{ type: 'prompt', prompt: '检查所有用户请求的任务是否已完成，测试是否通过: $ARGUMENTS。如果还有未完成的任务，返回 {"ok": false, "reason": "请先完成..."} 。' }],
    },
  },
];

// ─── 工具函数 ─────────────────────────────────────────────────────────────

function handlerTypeLabel(type: string) {
  const map: Record<string, string> = {
    command: 'Shell 命令',
    http: 'HTTP 请求',
    mcp_tool: 'MCP 工具',
    prompt: 'LLM 提示',
    agent: '子代理',
  };
  return map[type] ?? type;
}

function handlerSummary(h: HookHandler): string {
  if (h.type === 'command') return h.command ?? '(未设置命令)';
  if (h.type === 'http') return h.url ?? '(未设置 URL)';
  if (h.type === 'mcp_tool') return `${h.server ?? '?'}.${h.tool ?? '?'}`;
  if (h.type === 'prompt' || h.type === 'agent') return (h.prompt ?? '').slice(0, 60) || '(未设置提示词)';
  return '';
}

// ─── 子组件：handler 编辑器 ───────────────────────────────────────────────

function HandlerEditor({
  handler,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  handler: HookHandler;
  onChange: (h: HookHandler) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // HTTP headers 本地状态（key-value 对数组）
  const [headerPairs, setHeaderPairs] = useState<[string, string][]>(
    () => Object.entries(handler.headers ?? {})
  );
  // mcp_tool input JSON 本地状态
  const [inputJson, setInputJson] = useState<string>(
    () => handler.input ? JSON.stringify(handler.input, null, 2) : ''
  );
  const [inputJsonError, setInputJsonError] = useState<string | null>(null);

  const set = <K extends keyof HookHandler>(k: K, v: HookHandler[K]) => onChange({ ...handler, [k]: v });

  // 更新 headers 到父组件
  const updateHeaderPair = (i: number, k: string, v: string) => {
    const next = [...headerPairs];
    next[i] = [k, v];
    setHeaderPairs(next);
    const record = Object.fromEntries(next.filter(([key]) => key.trim()));
    onChange({ ...handler, headers: Object.keys(record).length ? record : undefined });
  };
  const addHeaderPair = () => setHeaderPairs([...headerPairs, ['', '']]);
  const removeHeaderPair = (i: number) => {
    const next = headerPairs.filter((_, idx) => idx !== i);
    setHeaderPairs(next);
    const record = Object.fromEntries(next.filter(([key]) => key.trim()));
    onChange({ ...handler, headers: Object.keys(record).length ? record : undefined });
  };

  // 解析 mcp_tool input JSON
  const handleInputJsonChange = (text: string) => {
    setInputJson(text);
    try {
      const parsed = text.trim() ? JSON.parse(text) : undefined;
      onChange({ ...handler, input: parsed });
      setInputJsonError(null);
    } catch {
      setInputJsonError('JSON 格式错误，修改尚未应用');
    }
  };

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 6, marginTop: 6 }}>
      {/* header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer', background: 'var(--bg-secondary)', borderRadius: expanded ? '6px 6px 0 0' : 6 }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: 'var(--accent)', color: '#fff', flexShrink: 0 }}>
          {handlerTypeLabel(handler.type)}
        </span>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {handlerSummary(handler)}
        </span>
        {handler.async && <span style={{ fontSize: 10, color: '#f59e0b', flexShrink: 0 }}>异步</span>}
        {/* 顺序调整按钒 */}
        {onMoveUp && (
          <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} title="上移" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '1px 3px', flexShrink: 0 }}>
            <ChevronUp size={11} />
          </button>
        )}
        {onMoveDown && (
          <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} title="下移" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '1px 3px', flexShrink: 0 }}>
            <ChevronDown size={11} />
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="删除" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '1px 3px', flexShrink: 0 }}>
          <Trash2 size={12} />
        </button>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </div>

      {expanded && (
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* type */}
          <label style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>类型</span>
            <select value={handler.type} onChange={(e) => set('type', e.target.value as HookHandler['type'])} className="input" style={{ width: '100%' }}>
              <option value="command">command — Shell 命令</option>
              <option value="http">http — HTTP 请求</option>
              <option value="mcp_tool">mcp_tool — MCP 工具</option>
              <option value="prompt">prompt — LLM 提示</option>
              <option value="agent">agent — 子代理（实验性）</option>
            </select>
          </label>

          {/* command */}
          {handler.type === 'command' && (
            <>
              <label style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>命令</span>
                <input className="input" style={{ width: '100%' }} value={handler.command ?? ''} onChange={(e) => set('command', e.target.value)} placeholder='如: "$CLAUDE_PROJECT_DIR"/.claude/hooks/lint.sh' />
              </label>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!handler.async} onChange={(e) => set('async', e.target.checked || undefined)} />
                  异步执行（不阻塞 Claude）
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Shell</span>
                  <select value={handler.shell ?? 'bash'} onChange={(e) => set('shell', e.target.value === 'bash' ? undefined : 'powershell')} className="input" style={{ padding: '1px 6px' }}>
                    <option value="bash">bash（默认）</option>
                    <option value="powershell">powershell（Windows）</option>
                  </select>
                </label>
              </div>
            </>
          )}

          {/* http */}
          {handler.type === 'http' && (
            <>
              <label style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>URL</span>
                <input className="input" style={{ width: '100%' }} value={handler.url ?? ''} onChange={(e) => set('url', e.target.value)} placeholder="http://localhost:8080/hooks/pre-tool-use" />
              </label>
              {/* Headers 编辑 */}
              <div style={{ fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>请求头 Headers</span>
                  <button className="btn" onClick={addHeaderPair} style={{ fontSize: 11, padding: '0 6px' }}>
                    <Plus size={10} /> 添加
                  </button>
                </div>
                {headerPairs.map(([k, v], i) => (
                  <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    <input className="input" placeholder="Header 名（如 Authorization）" value={k} onChange={(e) => updateHeaderPair(i, e.target.value, v)} style={{ flex: 1, fontFamily: 'monospace', fontSize: 11 }} />
                    <input className="input" placeholder="值（支持 $VAR_NAME 插值）" value={v} onChange={(e) => updateHeaderPair(i, k, e.target.value)} style={{ flex: 2, fontFamily: 'monospace', fontSize: 11 }} />
                    <button onClick={() => removeHeaderPair(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0 4px' }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
                {headerPairs.length === 0 && (
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>暂无自定义 Header（Content-Type: application/json 会自动添加）</span>
                )}
              </div>
              {/* allowedEnvVars */}
              <label style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>允许插值的环境变量（逗号分隔，如 MY_TOKEN,API_KEY）</span>
                <input className="input" style={{ width: '100%', fontFamily: 'monospace', fontSize: 11 }}
                  value={(handler.allowedEnvVars ?? []).join(', ')}
                  onChange={(e) => set('allowedEnvVars', e.target.value.split(',').map((s) => s.trim()).filter(Boolean) as HookHandler['allowedEnvVars'])}
                  placeholder="MY_TOKEN" />
              </label>
            </>
          )}

          {/* mcp_tool */}
          {handler.type === 'mcp_tool' && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ fontSize: 12, flex: 1 }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>MCP 服务器名</span>
                  <input className="input" style={{ width: '100%' }} value={handler.server ?? ''} onChange={(e) => set('server', e.target.value)} placeholder="my_server" />
                </label>
                <label style={{ fontSize: 12, flex: 1 }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>工具名</span>
                  <input className="input" style={{ width: '100%' }} value={handler.tool ?? ''} onChange={(e) => set('tool', e.target.value)} placeholder="security_scan" />
                </label>
              </div>
              {/* input JSON 编辑 */}
              <label style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>
                  工具参数 input（JSON，支持 {'${tool_input.file_path}'} 占位符）
                </span>
                <textarea className="input" style={{ width: '100%', minHeight: 60, fontFamily: 'monospace', fontSize: 11, resize: 'vertical', color: inputJsonError ? '#ef4444' : undefined }}
                  value={inputJson}
                  onChange={(e) => handleInputJsonChange(e.target.value)}
                  placeholder={'{\n  "file_path": "${tool_input.file_path}"\n}'} />
                {inputJsonError && <span style={{ color: '#ef4444', fontSize: 11 }}>{inputJsonError}</span>}
              </label>
            </>
          )}

          {/* prompt / agent */}
          {(handler.type === 'prompt' || handler.type === 'agent') && (
            <label style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>提示词（$ARGUMENTS 为 hook 输入 JSON 占位符）</span>
              <textarea className="input" style={{ width: '100%', minHeight: 72, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
                value={handler.prompt ?? ''} onChange={(e) => set('prompt', e.target.value)}
                placeholder="评估 Claude 是否应该停止: $ARGUMENTS" />
            </label>
          )}

          {/* 通用字段 */}
          <label style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>if 条件（可选，权限规则语法，如 Bash(rm *)）</span>
            <input className="input" style={{ width: '100%' }} value={handler.if ?? ''} onChange={(e) => set('if', e.target.value || undefined)} placeholder="Bash(git push *)" />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ fontSize: 12, flex: 1 }}>
              <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>超时（秒，可选）</span>
              <input type="number" className="input" style={{ width: '100%' }} value={handler.timeout ?? ''} onChange={(e) => set('timeout', e.target.value ? Number(e.target.value) : undefined)} placeholder="600" />
            </label>
            <label style={{ fontSize: 12, flex: 2 }}>
              <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>状态栏提示（可选）</span>
              <input className="input" style={{ width: '100%' }} value={handler.statusMessage ?? ''} onChange={(e) => set('statusMessage', e.target.value || undefined)} placeholder="正在运行 lint..." />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 子组件：matcher group 编辑器 ─────────────────────────────────────────

function MatcherGroupEditor({
  group,
  event,
  onChange,
  onDelete,
}: {
  group: HookMatcherGroup;
  event: string;
  onChange: (g: HookMatcherGroup) => void;
  onDelete: () => void;
}) {
  const suggestions = MATCHER_SUGGESTIONS[event] ?? [];
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // 切换到 JSON 模式时，同步当前 group 到 jsonText
  const toggleJsonMode = () => {
    if (!isJsonMode) {
      setJsonText(JSON.stringify(group, null, 2));
      setJsonError(null);
    }
    setIsJsonMode((v) => !v);
  };

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text) as HookMatcherGroup;
      onChange(parsed);
      setJsonError(null);
    } catch {
      setJsonError('JSON 格式错误，修改尚未应用');
    }
  };

  const addHandler = () => {
    onChange({ ...group, hooks: [...group.hooks, { type: 'command', command: '' }] });
  };

  const updateHandler = (i: number, h: HookHandler) => {
    const hooks = [...group.hooks];
    hooks[i] = h;
    onChange({ ...group, hooks });
  };

  const deleteHandler = (i: number) => {
    const hooks = group.hooks.filter((_, idx) => idx !== i);
    onChange({ ...group, hooks });
  };

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, marginTop: 10, background: 'var(--bg-primary)' }}>
      {/* matcher + 工具栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>Matcher</span>
        <input
          className="input"
          style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
          value={group.matcher ?? ''}
          onChange={(e) => onChange({ ...group, matcher: e.target.value || undefined })}
          placeholder="* (匹配全部，或填工具名如 Bash、Write|Edit)"
          disabled={isJsonMode}
        />
        <button
          className="btn"
          onClick={toggleJsonMode}
          title={isJsonMode ? '切回表单模式' : '切换到 JSON 编辑模式'}
          style={{ fontSize: 11, padding: '2px 8px', opacity: isJsonMode ? 1 : 0.7, flexShrink: 0 }}
        >
          {isJsonMode ? '← 表单' : '{ } JSON'}
        </button>
        <button onClick={onDelete} title="删除此 matcher group" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px 4px', flexShrink: 0 }}>
          <Trash2 size={13} />
        </button>
      </div>
      {suggestions.length > 0 && !group.matcher && !isJsonMode && (
        <div style={{ marginBottom: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {suggestions.map((s) => (
            <button key={s} className="btn" onClick={() => onChange({ ...group, matcher: s })}
              style={{ fontSize: 10, padding: '1px 6px', opacity: 0.7 }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* JSON 模式 */}
      {isJsonMode ? (
        <div>
          <textarea
            className="input"
            style={{ width: '100%', minHeight: 140, fontFamily: 'monospace', fontSize: 11, resize: 'vertical', color: jsonError ? '#ef4444' : undefined }}
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            spellCheck={false}
          />
          {jsonError && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>{jsonError}</div>}
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            直接编辑 JSON；格式正确时会实时应用到配置。
          </div>
        </div>
      ) : (
        <>
          {/* handlers */}
          {group.hooks.map((h, i) => (
            <HandlerEditor
              key={i}
              handler={h}
              onChange={(v) => updateHandler(i, v)}
              onDelete={() => deleteHandler(i)}
              onMoveUp={i > 0 ? () => {
                const hooks = [...group.hooks];
                [hooks[i - 1], hooks[i]] = [hooks[i], hooks[i - 1]];
                onChange({ ...group, hooks });
              } : undefined}
              onMoveDown={i < group.hooks.length - 1 ? () => {
                const hooks = [...group.hooks];
                [hooks[i], hooks[i + 1]] = [hooks[i + 1], hooks[i]];
                onChange({ ...group, hooks });
              } : undefined}
            />
          ))}

          <button className="btn" onClick={addHandler} style={{ marginTop: 8, fontSize: 12 }}>
            <Plus size={12} /> 添加 Handler
          </button>
        </>
      )}
    </div>
  );
}

// ─── 3.5.7 TestRunnerModal ─────────────────────────────────────────────────

/** 各事件的默认模拟环境变量 */
const DEFAULT_ENV: Record<string, Record<string, string>> = {
  PreToolUse:  { CLAUDE_TOOL_NAME: 'Bash', CLAUDE_BASH_COMMAND: 'echo test' },
  PostToolUse: { CLAUDE_TOOL_NAME: 'Write', CLAUDE_FILE_PATHS: '/workspace/test.ts' },
  PostToolUseFailure: { CLAUDE_TOOL_NAME: 'Bash', CLAUDE_BASH_COMMAND: 'exit 1' },
  SessionStart: { CLAUDE_SESSION_ID: 'test-session-001' },
  SessionEnd:   { CLAUDE_SESSION_ID: 'test-session-001' },
  FileChanged:  { CLAUDE_FILE_PATHS: '/workspace/test.ts' },
  Notification: { CLAUDE_NOTIFICATION_TYPE: 'idle_prompt' },
  Stop:         { CLAUDE_SESSION_ID: 'test-session-001' },
};

interface TestResult {
  hookIndex: number;
  command: string;
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  error?: string;
}

function TestRunnerModal({
  event,
  groups,
  cwd,
  onClose,
}: {
  event: string;
  groups: HookMatcherGroup[];
  cwd: string;
  onClose: () => void;
}) {
  const defaultEnv = DEFAULT_ENV[event] ?? {};
  const [envRows, setEnvRows] = useState<Array<{ key: string; value: string }>>(
    Object.entries(defaultEnv).map(([key, value]) => ({ key, value }))
  );
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // 收集所有 command 类型 handlers
  const commandHandlers: Array<{ groupIdx: number; hookIdx: number; command: string; matcher?: string }> = [];
  groups.forEach((g, gi) => {
    g.hooks.forEach((h, hi) => {
      if (h.type === 'command' && h.command) {
        commandHandlers.push({ groupIdx: gi, hookIdx: hi, command: h.command, matcher: g.matcher });
      }
    });
  });

  const envObj = Object.fromEntries(envRows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value]));
  envObj.CLAUDE_PROJECT_DIR = cwd || '/';

  const handleRun = useCallback(async () => {
    if (!window.electronAPI?.hookTestRun) return;
    setRunning(true);
    setResults([]);
    const newResults: TestResult[] = [];
    for (let i = 0; i < commandHandlers.length; i++) {
      const { command } = commandHandlers[i];
      const res = await window.electronAPI.hookTestRun(command, cwd, envObj);
      newResults.push({ hookIndex: i, command, ...res });
      setResults([...newResults]);
    }
    setRunning(false);
  }, [commandHandlers, cwd, envObj]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [results]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 10,
        width: 620, maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <FlaskConical size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Hook 测试运行器</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 6, padding: '1px 8px', marginLeft: 4 }}>{event}</span>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* 环境变量 */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>模拟环境变量</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {envRows.map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    className="input"
                    style={{ flex: '0 0 200px', fontSize: 12, fontFamily: 'monospace', padding: '3px 6px' }}
                    value={row.key}
                    placeholder="变量名"
                    onChange={(e) => { const n = [...envRows]; n[i] = { ...n[i], key: e.target.value }; setEnvRows(n); }}
                  />
                  <input
                    className="input"
                    style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', padding: '3px 6px' }}
                    value={row.value}
                    placeholder="值"
                    onChange={(e) => { const n = [...envRows]; n[i] = { ...n[i], value: e.target.value }; setEnvRows(n); }}
                  />
                  <button onClick={() => setEnvRows(envRows.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button className="btn" onClick={() => setEnvRows([...envRows, { key: '', value: '' }])} style={{ alignSelf: 'flex-start', fontSize: 11, marginTop: 2 }}>
                <Plus size={11} /> 添加变量
              </button>
            </div>
          </div>

          {/* 待测 handlers 列表 */}
          {commandHandlers.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              当前事件下没有 command 类型的 Handler，无法运行测试。
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>将运行 {commandHandlers.length} 个 Handler</div>
              {commandHandlers.map((h, i) => (
                <div key={i} style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)', padding: '3px 0' }}>
                  #{i + 1} {h.matcher ? `[${h.matcher}] ` : ''}{h.command.slice(0, 80)}{h.command.length > 80 ? '…' : ''}
                </div>
              ))}
            </div>
          )}

          {/* 结果 */}
          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>运行结果</div>
              {results.map((r, i) => (
                <div key={i} style={{ border: '1px solid var(--border-color)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-secondary)', fontSize: 12 }}>
                    {r.success ? <CheckCircle size={13} style={{ color: '#22c55e' }} /> : <AlertCircle size={13} style={{ color: '#ef4444' }} />}
                    <span style={{ fontWeight: 600 }}>Handler #{r.hookIndex + 1}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{r.durationMs}ms</span>
                    <span style={{ color: r.exitCode === 0 ? '#22c55e' : '#ef4444' }}>退出码: {r.exitCode ?? 'N/A'}</span>
                    {r.error && <span style={{ color: '#f59e0b', fontSize: 11 }}>{r.error}</span>}
                  </div>
                  {(r.stdout || r.stderr) && (
                    <pre style={{ margin: 0, padding: '8px 10px', fontSize: 11, fontFamily: 'monospace', background: '#0d0d0d', color: '#e5e7eb', overflowX: 'auto', maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {r.stdout}
                      {r.stderr && <span style={{ color: '#fca5a5' }}>{r.stderr}</span>}
                    </pre>
                  )}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>
            工作目录：{cwd || '(未设置)'}
          </span>
          <button className="btn" onClick={onClose} style={{ fontSize: 12 }}>关闭</button>
          <button
            className="btn btn-primary"
            onClick={() => void handleRun()}
            disabled={running || commandHandlers.length === 0 || !window.electronAPI?.hookTestRun}
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Play size={12} />
            {running ? '运行中…' : '▶ 运行'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 主组件 ────────────────────────────────────────────────────────────────

export function HooksPanel() {
  const [hooksConfig, setHooksConfig] = useState<HooksConfig>({});
  const [disableAll, setDisableAll] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string>('PreToolUse');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTestRunner, setShowTestRunner] = useState(false); // 3.5.7
  const cwd = useAppStore((s) => s.session.workingDirectory) || '';

  // 加载配置
  useEffect(() => {
    window.electronAPI.loadCliConfig().then((res) => {
      if (res.success && res.settings) {
        setHooksConfig((res.settings.hooks as HooksConfig | undefined) ?? {});
        setDisableAll(!!res.settings.disableAllHooks);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const totalCount = Object.values(hooksConfig).reduce((s, groups) => s + groups.length, 0);

  // 保存
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMsg(null);
    const payload: Record<string, unknown> = { hooks: hooksConfig, disableAllHooks: disableAll || undefined };
    const res = await window.electronAPI.saveCliConfig(payload);
    setSaving(false);
    setSaveMsg({ ok: !!res.success, text: res.success ? '已保存到 ~/.claude/settings.json' : (res.error ?? '保存失败') });
    setTimeout(() => setSaveMsg(null), 3000);
  }, [hooksConfig, disableAll]);

  // 当前事件的 groups
  const currentGroups = hooksConfig[selectedEvent] ?? [];

  const updateGroups = (groups: HookMatcherGroup[]) => {
    setHooksConfig((prev) => {
      if (groups.length === 0) {
        const next = { ...prev };
        delete next[selectedEvent];
        return next;
      }
      return { ...prev, [selectedEvent]: groups };
    });
  };

  const addGroup = () => {
    updateGroups([...currentGroups, { hooks: [{ type: 'command', command: '' }] }]);
  };

  const updateGroup = (i: number, g: HookMatcherGroup) => {
    const next = [...currentGroups];
    next[i] = g;
    updateGroups(next);
  };

  const deleteGroup = (i: number) => {
    updateGroups(currentGroups.filter((_, idx) => idx !== i));
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setSelectedEvent(preset.event);
    const existing = hooksConfig[preset.event] ?? [];
    setHooksConfig((prev) => ({ ...prev, [preset.event]: [...existing, preset.group] }));
    setShowPresets(false);
  };

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--text-secondary)', fontSize: 13 }}>加载配置中…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 顶部工具栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <Zap size={15} style={{ color: 'var(--accent)' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Hooks</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 10, padding: '1px 7px' }}>{totalCount} 个</span>
        <span style={{ flex: 1 }} />
        {/* 禁用开关 */}
        <button
          onClick={() => setDisableAll((v) => !v)}
          title={disableAll ? '所有 Hooks 已禁用，点击启用' : '点击禁用所有 Hooks'}
          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: disableAll ? '#ef4444' : 'var(--text-secondary)' }}
        >
          {disableAll ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
          {disableAll ? '已全部禁用' : '全部启用'}
        </button>
        <button className="btn" onClick={() => setShowPresets((v) => !v)} style={{ fontSize: 12 }}>
          <Copy size={12} /> 预设
        </button>
        {/* 3.5.7 测试运行器按钮 */}
        <button
          className="btn"
          onClick={() => setShowTestRunner(true)}
          title="测试当前事件的所有 Hook Handler"
          style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <FlaskConical size={12} /> 测试
        </button>
        <button className="btn" onClick={() => setShowJson((v) => !v)} style={{ fontSize: 12 }}>
          {'{}'} JSON
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: 12 }}>
          <Save size={12} /> {saving ? '保存中…' : '保存'}
        </button>
      </div>

      {/* 保存提示 */}
      {saveMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, background: saveMsg.ok ? '#dcfce7' : '#fee2e2', color: saveMsg.ok ? '#166534' : '#991b1b', flexShrink: 0 }}>
          {saveMsg.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
          {saveMsg.text}
        </div>
      )}

      {/* 预设面板 */}
      {showPresets && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>选择预设模板（会追加到对应事件）：</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PRESETS.map((p) => (
              <button key={p.label} className="btn" onClick={() => applyPreset(p)}
                style={{ fontSize: 12, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 10px', maxWidth: 200 }}>
                <span style={{ fontWeight: 600 }}>{p.label}</span>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 400 }}>{p.desc} ({p.event})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* JSON 预览 */}
      {showJson && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>当前 hooks 配置（写入 ~/.claude/settings.json 的内容）：</div>
          <pre style={{ margin: 0, fontSize: 11, color: 'var(--text-primary)', maxHeight: 160, overflowY: 'auto', background: 'var(--bg-secondary)', padding: 8, borderRadius: 4 }}>
            {JSON.stringify({ hooks: hooksConfig }, null, 2)}
          </pre>
        </div>
      )}

      {/* 主体：左侧事件列表 + 右侧编辑区 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 左：事件列表 */}
        <div style={{ width: 180, flexShrink: 0, borderRight: '1px solid var(--border-color)', overflowY: 'auto', padding: '8px 0' }}>
          {Object.entries(HOOK_EVENTS).map(([group, events]) => (
            <div key={group}>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', padding: '4px 12px 2px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{group}</div>
              {events.map((ev) => {
                const count = (hooksConfig[ev] ?? []).length;
                const isActive = ev === selectedEvent;
                return (
                  <button key={ev} onClick={() => setSelectedEvent(ev)}
                    style={{
                      display: 'flex', alignItems: 'center', width: '100%', padding: '5px 12px', textAlign: 'left',
                      background: isActive ? 'var(--accent)' : 'transparent', color: isActive ? '#fff' : 'var(--text-primary)',
                      border: 'none', cursor: 'pointer', fontSize: 12, gap: 6,
                    }}>
                    <span style={{ flex: 1 }}>{ev}</span>
                    {count > 0 && (
                      <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 8, background: isActive ? 'rgba(255,255,255,0.3)' : 'var(--accent)', color: isActive ? '#fff' : '#fff', minWidth: 16, textAlign: 'center' }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* 右：当前事件编辑 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{selectedEvent}</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {currentGroups.length === 0 ? '暂无配置' : `${currentGroups.length} 个 matcher group`}
            </span>
            <span style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={addGroup} style={{ fontSize: 12 }}>
              <Plus size={12} /> 添加 Matcher Group
            </button>
          </div>

          {currentGroups.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 24, textAlign: 'center' }}>
              <Zap size={24} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
              <div>该事件暂无 Hook 配置</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>点击「添加 Matcher Group」新建，或从「预设」模板快速添加</div>
            </div>
          )}

          {currentGroups.map((g, i) => (
            <MatcherGroupEditor
              key={i}
              group={g}
              event={selectedEvent}
              onChange={(v) => updateGroup(i, v)}
              onDelete={() => deleteGroup(i)}
            />
          ))}

          {/* 事件说明 */}
          <div style={{ marginTop: 20, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{selectedEvent}</strong> 说明：
            {' '}
            {EVENT_DOCS[selectedEvent] ?? '在该生命周期点触发，可通过 matcher 过滤，handler 支持 command / http / mcp_tool / prompt / agent 五种类型。'}
          </div>
        </div>
      </div>

      {/* 3.5.7 TestRunnerModal */}
      {showTestRunner && (
        <TestRunnerModal
          event={selectedEvent}
          groups={currentGroups}
          cwd={cwd}
          onClose={() => setShowTestRunner(false)}
        />
      )}
    </div>
  );
}

// ─── 事件简介 ─────────────────────────────────────────────────────────────

const EVENT_DOCS: Record<string, string> = {
  PreToolUse: '工具调用前触发，可阻断调用（exit 2）或修改输入。matcher 匹配工具名（Bash / Write / Edit / mcp__server__.*）。',
  PostToolUse: '工具调用成功后触发，不能回滚，但可向 Claude 注入额外上下文。matcher 匹配工具名。',
  PostToolUseFailure: '工具调用失败后触发。可向 Claude 注入失败原因的上下文。',
  PostToolBatch: '一批并行工具全部完成后触发（仅一次）。可在下次模型调用前注入批次汇总上下文。',
  PermissionRequest: '即将弹出权限确认对话框时触发，可通过 hook 自动 allow/deny。',
  PermissionDenied: 'auto 模式分类器拒绝工具调用时触发（手动拒绝不触发）。',
  SessionStart: 'session 开始或恢复时触发。matcher：startup / resume / clear / compact。常用于加载 git 状态、环境变量等。',
  SessionEnd: 'session 结束时触发。matcher：clear / resume / logout / other。用于清理、日志等。',
  Setup: '仅在 --init-only 或 -p --init/--maintenance 时触发，用于一次性安装依赖。',
  UserPromptSubmit: '用户提交 prompt 前触发，可阻断或注入上下文。',
  UserPromptExpansion: '斜杠命令展开成 prompt 前触发，可阻断某些命令。',
  Stop: 'Claude 完成回答后触发。返回 decision:"block" + reason 可让 Claude 继续工作。',
  StopFailure: 'API 错误导致对话中断时触发（rate limit、auth 等）。仅用于日志告警，不能阻断。',
  FileChanged: '监听文件变更（matcher 指定要监听的文件名）。可配合 .envrc 实现 direnv 风格环境管理。',
  CwdChanged: '工作目录变更时触发（如 cd 命令）。可写环境变量到 $CLAUDE_ENV_FILE。',
  ConfigChange: '配置文件变更时触发，可阻断（policy_settings 变更无法阻断）。',
  InstructionsLoaded: 'CLAUDE.md 或 .claude/rules/*.md 加载时触发。仅用于审计，不能阻断。',
  Notification: 'Claude 发出通知时触发（权限请求、空闲等）。可转发到 Slack/Telegram 等。',
  SubagentStart: '子代理启动时触发。',
  SubagentStop: '子代理完成时触发，可阻止其停止（exit 2）。',
  TaskCreated: '任务被创建时触发，可阻断不符合命名规范的任务。',
  TaskCompleted: '任务被标记完成时触发，可阻断（如测试未通过）。',
  TeammateIdle: '代理团队成员即将空闲时触发，exit 2 可让其继续工作。',
  PreCompact: 'context 压缩前触发，exit 2 可阻断压缩。',
  PostCompact: '压缩完成后触发。',
  WorktreeCreate: 'worktree 创建时触发，可替换默认 git worktree 行为（如 SVN/Perforce）。',
  WorktreeRemove: 'worktree 删除时触发，用于清理非 git 工作区。',
  Elicitation: 'MCP server 请求用户输入时触发，可编程响应跳过对话框。',
  ElicitationResult: '用户回应 MCP elicitation 后、响应发送前触发，可修改或阻断响应。',
};
