/**
 * PlanReviewPanel — 3.4 Plan Mode 审查视图
 *
 * 当 Claude 在 Plan Mode 下生成计划时，展示可交互的步骤列表：
 *   - 每个步骤可勾选/取消
 *   - 风险等级色彩标注（低=绿 / 中=橙 / 高=红）
 *   - 高风险步骤默认取消勾选
 *   - 底部操作：取消高风险 / 全选 / 编辑计划 / 确认执行
 *   - 确认时通过消息注入协议跳过未勾选步骤
 */
import { useState, useCallback, useMemo } from 'react';
import type { ReviewablePlanStep, PlanRiskLevel } from '../types';
import { useAppStore } from '../stores/useAppStore';

// ── 解析逻辑 ────────────────────────────────────────────────────────────────

function inferToolType(text: string): string {
  const t = text.toLowerCase();
  if (/\b(run|execute|npm|pip|bash|shell|install|build|test)\b/.test(t)) return 'Bash';
  if (/\b(read|analyze|search|grep|find|list|ls|look)\b/.test(t)) return 'Read';
  if (/\b(modify|edit|update|refactor|change|fix)\b/.test(t)) return 'Edit';
  if (/\b(create|write|generate|add new|new file)\b/.test(t)) return 'Write';
  if (/\b(delete|remove file|unlink)\b/.test(t)) return 'Delete';
  if (/\b(call api|http|fetch|curl|request)\b/.test(t)) return 'API';
  return 'Unknown';
}

function inferRiskLevel(toolType: string): PlanRiskLevel {
  if (['Bash', 'Delete', 'API'].includes(toolType)) return 'high';
  if (toolType === 'Edit' || toolType === 'Write') return 'medium';
  return 'low';
}

function getRiskReason(toolType: string, text: string): string | undefined {
  if (toolType === 'Bash') {
    if (/npm|yarn|pnpm/.test(text)) return '将修改 node_modules，影响项目依赖';
    if (/pip|conda/.test(text)) return '将修改 Python 环境依赖';
    return 'Shell 命令将在当前工作区执行，可能修改文件系统或安装依赖';
  }
  if (toolType === 'Delete') return '文件删除操作不可撤销，请确认目标路径正确';
  if (toolType === 'API') return '将向外部服务发送请求，可能产生费用或副作用';
  return undefined;
}

function extractTarget(text: string): string | undefined {
  // 反引号内容
  const backtick = text.match(/`([^`]+)`/);
  if (backtick) return backtick[1];
  // 文件路径（src/ 开头或含 . 后缀）
  const path = text.match(/\b([\w./\\-]+\.\w{1,6})\b/);
  if (path) return path[1];
  return undefined;
}

export function parsePlanSteps(rawText: string): ReviewablePlanStep[] {
  const lines = rawText
    .split('\n')
    .filter((line) => /^\d+[.)]\s/.test(line.trim()));

  if (lines.length === 0) {
    // 降级：整体作为一个 Unknown 步骤
    const trimmed = rawText.trim();
    if (!trimmed) return [];
    return [{
      id: 'plan-step-0',
      index: 1,
      rawText: trimmed,
      toolType: 'Unknown',
      riskLevel: 'low',
      target: undefined,
      checked: true,
      status: 'waiting',
    }];
  }

  return lines.map((line, idx) => {
    const text = line.replace(/^\d+[.)]\s*/, '').trim();
    const toolType = inferToolType(text);
    const riskLevel = inferRiskLevel(toolType);
    return {
      id: `plan-step-${idx}`,
      index: idx + 1,
      rawText: text,
      toolType,
      riskLevel,
      riskReason: getRiskReason(toolType, text),
      target: extractTarget(text),
      checked: riskLevel !== 'high', // 高风险默认不勾选
      status: 'waiting',
    } satisfies ReviewablePlanStep;
  });
}

export function buildSkipMessage(
  steps: ReviewablePlanStep[],
  checkedIds: string[],
): string {
  const skipped = steps.filter((s) => !checkedIds.includes(s.id));
  if (skipped.length === 0) return '';
  const skipLines = skipped.map((s) => `- Step ${s.index}: ${s.rawText}`).join('\n');
  return (
    `[GUI INSTRUCTION] Please execute the plan, but SKIP the following steps:\n` +
    skipLines +
    `\n\nFor skipped steps, treat them as if they were completed successfully and continue with the remaining steps.`
  );
}

// ── 子组件：步骤卡片 ────────────────────────────────────────────────────────

const RISK_COLORS: Record<PlanRiskLevel, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
};

const RISK_LABELS: Record<PlanRiskLevel, string> = {
  low: '● 低风险',
  medium: '⚠ 中风险',
  high: '🔴 高风险',
};

const TOOL_ICONS: Record<string, string> = {
  Bash: '⚙',
  Read: '👁',
  Edit: '✏',
  Write: '📄',
  Delete: '🗑',
  API: '🌐',
  Unknown: '•',
};

/** 每种工具类型对应的操作建议 */
const TOOL_SUGGESTIONS: Record<string, string> = {
  Bash: '执行前确认命令无副作用。若仅验证逻辑，可暂时跳过此步骤。',
  Delete: '删除操作不可撤销，确认目标路径正确后再启用此步骤。',
  API: '将向外部服务发送请求，可能产生费用或改变远程状态，请谨慎确认。',
  Edit: '编辑操作可通过 Checkpoint 回滚，建议执行后检查 diff。',
  Write: '将新建文件，请确认路径与内容符合预期。',
  Read: '只读操作，无副作用，可安全执行。',
  Unknown: '请仔细阅读步骤描述，确认操作安全后勾选。',
};

/** 从原始文本中提取可能的完整命令（反引号或常见 CLI 前缀） */
function extractCommand(rawText: string): string | undefined {
  // 反引号包裹的内容优先
  const backtick = rawText.match(/`([^`]+)`/);
  if (backtick) return backtick[1];
  // npm / pip / yarn / pnpm / bash / sh / python 等开头的命令片段
  const cliMatch = rawText.match(/\b(npm|yarn|pnpm|pip|python|bash|sh|node|git|cargo|go)\s+[\w\s\-./]+/);
  if (cliMatch) return cliMatch[0].trim();
  return undefined;
}

interface StepCardProps {
  step: ReviewablePlanStep;
  onToggle: (id: string) => void;
  /** 当前会话工作目录，用于在展开详情中显示执行目录 */
  workingDirectory?: string;
}

function StepCard({ step, onToggle, workingDirectory }: StepCardProps) {
  const [expanded, setExpanded] = useState(false);
  const color = RISK_COLORS[step.riskLevel];
  const command = step.toolType === 'Bash' ? extractCommand(step.rawText) : step.target;

  return (
    <div
      style={{
        border: `1px solid ${step.checked ? color + '40' : 'var(--border-color)'}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        padding: '10px 12px',
        background: step.checked ? `${color}08` : 'var(--bg-secondary)',
        opacity: step.checked ? 1 : 0.65,
        transition: 'all 0.15s',
        cursor: 'pointer',
      }}
      onClick={() => onToggle(step.id)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* 勾选框 */}
        <input
          type="checkbox"
          checked={step.checked}
          onChange={() => onToggle(step.id)}
          onClick={(e) => e.stopPropagation()}
          style={{ marginTop: 2, flexShrink: 0, cursor: 'pointer', accentColor: color }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 标题行 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color, fontWeight: 600 }}>
              步骤 {step.index}  {RISK_LABELS[step.riskLevel]}
            </span>
          </div>

          {/* 工具类型 + 目标 */}
          <div style={{ marginTop: 4, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
            {TOOL_ICONS[step.toolType] ?? '•'} {step.toolType}
            {step.target && (
              <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                {' · '}
                <code style={{ fontSize: 12, background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 3 }}>
                  {step.target}
                </code>
              </span>
            )}
          </div>

          {/* 原始描述 */}
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {step.rawText}
          </div>

          {/* 展开详情按钮（所有步骤均可展开） */}
          <div style={{ marginTop: 6 }}>
            <button
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: 11,
                color: color,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            >
              {expanded ? '▾ 收起详情' : '▸ 展开详情'}
            </button>

            {expanded && (
              <div
                style={{
                  marginTop: 6,
                  padding: '8px 10px',
                  background: `${color}10`,
                  border: `1px solid ${color}25`,
                  borderRadius: 4,
                  fontSize: 12,
                  lineHeight: 1.7,
                  display: 'grid',
                  gridTemplateColumns: '72px 1fr',
                  gap: '2px 8px',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* 完整命令（Bash 显示命令，其他显示目标） */}
                {command && (
                  <>
                    <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>完整命令</span>
                    <code style={{ background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 3, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                      {command}
                    </code>
                  </>
                )}
                {/* 执行目录 */}
                {workingDirectory && (
                  <>
                    <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>执行目录</span>
                    <code style={{ background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 3, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                      {workingDirectory}
                    </code>
                  </>
                )}
                {/* 推断影响 */}
                {step.riskReason && (
                  <>
                    <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>推断影响</span>
                    <span style={{ color }}>⚠ {step.riskReason}</span>
                  </>
                )}
                {/* 操作建议 */}
                <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>建议</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {TOOL_SUGGESTIONS[step.toolType] ?? TOOL_SUGGESTIONS['Unknown']}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 编辑计划 Modal ────────────────────────────────────────────────────────────

interface EditPlanModalProps {
  rawPlanText: string;
  onSave: (newText: string) => void;
  onClose: () => void;
}

function EditPlanModal({ rawPlanText, onSave, onClose }: EditPlanModalProps) {
  const [text, setText] = useState(rawPlanText);
  // 实时预览将被解析的步骤数
  const previewCount = useMemo(() => parsePlanSteps(text).length, [text]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          width: '60vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 600, fontSize: 14 }}>
          ✏ 调整执行计划
        </div>
        <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
          每行编号列表条目（"1. " / "2. " 开头）会被解析为独立步骤。          {previewCount > 0 && (
            <span style={{ marginLeft: 8, color: 'var(--accent-color)', fontWeight: 500 }}>
              当前可解析 {previewCount} 个步骤
            </span>
          )}        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{
            flex: 1,
            resize: 'none',
            border: 'none',
            padding: '12px 16px',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontFamily: 'monospace',
            outline: 'none',
            minHeight: 240,
          }}
        />
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}
            onClick={onClose}
          >
            取消
          </button>
          <button
            style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            onClick={() => onSave(text)}
          >
            保存并重新解析{previewCount > 0 ? `（${previewCount} 步骤）` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 主组件 ───────────────────────────────────────────────────────────────────

interface PlanReviewPanelProps {
  onConfirm: (skipMessage: string) => void;
  onCancel: () => void;
}

export function PlanReviewPanel({ onConfirm, onCancel }: PlanReviewPanelProps) {
  const planReview = useAppStore((s) => s.planReview);
  const setPlanReview = useAppStore((s) => s.setPlanReview);
  const workingDirectory = useAppStore((s) => s.session.workingDirectory);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  // 风险分布表显隐（有高风险步骤时默认展开）
  const [showRiskTable, setShowRiskTable] = useState(true);

  const { phase, rawPlanText, parsedSteps } = planReview;

  // ── 步骤 toggle ──────────────────────────────────────────────────────────

  const toggleStep = useCallback((id: string) => {
    setPlanReview({
      parsedSteps: parsedSteps.map((s) =>
        s.id === id ? { ...s, checked: !s.checked } : s
      ),
    });
  }, [parsedSteps, setPlanReview]);

  const selectAll = useCallback(() => {
    setPlanReview({ parsedSteps: parsedSteps.map((s) => ({ ...s, checked: true })) });
  }, [parsedSteps, setPlanReview]);

  const deselectHighRisk = useCallback(() => {
    setPlanReview({ parsedSteps: parsedSteps.map((s) => ({ ...s, checked: s.riskLevel !== 'high' })) });
  }, [parsedSteps, setPlanReview]);

  const resetDefaults = useCallback(() => {
    setPlanReview({ parsedSteps: parsedSteps.map((s) => ({ ...s, checked: s.riskLevel !== 'high' })) });
  }, [parsedSteps, setPlanReview]);

  // ── 编辑计划 ─────────────────────────────────────────────────────────────

  const handleSaveEdit = useCallback((newText: string) => {
    const newSteps = parsePlanSteps(newText);
    setPlanReview({ rawPlanText: newText, parsedSteps: newSteps });
    setShowEditModal(false);
  }, [setPlanReview]);

  // ── 确认执行 ─────────────────────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    const checkedIds = parsedSteps.filter((s) => s.checked).map((s) => s.id);
    const skipMsg = buildSkipMessage(parsedSteps, checkedIds);
    setPlanReview({ phase: 'executing', confirmedAt: Date.now() });
    onConfirm(skipMsg);
  }, [parsedSteps, setPlanReview, onConfirm]);

  // ── 统计 ─────────────────────────────────────────────────────────────────

  const checkedCount = parsedSteps.filter((s) => s.checked).length;
  const totalCount = parsedSteps.length;
  const riskCounts = {
    low: parsedSteps.filter((s) => s.riskLevel === 'low').length,
    medium: parsedSteps.filter((s) => s.riskLevel === 'medium').length,
    high: parsedSteps.filter((s) => s.riskLevel === 'high').length,
  };
  const hasHighRisk = riskCounts.high > 0;

  // ── 生成中状态 ───────────────────────────────────────────────────────────

  if (phase === 'generating_plan') {
    return (
      <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 14 }}>
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
          Claude 正在生成执行计划…
        </div>
        {rawPlanText && (
          <pre style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
            {rawPlanText}
          </pre>
        )}
      </div>
    );
  }

  // ── 执行中状态 ───────────────────────────────────────────────────────────

  if (phase === 'executing') {
    const done = parsedSteps.filter((s) => s.status === 'done').length;
    const running = parsedSteps.find((s) => s.status === 'running');
    const executingCount = parsedSteps.filter((s) => s.checked).length;
    const progressPct = executingCount > 0 ? Math.round((done / executingCount) * 100) : 0;

    return (
      <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            🔴 Plan Mode: ON — 执行中
          </span>
        </div>
        {/* 进度条 */}
        <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--accent-color)', width: `${progressPct}%`, transition: 'width 0.3s', borderRadius: 3 }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
          {done} / {executingCount} 步骤完成
          {running && ` · 执行中：${running.rawText.slice(0, 40)}…`}
        </div>
        {parsedSteps.map((step) => {
          let icon = '○';
          let color = 'var(--text-secondary)';
          let decoration = 'none';
          if (step.status === 'done') { icon = '✓'; color = '#22c55e'; }
          else if (step.status === 'running') { icon = '⟳'; color = 'var(--accent-color)'; }
          else if (step.status === 'skipped' || !step.checked) { icon = '─'; color = 'var(--text-muted)'; decoration = 'line-through'; }
          else if (step.status === 'error') { icon = '✗'; color = '#ef4444'; }

          return (
            <div key={step.id} style={{ display: 'flex', gap: 10, fontSize: 13, marginBottom: 6, color, textDecoration: decoration }}>
              <span style={{ flexShrink: 0, fontFamily: 'monospace' }}>{icon}</span>
              <span>步骤 {step.index}  {step.toolType} · {step.target ?? step.rawText.slice(0, 40)}</span>
              {step.status === 'done' && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#22c55e44' }}>完成</span>}
              {(step.status === 'skipped' || !step.checked) && <span style={{ marginLeft: 'auto', fontSize: 11 }}>[已跳过]</span>}
            </div>
          );
        })}
      </div>
    );
  }

  // ── 计划就绪（主审查视图）────────────────────────────────────────────────

  return (
    <>
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 8,
        border: '1px solid #ef444430',
        overflow: 'hidden',
      }}>
        {/* 顶部工具栏 */}
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          background: 'var(--bg-primary)',
        }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#ef4444' }}>🔴 Plan Mode: ON</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>|</span>
          <button
            style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border-color)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}
            onClick={selectAll}
          >
            全选
          </button>
          {hasHighRisk && (
            <button
              style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid #ef444440', background: '#ef444415', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
              onClick={deselectHighRisk}
            >
              取消高风险
            </button>
          )}
          <button
            style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border-color)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}
            onClick={resetDefaults}
          >
            重置默认
          </button>
          <button
            style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border-color)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => setShowRiskTable((v) => !v)}
          >
            {/* 风险汇总徽章 */}
            {riskCounts.low > 0 && <span style={{ color: '#22c55e' }}>●{riskCounts.low}</span>}
            {riskCounts.medium > 0 && <span style={{ color: '#f59e0b' }}>⚠{riskCounts.medium}</span>}
            {riskCounts.high > 0 && <span style={{ color: '#ef4444' }}>🔴{riskCounts.high}</span>}
            <span style={{ marginLeft: 2 }}>{showRiskTable ? '▴' : '▾'}</span>
          </button>
        </div>

        {/* 风险等级分布表（可折叠） */}
        {showRiskTable && parsedSteps.length > 0 && (
          <div style={{
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
            padding: '8px 14px',
            display: 'grid',
            gridTemplateColumns: '90px 40px 1fr',
            gap: '4px 8px',
            fontSize: 12,
          }}>
            {/* 表头 */}
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>风险等级</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>数量</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>涉及步骤</span>
            {/* 低风险行 */}
            {riskCounts.low > 0 && (
              <>
                <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>●</span> 低风险
                </span>
                <span style={{ color: '#22c55e', fontVariantNumeric: 'tabular-nums' }}>{riskCounts.low}</span>
                <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                  {parsedSteps.filter((s) => s.riskLevel === 'low').map((s) => `#${s.index}`).join('  ')}
                </span>
              </>
            )}
            {/* 中风险行 */}
            {riskCounts.medium > 0 && (
              <>
                <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>⚠</span> 中风险
                </span>
                <span style={{ color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>{riskCounts.medium}</span>
                <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                  {parsedSteps.filter((s) => s.riskLevel === 'medium').map((s) => `#${s.index} ${s.toolType}`).join('  ·  ')}
                </span>
              </>
            )}
            {/* 高风险行 */}
            {riskCounts.high > 0 && (
              <>
                <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>🔴</span> 高风险
                </span>
                <span style={{ color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>{riskCounts.high}</span>
                <span style={{ color: '#ef4444', wordBreak: 'break-all' }}>
                  {parsedSteps.filter((s) => s.riskLevel === 'high').map((s) => `#${s.index} ${s.target ?? s.toolType}`).join('  ·  ')}
                </span>
              </>
            )}
          </div>
        )}

        {/* 步骤列表 */}
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
          {parsedSteps.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              计划尚未生成或解析失败
            </div>
          ) : (
            parsedSteps.map((step) => (
              <StepCard key={step.id} step={step} onToggle={toggleStep} workingDirectory={workingDirectory} />
            ))
          )}
        </div>

        {/* 底部操作栏 */}
        <div style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          background: 'var(--bg-primary)',
          flexWrap: 'wrap',
        }}>
          <button
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}
            onClick={() => setShowEditModal(true)}
          >
            ✏ 在编辑器中调整计划
          </button>
          <button
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ef444440', background: '#ef444415', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
            onClick={() => setShowCancelConfirm(true)}
          >
            取消计划
          </button>
          <button
            disabled={checkedCount === 0}
            style={{
              marginLeft: 'auto',
              padding: '6px 16px',
              borderRadius: 6,
              border: 'none',
              background: checkedCount > 0 ? 'var(--accent-color)' : 'var(--bg-tertiary)',
              color: checkedCount > 0 ? '#fff' : 'var(--text-muted)',
              cursor: checkedCount > 0 ? 'pointer' : 'not-allowed',
              fontSize: 13,
              fontWeight: 600,
            }}
            onClick={handleConfirm}
          >
            ✅ 确认执行选中步骤 ({checkedCount}/{totalCount})
          </button>
        </div>
      </div>

      {/* 取消确认 */}
      {showCancelConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={() => setShowCancelConfirm(false)}
        >
          <div
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 24, maxWidth: 360, width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>确认取消计划？</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Claude 将收到取消指令，当前计划不会执行。
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'none', cursor: 'pointer', fontSize: 13 }}
                onClick={() => setShowCancelConfirm(false)}
              >
                返回
              </button>
              <button
                style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                onClick={() => { setShowCancelConfirm(false); onCancel(); }}
              >
                确认取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑计划 Modal */}
      {showEditModal && (
        <EditPlanModal
          rawPlanText={rawPlanText}
          onSave={handleSaveEdit}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </>
  );
}
