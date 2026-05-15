/**
 * LaunchPanel — 委派表单（Dispatch 视图 [A] 态）
 *
 * 显示条件：session.isConnected=false AND messages.length=0
 * 提交后：调用 cliSendMessage（non-interactive 模式），切换到 TaskView [B] 态
 *
 * 功能：
 *   - 任务描述（支持 @file 引用 → 自动补全弹窗，/skill 语法提示）
 *   - 执行模式（4 选项 → --permission-mode）
 *   - Agent 下拉（从 listAgents 加载）
 *   - 工作目录选择器（Electron: 对话框; Web 模式: 手动输入 + 历史记录）
 *   - 高级选项：Skills 注入、模型覆盖、成本上限、最大轮次、禁止工具、附加系统提示词
 *   - 快速模板（4 内置 + localStorage 自定义 + 保存当前）
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Zap, FolderOpen, ChevronDown, ChevronRight, AlertTriangle, Save, X, Check } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { isElectron } from '../../lib/transport';
import { FileSearchDropdown } from './FileSearchDropdown';

// ── 类型定义 ──────────────────────────────────────────────────────────────────

type PermissionMode = 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions';

interface Template {
  id: string;
  name: string;
  taskDescription: string;
  permissionMode: PermissionMode;
  agentName?: string;
  isBuiltin?: boolean;
}

interface SkillItem {
  name: string;
  source: 'global' | 'local';
}

// ── 常量 ─────────────────────────────────────────────────────────────────────

const BUILTIN_TEMPLATES: Template[] = [
  { id: 'fix-bug',     name: '🔁 修 Bug', taskDescription: '修复以下问题：\n\n', permissionMode: 'default',     isBuiltin: true },
  { id: 'write-tests', name: '📝 写测试', taskDescription: '为以下模块编写单元测试：\n\n', permissionMode: 'acceptEdits', isBuiltin: true },
  { id: 'refactor',    name: '♻ 重构',   taskDescription: '重构以下模块，保持现有接口不变：\n\n', permissionMode: 'plan',    isBuiltin: true },
  { id: 'write-docs',  name: '📚 写文档', taskDescription: '为以下模块编写 JSDoc 注释和使用说明：\n\n', permissionMode: 'acceptEdits', isBuiltin: true },
];

const PERMISSION_MODES: Array<{ value: PermissionMode; label: string; desc: string; danger?: boolean }> = [
  { value: 'default',            label: '自动（推荐）', desc: 'Claude 自主判断何时需要确认，平衡效率与安全' },
  { value: 'plan',               label: '计划审查',    desc: '生成执行计划后必须用户确认才开始执行' },
  { value: 'acceptEdits',        label: '仅接受编辑',  desc: '文件变更自动接受，Shell 命令仍需确认' },
  { value: 'bypassPermissions',  label: '完全自主',    desc: '无需任何确认直接执行（⚠ 高风险）', danger: true },
];

const CUSTOM_TEMPLATES_KEY = 'launch-panel:custom-templates';
const WEB_DIR_HISTORY_KEY  = 'launch-panel:web-dir-history';
const MAX_CUSTOM_TEMPLATES = 10;
const MAX_DIR_HISTORY      = 5;

/** 从 localStorage 读取自定义模板 */
function loadCustomTemplates(): Template[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_TEMPLATES_KEY) ?? '[]') as Template[];
  } catch { return []; }
}

/** 保存自定义模板到 localStorage */
function saveCustomTemplates(templates: Template[]) {
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
}

/** 从 localStorage 读取 Web 模式目录历史 */
function loadWebDirHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(WEB_DIR_HISTORY_KEY) ?? '[]') as string[];
  } catch { return []; }
}

/** 保存 Web 模式目录历史 */
function saveWebDirHistory(dir: string, prev: string[]) {
  const next = [dir, ...prev.filter((d) => d !== dir)].slice(0, MAX_DIR_HISTORY);
  localStorage.setItem(WEB_DIR_HISTORY_KEY, JSON.stringify(next));
}

// ── 组件 ─────────────────────────────────────────────────────────────────────

interface LaunchPanelProps {
  /** 消息发送成功后回调（通知父组件可切换到 TaskView） */
  onLaunched?: () => void;
}

export function LaunchPanel({ onLaunched }: LaunchPanelProps) {
  const session      = useAppStore((s) => s.session);
  const setSession   = useAppStore((s) => s.setSession);
  const activeTabId  = useAppStore((s) => s.activeTabId);
  const tabs         = useAppStore((s) => s.tabs);
  const addMessage   = useAppStore((s) => s.addMessage);
  const renameTab    = useAppStore((s) => s.renameTab);

  const webMode = !isElectron();

  // ── 表单状态 ────────────────────────────────────────────────────────────
  const [taskDescription,   setTaskDescription]   = useState('');
  const [permissionMode,    setPermissionMode]     = useState<PermissionMode>('default');
  const [agentName,         setAgentName]          = useState('');
  const [modelOverride,     setModelOverride]      = useState('');
  const [disallowedTools,   setDisallowedTools]    = useState('');
  const [appendSystemPrompt, setAppendSystemPrompt] = useState('');
  const [maxBudgetUsd,      setMaxBudgetUsd]       = useState('');
  const [maxTurns,          setMaxTurns]           = useState('');
  const [showAdvanced,      setShowAdvanced]        = useState(false);
  const [isSubmitting,      setIsSubmitting]        = useState(false);
  const [errors,            setErrors]              = useState<Record<string, string>>({});

  // ── Web 模式目录手动输入 ─────────────────────────────────────────────────
  const [webDirInput,      setWebDirInput]      = useState(session.workingDirectory ?? '');
  const [webDirValid,      setWebDirValid]      = useState<boolean | null>(null);
  const [webDirHistory,    setWebDirHistory]    = useState<string[]>(() => loadWebDirHistory());
  const [showDirHistory,   setShowDirHistory]   = useState(false);
  const webDirRef = useRef<HTMLInputElement>(null);

  // ── @文件引用自动补全 ─────────────────────────────────────────────────────
  const [atQuery,          setAtQuery]          = useState<string | null>(null); // null 表示未触发
  const [atStart,          setAtStart]          = useState(0);  // @ 在文本中的起始位置
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Skills 注入 ──────────────────────────────────────────────────────────
  const [selectedSkills,   setSelectedSkills]   = useState<string[]>([]);
  const [availableSkills,  setAvailableSkills]  = useState<SkillItem[]>([]);

  // ── 模板保存 Modal ───────────────────────────────────────────────────────
  const [showSaveModal,    setShowSaveModal]    = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [customTemplates,  setCustomTemplates]  = useState<Template[]>(() => loadCustomTemplates());

  // ── 远程数据 ────────────────────────────────────────────────────────────
  const [agents, setAgents] = useState<Array<{ name: string; model: string }>>([]);

  useEffect(() => {
    window.electronAPI?.listAgents()
      .then((res) => { if (res.success && res.agents) setAgents(res.agents); })
      .catch(() => {});
  }, []);

  // 加载可用 Skills
  useEffect(() => {
    window.electronAPI?.listSkills(session.workingDirectory ?? undefined)
      .then((res) => {
        if (res.success && res.skills) setAvailableSkills(res.skills);
      })
      .catch(() => {});
  }, [session.workingDirectory]);

  // ── 工作目录选择（Electron 模式）────────────────────────────────────────
  const handlePickDir = useCallback(async () => {
    if (webMode) {
      webDirRef.current?.focus();
      return;
    }
    const res = await window.electronAPI.selectDirectory(session.workingDirectory || undefined);
    if (res.success && res.path) {
      setSession({ workingDirectory: res.path });
    }
  }, [session.workingDirectory, setSession, webMode]);

  // ── Web 模式：路径验证 ───────────────────────────────────────────────────
  const handleWebDirConfirm = useCallback(async () => {
    const dir = webDirInput.trim();
    if (!dir) return;
    // 调用 listDirectory 验证路径是否存在
    try {
      const res = await window.electronAPI.listDirectory(dir);
      if (res.success) {
        setWebDirValid(true);
        setSession({ workingDirectory: dir });
        const newHistory = [dir, ...webDirHistory.filter((d) => d !== dir)].slice(0, MAX_DIR_HISTORY);
        setWebDirHistory(newHistory);
        saveWebDirHistory(dir, webDirHistory);
        setShowDirHistory(false);
      } else {
        setWebDirValid(false);
      }
    } catch {
      setWebDirValid(false);
    }
  }, [webDirInput, webDirHistory, setSession]);

  // ── Textarea 自适应高度 ──────────────────────────────────────────────────
  const handleTaskInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setTaskDescription(value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.max(120, e.target.scrollHeight)}px`;

    // 检测 @ 触发器
    const pos = e.target.selectionStart ?? value.length;
    const textBefore = value.slice(0, pos);
    const atMatch = textBefore.match(/@([^\s@]*)$/);
    if (atMatch) {
      setAtQuery(atMatch[1]);
      setAtStart(pos - atMatch[0].length);
    } else {
      setAtQuery(null);
    }
  }, []);

  // ── @文件选中：替换当前 @ 片段 ──────────────────────────────────────────
  const handleFileSelect = useCallback((relativePath: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const pos = textarea.selectionStart ?? taskDescription.length;
    // 找到 @ 触发位置，替换为 @relativePath（保留 @ 符号）
    const before = taskDescription.slice(0, atStart);
    const after  = taskDescription.slice(pos);
    const inserted = `@${relativePath}`;
    const newVal = before + inserted + after;
    setTaskDescription(newVal);
    setAtQuery(null);
    // 移动光标到插入内容之后
    setTimeout(() => {
      textarea.focus();
      const newPos = (before + inserted).length;
      textarea.setSelectionRange(newPos, newPos);
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(120, textarea.scrollHeight)}px`;
    }, 0);
  }, [taskDescription, atStart]);

  // ── 套用模板 ─────────────────────────────────────────────────────────────
  const applyTemplate = useCallback((t: Template) => {
    setTaskDescription(t.taskDescription);
    setPermissionMode(t.permissionMode);
    if (t.agentName) setAgentName(t.agentName);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.max(120, textareaRef.current.scrollHeight)}px`;
        textareaRef.current.focus();
      }
    }, 0);
  }, []);

  // ── 保存当前为模板 ────────────────────────────────────────────────────────
  const handleSaveTemplate = useCallback(() => {
    const name = saveTemplateName.trim();
    if (!name) return;
    const newTemplate: Template = {
      id: `custom-${Date.now()}`,
      name,
      taskDescription,
      permissionMode,
      agentName: agentName || undefined,
    };
    const updated = [...customTemplates, newTemplate].slice(-MAX_CUSTOM_TEMPLATES);
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    setShowSaveModal(false);
    setSaveTemplateName('');
  }, [saveTemplateName, taskDescription, permissionMode, agentName, customTemplates]);

  // ── 删除自定义模板 ────────────────────────────────────────────────────────
  const handleDeleteTemplate = useCallback((id: string) => {
    const updated = customTemplates.filter((t) => t.id !== id);
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
  }, [customTemplates]);

  // ── Skills 切换 ──────────────────────────────────────────────────────────
  const toggleSkill = useCallback((name: string) => {
    setSelectedSkills((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  }, []);

  // ── 构建 extraArgs ───────────────────────────────────────────────────────
  const buildExtraArgs = useCallback((): string[] => {
    const args: string[] = [];
    if (permissionMode !== 'default') {
      args.push('--permission-mode', permissionMode);
    }
    if (modelOverride.trim()) {
      args.push('--model', modelOverride.trim());
    }
    if (disallowedTools.trim()) {
      args.push('--disallowed-tools', disallowedTools.trim());
    }
    if (appendSystemPrompt.trim()) {
      args.push('--append-system-prompt', appendSystemPrompt.trim());
    }
    const budget = parseFloat(maxBudgetUsd);
    if (!isNaN(budget) && budget > 0) {
      args.push('--max-budget-usd', String(budget));
    }
    const turns = parseInt(maxTurns, 10);
    if (!isNaN(turns) && turns > 0) {
      args.push('--max-turns', String(turns));
    }
    const name = taskDescription.trim().slice(0, 20).replace(/\s+/g, ' ') || '新任务';
    args.push('--name', name);
    return args;
  }, [permissionMode, modelOverride, disallowedTools, appendSystemPrompt, maxBudgetUsd, maxTurns, taskDescription]);

  /**
   * 构建最终任务消息文本：
   *   1. Skills 前置（/skill1 /skill2）
   *   2. 任务描述主体
   *   3. @文件引用内容展开（<file path="...">...</file>）
   */
  const buildTaskMessage = useCallback(async (baseText: string, cwd: string): Promise<string> => {
    const parts: string[] = [];

    // 1. Skills 前置
    if (selectedSkills.length > 0) {
      parts.push(selectedSkills.map((s) => `/${s}`).join(' '));
      parts.push('');
    }

    // 2. 提取 @文件引用，展开为 <file> 标签
    const fileRefPattern = /@([^\s@\n]+)/g;
    const referencedFiles: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = fileRefPattern.exec(baseText)) !== null) {
      referencedFiles.push(match[1]);
    }

    parts.push(baseText);

    // 3. 读取并追加文件内容（安全：只允许相对路径）
    for (const ref of referencedFiles) {
      // 拒绝绝对路径（以 / 或 盘符:\ 开头）
      if (ref.startsWith('/') || /^[A-Za-z]:\\/.test(ref)) continue;
      try {
        const filePath = `${cwd}/${ref}`;
        const res = await window.electronAPI.readFile(filePath);
        if (res.success && res.content) {
          parts.push(`\n<file path="${ref}">\n${res.content}\n</file>`);
        }
      } catch { /* 忽略读取失败的文件 */ }
    }

    return parts.join('\n');
  }, [selectedSkills]);

  // ── 提交 ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const errs: Record<string, string> = {};
    if (!session.workingDirectory) errs.dir  = '请先选择项目目录';
    if (!taskDescription.trim())   errs.task = '请描述需要完成的任务';
    if (maxBudgetUsd.trim() && (isNaN(+maxBudgetUsd) || +maxBudgetUsd <= 0)) {
      errs.budget = '请输入正数金额';
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setIsSubmitting(true);

    const cwd = session.workingDirectory!;
    const taskText = await buildTaskMessage(taskDescription.trim(), cwd);

    addMessage({
      id: `msg-${Date.now()}`,
      role: 'user',
      content: taskDescription.trim(), // store 中只存原始文本
      timestamp: Date.now(),
    });

    if (activeTabId) {
      const currentTab = tabs.find((t) => t.id === activeTabId);
      if (currentTab && /^会话\s+\d+$/.test(currentTab.label)) {
        renameTab(activeTabId, taskDescription.trim().slice(0, 20) || '新任务');
      }
    }

    const extraArgs = buildExtraArgs();
    try {
      const result = await window.electronAPI.cliSendMessage(
        taskText,
        cwd,
        undefined,
        [],
        agentName || undefined,
        activeTabId || 'default',
        extraArgs,
      );
      if (!result.success) {
        setErrors({ submit: result.error || '启动失败，请检查设置后重试' });
        setIsSubmitting(false);
        return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '启动失败，请检查设置后重试';
      setErrors({ submit: msg });
      setIsSubmitting(false);
      return;
    }


    onLaunched?.();
    // 不需要 setIsSubmitting(false)：父组件会卸载此面板并渲染 TaskView
  }, [session.workingDirectory, taskDescription, maxBudgetUsd, addMessage, activeTabId, tabs, renameTab, buildExtraArgs, buildTaskMessage, agentName, onLaunched]);

  // ── 键盘快捷键：Ctrl+Enter 提交 ──────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSubmit();
    }
  }, [handleSubmit]);

  // ── 派生状态 ─────────────────────────────────────────────────────────────
  const canSubmit = !!session.workingDirectory && !!taskDescription.trim() && !isSubmitting;
  const workspaceLabel = session.workingDirectory || '（未选择项目目录）';
  const activeMode = PERMISSION_MODES.find((m) => m.value === permissionMode);

  // ── 渲染 ─────────────────────────────────────────────────────────────────
  return (
    <div className="launch-panel">
      <div className="lp-header">
        <Zap size={16} className="lp-header-icon" />
        <span className="lp-header-title">委派新任务</span>
      </div>

      {/* ── 工作目录 ── */}
      <div className="lp-field">
        <label className="lp-label">
          <FolderOpen size={12} />
          工作目录
        </label>

        {webMode ? (
          /* Web 模式：手动输入路径 */
          <div className="lp-web-dir-group">
            <div className="lp-web-dir-row">
              <input
                ref={webDirRef}
                className={`lp-input lp-web-dir-input${webDirValid === false ? ' lp-field--error' : ''}`}
                placeholder="/path/to/project 或 ~/project"
                value={webDirInput}
                onChange={(e) => { setWebDirInput(e.target.value); setWebDirValid(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleWebDirConfirm(); }}
                onFocus={() => setShowDirHistory(webDirHistory.length > 0)}
                onBlur={() => setTimeout(() => setShowDirHistory(false), 150)}
              />
              <button
                type="button"
                className={`lp-btn lp-btn--outline${webDirValid === true ? ' lp-btn--ok' : ''}`}
                onClick={() => void handleWebDirConfirm()}
              >
                {webDirValid === true ? <Check size={13} /> : '确认'}
              </button>
            </div>
            {webDirValid === false && (
              <span className="lp-err">路径不存在或无法访问，请检查输入</span>
            )}
            {showDirHistory && webDirHistory.length > 0 && (
              <ul className="lp-dir-history">
                {webDirHistory.map((d) => (
                  <li
                    key={d}
                    className="lp-dir-history-item"
                    onMouseDown={() => {
                      setWebDirInput(d);
                      setWebDirValid(null);
                      setShowDirHistory(false);
                    }}
                  >
                    {d}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          /* Electron 模式：对话框选择 */
          <div className={`lp-dir-row${errors.dir ? ' lp-field--error' : ''}`}>
            <span className="lp-dir-path" title={workspaceLabel}>{workspaceLabel}</span>
            <button className="lp-btn lp-btn--outline" onClick={handlePickDir} type="button">
              更换目录
            </button>
          </div>
        )}
        {errors.dir && !webMode && <span className="lp-err">{errors.dir}</span>}
      </div>

      <div className="lp-divider" />

      {/* ── 任务描述 ── */}
      <div className="lp-field">
        <label className="lp-label">
          任务描述
          <span className="lp-required"> *</span>
        </label>
        <div className="lp-textarea-wrap">
          <textarea
            ref={textareaRef}
            className={`lp-textarea${errors.task ? ' lp-field--error' : ''}`}
            placeholder={`描述你想要完成的任务…\n\n用 @src/file.ts 引用上下文文件，用 /skill名 激活 Skill`}
            value={taskDescription}
            onChange={handleTaskInput}
            onKeyDown={handleKeyDown}
            rows={5}
          />
          {/* @文件引用自动补全弹窗 */}
          {atQuery !== null && session.workingDirectory && (
            <FileSearchDropdown
              cwd={session.workingDirectory}
              query={atQuery}
              onSelect={handleFileSelect}
              onClose={() => setAtQuery(null)}
              anchorRef={textareaRef}
            />
          )}
        </div>
        {errors.task && <span className="lp-err">{errors.task}</span>}
        <span className="lp-hint">Ctrl+Enter 快速启动 · 输入 @ 引用文件</span>
      </div>

      <div className="lp-divider" />

      {/* ── 执行模式 ── */}
      <div className="lp-field">
        <label className="lp-label">执行模式</label>
        <div className="lp-mode-group">
          {PERMISSION_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              className={[
                'lp-mode-btn',
                permissionMode === m.value ? 'lp-mode-btn--active' : '',
                m.danger ? 'lp-mode-btn--danger' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setPermissionMode(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
        {activeMode && <span className="lp-hint">{activeMode.desc}</span>}
      </div>

      {/* ── Agent ── */}
      {agents.length > 0 && (
        <div className="lp-field lp-field--inline">
          <label className="lp-label">Agent（可选）</label>
          <select
            className="lp-select"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
          >
            <option value="">无（使用默认 Claude）</option>
            {agents.map((a) => (
              <option key={a.name} value={a.name}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── 高级选项 ── */}
      <button
        type="button"
        className="lp-advanced-toggle"
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        高级选项
      </button>

      {showAdvanced && (
        <div className="lp-advanced">
          {/* Skills 注入 */}
          {availableSkills.length > 0 && (
            <div className="lp-field">
              <label className="lp-label">Skills 注入</label>
              <div className="lp-skills-group">
                {availableSkills.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    className={`lp-skill-tag${selectedSkills.includes(s.name) ? ' lp-skill-tag--active' : ''}`}
                    onClick={() => toggleSkill(s.name)}
                    title={s.source === 'local' ? '局部 Skill' : '全局 Skill'}
                  >
                    {selectedSkills.includes(s.name) ? <Check size={10} /> : null}
                    {s.name}
                    {s.source === 'local' && <span className="lp-skill-local">LOCAL</span>}
                  </button>
                ))}
              </div>
              <span className="lp-hint">选中的 Skill 会以 /skill-name 形式前置到任务消息</span>
            </div>
          )}

          <div className="lp-field lp-field--inline">
            <label className="lp-label">模型覆盖（留空继承全局设置）</label>
            <input
              className="lp-input"
              placeholder="如 claude-opus-4-5"
              value={modelOverride}
              onChange={(e) => setModelOverride(e.target.value)}
            />
          </div>

          <div className="lp-field-row">
            <div className="lp-field lp-field--inline">
              <label className="lp-label">成本上限（USD）</label>
              <input
                className="lp-input lp-input--short"
                type="number"
                min="0"
                step="0.5"
                placeholder="无限制"
                value={maxBudgetUsd}
                onChange={(e) => setMaxBudgetUsd(e.target.value)}
              />
              {errors.budget && <span className="lp-err">{errors.budget}</span>}
            </div>
            <div className="lp-field lp-field--inline">
              <label className="lp-label">最大轮次</label>
              <input
                className="lp-input lp-input--short"
                type="number"
                min="1"
                step="1"
                placeholder="无限制"
                value={maxTurns}
                onChange={(e) => setMaxTurns(e.target.value)}
              />
            </div>
          </div>

          <div className="lp-field">
            <label className="lp-label">禁止工具（逗号分隔）</label>
            <input
              className="lp-input"
              placeholder="如 Bash, Write"
              value={disallowedTools}
              onChange={(e) => setDisallowedTools(e.target.value)}
            />
          </div>

          <div className="lp-field">
            <label className="lp-label">附加系统提示词</label>
            <textarea
              className="lp-textarea lp-textarea--sm"
              placeholder="追加到默认系统提示词末尾…"
              rows={3}
              value={appendSystemPrompt}
              onChange={(e) => setAppendSystemPrompt(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ── 提交 ── */}
      <div className="lp-footer">
        {errors.submit && (
          <span className="lp-err lp-err--block">
            <AlertTriangle size={12} />
            {errors.submit}
          </span>
        )}
        <button
          type="button"
          className="lp-btn lp-btn--primary"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
        >
          <Zap size={14} />
          {isSubmitting ? '启动中…' : '启动任务'}
        </button>
      </div>

      <div className="lp-divider" />

      {/* ── 快速模板 ── */}
      <div className="lp-templates-header">
        <span className="lp-section-title">快速模板</span>
        <button
          type="button"
          className="lp-btn lp-btn--ghost lp-save-template-btn"
          onClick={() => { setSaveTemplateName(''); setShowSaveModal(true); }}
          title="保存当前设置为模板"
        >
          <Save size={12} />
          保存当前
        </button>
      </div>

      <div className="lp-templates">
        {BUILTIN_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="lp-template-btn"
            onClick={() => applyTemplate(t)}
          >
            {t.name}
          </button>
        ))}
        {customTemplates.map((t) => (
          <div key={t.id} className="lp-template-custom">
            <button
              type="button"
              className="lp-template-btn lp-template-btn--custom"
              onClick={() => applyTemplate(t)}
            >
              {t.name}
            </button>
            <button
              type="button"
              className="lp-template-delete"
              onClick={() => handleDeleteTemplate(t.id)}
              aria-label="删除模板"
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>

      {/* ── 保存模板 Modal ── */}
      {showSaveModal && (
        <div className="lp-modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="lp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lp-modal-title">保存为模板</div>
            <input
              className="lp-input"
              placeholder="模板名称"
              autoFocus
              value={saveTemplateName}
              onChange={(e) => setSaveTemplateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTemplate(); if (e.key === 'Escape') setShowSaveModal(false); }}
            />
            <div className="lp-modal-actions">
              <button type="button" className="lp-btn lp-btn--outline" onClick={() => setShowSaveModal(false)}>取消</button>
              <button type="button" className="lp-btn lp-btn--primary" onClick={handleSaveTemplate} disabled={!saveTemplateName.trim()}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
