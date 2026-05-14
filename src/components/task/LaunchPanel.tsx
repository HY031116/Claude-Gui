/**
 * LaunchPanel — 委派表单（Dispatch 视图 [A] 态）
 *
 * 显示条件：session.isConnected=false AND messages.length=0
 * 提交后：调用 cliSendMessage（non-interactive 模式），切换到 TaskView [B] 态
 *
 * 功能：
 *   - 任务描述（支持 @file、/skill 语法提示）
 *   - 执行模式（4 选项 → --permission-mode）
 *   - Agent 下拉（从 listAgents 加载）
 *   - 工作目录选择器
 *   - 高级选项：模型覆盖、成本上限、最大轮次、禁止工具、附加系统提示词
 *   - 快速模板（4 内置 + localStorage 自定义）
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Zap, FolderOpen, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

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

  // ── 远程数据 ────────────────────────────────────────────────────────────
  const [agents, setAgents] = useState<Array<{ name: string; model: string }>>([]);

  useEffect(() => {
    window.electronAPI?.listAgents()
      .then((res) => { if (res.success && res.agents) setAgents(res.agents); })
      .catch(() => {});
  }, []);

  // ── Refs ────────────────────────────────────────────────────────────────
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── 工作目录选择 ─────────────────────────────────────────────────────────
  const handlePickDir = useCallback(async () => {
    const res = await window.electronAPI.selectDirectory(session.workingDirectory || undefined);
    if (res.success && res.path) {
      setSession({ workingDirectory: res.path });
    }
  }, [session.workingDirectory, setSession]);

  // ── Textarea 自适应高度 ──────────────────────────────────────────────────
  const handleTaskInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTaskDescription(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.max(120, e.target.scrollHeight)}px`;
  }, []);

  // ── 套用模板 ─────────────────────────────────────────────────────────────
  const applyTemplate = useCallback((t: Template) => {
    setTaskDescription(t.taskDescription);
    setPermissionMode(t.permissionMode);
    if (t.agentName) setAgentName(t.agentName);
    // 触发高度重算
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.max(120, textareaRef.current.scrollHeight)}px`;
        textareaRef.current.focus();
      }
    }, 0);
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
    // 会话自动命名
    const name = taskDescription.trim().slice(0, 20).replace(/\s+/g, ' ') || '新任务';
    args.push('--name', name);
    return args;
  }, [permissionMode, modelOverride, disallowedTools, appendSystemPrompt, maxBudgetUsd, maxTurns, taskDescription]);

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

    // 1. 将用户消息写入 store（使 messages.length > 0 → 切换到 TaskView）
    const taskText = taskDescription.trim();
    addMessage({
      id: `msg-${Date.now()}`,
      role: 'user',
      content: taskText,
      timestamp: Date.now(),
    });

    // 2. 自动重命名当前 tab（若仍是默认名称）
    if (activeTabId) {
      const currentTab = tabs.find((t) => t.id === activeTabId);
      if (currentTab && /^会话\s+\d+$/.test(currentTab.label)) {
        renameTab(activeTabId, taskText.slice(0, 20) || '新任务');
      }
    }

    // 3. 构建 CLI 参数并发送消息（非交互模式）
    const extraArgs = buildExtraArgs();
    try {
      const result = await window.electronAPI.cliSendMessage(
        taskText,
        session.workingDirectory || undefined,
        undefined,          // sessionId：新会话
        [],                 // 无图片
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
  }, [session.workingDirectory, taskDescription, maxBudgetUsd, addMessage, activeTabId, tabs, renameTab, buildExtraArgs, agentName, onLaunched]);

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
        <div className={`lp-dir-row${errors.dir ? ' lp-field--error' : ''}`}>
          <span className="lp-dir-path" title={workspaceLabel}>{workspaceLabel}</span>
          <button className="lp-btn lp-btn--outline" onClick={handlePickDir} type="button">
            更换目录
          </button>
        </div>
        {errors.dir && <span className="lp-err">{errors.dir}</span>}
      </div>

      <div className="lp-divider" />

      {/* ── 任务描述 ── */}
      <div className="lp-field">
        <label className="lp-label">
          任务描述
          <span className="lp-required"> *</span>
        </label>
        <textarea
          ref={textareaRef}
          className={`lp-textarea${errors.task ? ' lp-field--error' : ''}`}
          placeholder={`描述你想要完成的任务…\n\n用 @src/file.ts 引用上下文文件，用 /skill名 激活 Skill`}
          value={taskDescription}
          onChange={handleTaskInput}
          onKeyDown={handleKeyDown}
          rows={5}
        />
        {errors.task && <span className="lp-err">{errors.task}</span>}
        <span className="lp-hint">Ctrl+Enter 快速启动</span>
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
      <div className="lp-section-title">快速模板</div>
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
      </div>
    </div>
  );
}
