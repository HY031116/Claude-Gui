/**
 * 变更文件汇总面板
 * 从当前会话的所有消息中扫描 Write/Edit/MultiEdit 工具调用，
 * 展示每个文件的变更次数、操作类型及可展开的 Diff 预览
 */
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { FileText, ChevronDown, ChevronRight, Edit3, FilePlus, Layers, CheckCheck, RotateCcw, GitCommit, ExternalLink } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import type { ToolCall } from '../types';
import { DiffViewer, WritePreview, WriteDiff } from './DiffView';

const FILE_MODIFY_TOOLS = [
  'Write', 'write_file', 'Edit', 'edit_file',
  'str_replace_editor', 'MultiEdit', 'multiedit', 'str_replace_based_edit_tool',
];

/** 文件修改工具调用的轻量记录（含所属消息 ID） */
interface TrackedChange {
  msgId: string;
  toolCallId: string;
  filePath: string;
  originalContent?: string;
  diffReviewStatus?: 'accepted' | 'reverted';
}

type ChangeType = 'write' | 'edit' | 'multi_edit';

interface FileChange {
  filePath: string;
  changeType: ChangeType;
  toolCall: ToolCall;
}

interface FileSummary {
  filePath: string;
  displayName: string;
  changes: FileChange[];
}

const CHANGE_ICONS: Record<ChangeType, React.ReactNode> = {
  write: <FilePlus size={12} />,
  edit: <Edit3 size={12} />,
  multi_edit: <Layers size={12} />,
};

const CHANGE_COLORS: Record<ChangeType, string> = {
  write: 'var(--accent-success, #22c55e)',
  edit: 'var(--accent-warning, #f59e0b)',
  multi_edit: 'var(--accent-info, #3b82f6)',
};

const CHANGE_LABELS: Record<ChangeType, string> = {
  write: '写入',
  edit: '编辑',
  multi_edit: '批量编辑',
};

function getFileChanges(toolCalls: ToolCall[]): FileChange[] {
  const changes: FileChange[] = [];
  for (const tc of toolCalls) {
    const args = tc.arguments ?? {};
    if (tc.name === 'Write' || tc.name === 'write_file') {
      const fp = (args.file_path ?? args.path ?? args.filename ?? '') as string;
      if (fp) changes.push({ filePath: fp, changeType: 'write', toolCall: tc });
    } else if (tc.name === 'Edit' || tc.name === 'edit_file' || tc.name === 'str_replace_editor') {
      const fp = (args.path ?? args.file_path ?? '') as string;
      if (fp) changes.push({ filePath: fp, changeType: 'edit', toolCall: tc });
    } else if (tc.name === 'MultiEdit' || tc.name === 'multi_edit') {
      const fp = (args.file_path ?? args.path ?? '') as string;
      if (fp) changes.push({ filePath: fp, changeType: 'multi_edit', toolCall: tc });
    }
  }
  return changes;
}

function summarizeByFile(allChanges: FileChange[]): FileSummary[] {
  const map = new Map<string, FileSummary>();
  for (const change of allChanges) {
    if (!map.has(change.filePath)) {
      const parts = change.filePath.replace(/\\/g, '/').split('/');
      map.set(change.filePath, {
        filePath: change.filePath,
        displayName: parts[parts.length - 1] ?? change.filePath,
        changes: [],
      });
    }
    map.get(change.filePath)!.changes.push(change);
  }
  return Array.from(map.values());
}

/** 单个工具调用的内联 diff 展示 */
function ChangeDetail({ change, originalContent, onLineClick }: {
  change: FileChange;
  originalContent?: string;
  onLineClick?: (lineNum: number) => void;
}) {
  const args = change.toolCall.arguments ?? {};
  if (change.changeType === 'write') {
    const content = (args.content ?? args.file_content ?? '') as string;
    const original = change.toolCall.originalContent;
    if (original !== undefined) return <WriteDiff originalContent={original} newContent={content} onLineClick={onLineClick} />;
    return <WritePreview content={content} />;
  }
  if (change.changeType === 'edit') {
    const oldStr = (args.old_string ?? args.old_content ?? '') as string;
    const newStr = (args.new_string ?? args.new_content ?? '') as string;
    // 从 originalContent 中计算 old_string 的起始行号（绝对行号）
    let startLine = 1;
    if (originalContent && oldStr) {
      const idx = originalContent.indexOf(oldStr);
      if (idx !== -1) startLine = originalContent.slice(0, idx).split('\n').length;
    }
    return <DiffViewer oldStr={oldStr} newStr={newStr} startLineOld={startLine} startLineNew={startLine} onLineClick={onLineClick} />;
  }
  if (change.changeType === 'multi_edit') {
    const edits = (args.edits ?? []) as Array<{ old_string: string; new_string: string }>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {edits.map((e, i) => {
          // 从 originalContent 中定位每段 old_string 的起始行号（与 edit 类型保持一致）
          let startLine = 1;
          if (originalContent && e.old_string) {
            const idx = originalContent.indexOf(e.old_string);
            if (idx !== -1) startLine = originalContent.slice(0, idx).split('\n').length;
          }
          return (
            <div key={i}>
              {edits.length > 1 && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 0', marginBottom: 2 }}>
                  段落 {i + 1}
                </div>
              )}
              <DiffViewer
                oldStr={e.old_string ?? ''}
                newStr={e.new_string ?? ''}
                startLineOld={startLine}
                startLineNew={startLine}
                onLineClick={onLineClick}
              />
            </div>
          );
        })}
      </div>
    );
  }
  return null;
}

export function ChangeSummaryPanel() {
  const messages = useAppStore((s) => s.messages);
  const updateMessage = useAppStore((s) => s.updateMessage);
  const activeChangeId = useAppStore((s) => s.activeChangeId);
  const setActiveChangeId = useAppStore((s) => s.setActiveChangeId);
  const setActiveNavSection = useAppStore((s) => s.setActiveNavSection);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());
  const [revertBusy, setRevertBusy] = useState(false);
  /** 高亮中的变更卡片 ID（fadeout 动画用） */
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /** 从所有消息中收集文件修改工具调用（含消息 ID） */
  const trackedChanges = useMemo((): TrackedChange[] => {
    const result: TrackedChange[] = [];
    for (const msg of messages) {
      for (const tc of (msg.toolCalls ?? [])) {
        if (!FILE_MODIFY_TOOLS.includes(tc.name)) continue;
        const args = tc.arguments ?? {};
        const fp = (args.file_path ?? args.path ?? args.filename ?? '') as string;
        if (!fp || tc.status !== 'success') continue;
        result.push({
          msgId: msg.id,
          toolCallId: tc.id,
          filePath: fp,
          originalContent: tc.originalContent,
          diffReviewStatus: tc.diffReviewStatus,
        });
      }
    }
    return result;
  }, [messages]);

  /** 从所有消息中收集工具调用（用于展示 diff） */
  const fileSummaries = useMemo(() => {
    const allToolCalls: ToolCall[] = [];
    for (const msg of messages) {
      if (msg.toolCalls?.length) allToolCalls.push(...msg.toolCalls);
    }
    const changes = getFileChanges(allToolCalls);
    return summarizeByFile(changes);
  }, [messages]);

  const pendingCount = trackedChanges.filter((c) => !c.diffReviewStatus).length;
  const acceptedCount = trackedChanges.filter((c) => c.diffReviewStatus === 'accepted').length;
  const revertedCount = trackedChanges.filter((c) => c.diffReviewStatus === 'reverted').length;

  /** 应用全部：将所有待确认的工具调用标记为 accepted */
  const handleAcceptAll = useCallback(() => {
    const toAccept = new Set(
      trackedChanges.filter((c) => !c.diffReviewStatus).map((c) => c.toolCallId)
    );
    if (toAccept.size === 0) return;
    const msgIds = new Set(
      trackedChanges.filter((c) => toAccept.has(c.toolCallId)).map((c) => c.msgId)
    );
    for (const msg of messages) {
      if (!msgIds.has(msg.id) || !msg.toolCalls) continue;
      updateMessage(msg.id, {
        toolCalls: msg.toolCalls.map((tc) =>
          toAccept.has(tc.id) ? { ...tc, diffReviewStatus: 'accepted' as const } : tc
        ),
      });
    }
  }, [trackedChanges, messages, updateMessage]);

  /** 撤销全部：对每个文件取最早的 originalContent 快照写回磁盘，然后标记所有相关调用为 reverted */
  const handleRevertAll = useCallback(async () => {
    if (revertBusy) return;
    setRevertBusy(true);
    try {
      // 每个文件路径只取最早一次原始快照
      const fileFirstOriginal = new Map<string, string>();
      for (const c of trackedChanges) {
        if (c.originalContent !== undefined && !fileFirstOriginal.has(c.filePath)) {
          fileFirstOriginal.set(c.filePath, c.originalContent);
        }
      }
      // 写回磁盘（并行）
      await Promise.all(
        Array.from(fileFirstOriginal.entries()).map(([fp, original]) =>
          window.electronAPI.writeFile(fp, original)
        )
      );
      // 标记所有相关调用为 reverted
      const toRevert = new Set(
        trackedChanges
          .filter((c) => fileFirstOriginal.has(c.filePath) && c.diffReviewStatus !== 'reverted')
          .map((c) => c.toolCallId)
      );
      const msgIds = new Set(
        trackedChanges.filter((c) => toRevert.has(c.toolCallId)).map((c) => c.msgId)
      );
      for (const msg of messages) {
        if (!msgIds.has(msg.id) || !msg.toolCalls) continue;
        updateMessage(msg.id, {
          toolCalls: msg.toolCalls.map((tc) =>
            toRevert.has(tc.id) ? { ...tc, diffReviewStatus: 'reverted' as const } : tc
          ),
        });
      }
    } catch (e) {
      console.error('撤销全部失败', e);
    } finally {
      setRevertBusy(false);
    }
  }, [revertBusy, trackedChanges, messages, updateMessage]);

  const totalFiles = fileSummaries.length;
  const totalChanges = fileSummaries.reduce((s, f) => s + f.changes.length, 0);
  const canRevertAll = trackedChanges.some((c) => c.originalContent !== undefined && c.diffReviewStatus !== 'reverted');

  /** 应用某个文件的所有待确认变更 */
  const handleAcceptFile = useCallback((filePath: string) => {
    const toAccept = new Set(
      trackedChanges.filter((c) => c.filePath === filePath && !c.diffReviewStatus).map((c) => c.toolCallId)
    );
    if (toAccept.size === 0) return;
    const msgIds = new Set(trackedChanges.filter((c) => toAccept.has(c.toolCallId)).map((c) => c.msgId));
    for (const msg of messages) {
      if (!msgIds.has(msg.id) || !msg.toolCalls) continue;
      updateMessage(msg.id, {
        toolCalls: msg.toolCalls.map((tc) =>
          toAccept.has(tc.id) ? { ...tc, diffReviewStatus: 'accepted' as const } : tc
        ),
      });
    }
  }, [trackedChanges, messages, updateMessage]);

  /** 回滚某个文件的所有变更（使用最早的 originalContent 快照写回磁盘） */
  const handleRevertFile = useCallback(async (filePath: string) => {
    const fileChanges = trackedChanges.filter((c) => c.filePath === filePath);
    const originalContent = fileChanges.find((c) => c.originalContent !== undefined)?.originalContent;
    if (originalContent === undefined) return;
    try {
      await window.electronAPI.writeFile(filePath, originalContent);
      const toRevert = new Set(
        fileChanges.filter((c) => c.diffReviewStatus !== 'reverted').map((c) => c.toolCallId)
      );
      const msgIds = new Set(fileChanges.filter((c) => toRevert.has(c.toolCallId)).map((c) => c.msgId));
      for (const msg of messages) {
        if (!msgIds.has(msg.id) || !msg.toolCalls) continue;
        updateMessage(msg.id, {
          toolCalls: msg.toolCalls.map((tc) =>
            toRevert.has(tc.id) ? { ...tc, diffReviewStatus: 'reverted' as const } : tc
          ),
        });
      }
    } catch (e) {
      console.error('单文件回滚失败', e);
    }
  }, [trackedChanges, messages, updateMessage]);

  /**
   * 对话 ↔ Diff 联动：当 activeChangeId 变化时，
   * 展开对应文件和变更卡片，并滚动到该卡片高亮显示
   */
  useEffect(() => {
    if (!activeChangeId) return;
    // 找到该工具调用所属的文件 + 在 fileSummaries 中的位置
    let targetFilePath: string | null = null;
    let targetChangeKey: string | null = null;
    outer: for (const fs of fileSummaries) {
      for (let idx = 0; idx < fs.changes.length; idx++) {
        if (fs.changes[idx].toolCall.id === activeChangeId) {
          targetFilePath = fs.filePath;
          targetChangeKey = `${fs.filePath}-${idx}`;
          break outer;
        }
      }
    }
    if (!targetFilePath || !targetChangeKey) return;

    // 展开文件行 + 变更卡片
    setExpandedFiles((prev) => new Set([...prev, targetFilePath!]));
    setExpandedChanges((prev) => new Set([...prev, targetChangeKey!]));
    setHighlightedId(activeChangeId);
    setActiveChangeId(null); // 消费掉，避免重复触发

    // 等待 DOM 更新后再滚动
    setTimeout(() => {
      const el = containerRef.current?.querySelector(`[data-toolcall-id="${CSS.escape(activeChangeId)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // 1.5s 后取消高亮
      setTimeout(() => setHighlightedId(null), 1500);
    }, 80);
  }, [activeChangeId, fileSummaries, setActiveChangeId]);

  if (totalFiles === 0) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
        <FileText size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
        本次会话暂无文件变更
      </div>
    );
  }

  const toggleFile = (fp: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fp)) next.delete(fp);
      else next.add(fp);
      return next;
    });
  };

  const toggleChange = (key: string) => {
    setExpandedChanges(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontSize: 13 }}>
      {/* 汇总头 */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={14} style={{ color: 'var(--accent-primary, #7c3aed)' }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>变更文件汇总</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {totalFiles} 个文件 · {totalChanges} 次操作
          </span>
        </div>
        {/* 统计 + 批量操作 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
            {pendingCount > 0 && <span style={{ color: 'var(--accent-warning, #f59e0b)' }}>{pendingCount} 待确认</span>}
            {pendingCount > 0 && (acceptedCount > 0 || revertedCount > 0) && ' · '}
            {acceptedCount > 0 && <span style={{ color: 'var(--accent-success, #22c55e)' }}>{acceptedCount} 已应用</span>}
            {acceptedCount > 0 && revertedCount > 0 && ' · '}
            {revertedCount > 0 && <span style={{ color: 'var(--text-muted)' }}>{revertedCount} 已回滚</span>}
          </span>
          <button
            onClick={handleAcceptAll}
            disabled={pendingCount === 0}
            title="将所有待确认变更标记为已应用"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, padding: '3px 8px', borderRadius: 4,
              border: '1px solid var(--accent-success, #22c55e)',
              color: pendingCount === 0 ? 'var(--text-muted)' : 'var(--accent-success, #22c55e)',
              background: 'transparent', cursor: pendingCount === 0 ? 'not-allowed' : 'pointer',
              opacity: pendingCount === 0 ? 0.5 : 1,
            }}
          >
            <CheckCheck size={12} />
            应用全部
          </button>
          <button
            onClick={handleRevertAll}
            disabled={!canRevertAll || revertBusy}
            title="将所有文件恢复到 Claude 修改前的状态"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, padding: '3px 8px', borderRadius: 4,
              border: '1px solid var(--accent-danger, #ef4444)',
              color: (!canRevertAll || revertBusy) ? 'var(--text-muted)' : 'var(--accent-danger, #ef4444)',
              background: 'transparent', cursor: (!canRevertAll || revertBusy) ? 'not-allowed' : 'pointer',
              opacity: (!canRevertAll || revertBusy) ? 0.5 : 1,
            }}
          >
            <RotateCcw size={12} style={{ animation: revertBusy ? 'tab-spin 0.7s linear infinite' : undefined }} />
            {revertBusy ? '回滚中…' : '撤销全部'}
          </button>
          {/* 全部变更已应用时，显示"提交到 Git"快捷入口 */}
          {pendingCount === 0 && acceptedCount > 0 && (
            <button
              onClick={() => setActiveNavSection('artifacts')}
              title="切换到制品视图 Git 面板快速提交这批变更"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, padding: '3px 8px', borderRadius: 4,
                border: '1px solid var(--accent-primary, #7c3aed)',
                color: 'var(--accent-primary, #7c3aed)',
                background: 'transparent', cursor: 'pointer',
              }}
            >
              <GitCommit size={12} />
              提交到 Git ↗
            </button>
          )}
        </div>
      </div>

      {/* 文件列表 */}
      <div ref={containerRef} style={{ flex: 1, overflowY: 'auto' }}>
        {fileSummaries.map((fs) => {
          const isExpanded = expandedFiles.has(fs.filePath);
          // 主要操作类型（最后一次）
          const lastChange = fs.changes[fs.changes.length - 1];
          // 当前文件的跟踪变更
          const fileTracked = trackedChanges.filter((c) => c.filePath === fs.filePath);
          const filePendingCount = fileTracked.filter((c) => !c.diffReviewStatus).length;
          const canRevertThisFile = fileTracked.some((c) => c.originalContent !== undefined && c.diffReviewStatus !== 'reverted');
          return (
            <div key={fs.filePath} style={{ borderBottom: '1px solid var(--border-color)' }}>
              {/* 文件行 */}
              <div
                onClick={() => toggleFile(fs.filePath)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  background: isExpanded ? 'var(--bg-hover)' : 'transparent',
                }}
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span style={{
                  color: CHANGE_COLORS[lastChange.changeType],
                  display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                }}>
                  {CHANGE_ICONS[lastChange.changeType]}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 12, flex: 1, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={fs.filePath}>
                  {fs.displayName}
                </span>
                {fs.changes.length > 1 && (
                  <span style={{
                    fontSize: 10, background: 'var(--bg-hover)',
                    color: 'var(--text-muted)', borderRadius: 3, padding: '1px 5px',
                  }}>
                    {fs.changes.length} 次
                  </span>
                )}
                <span style={{ fontSize: 10, color: CHANGE_COLORS[lastChange.changeType] }}>
                  {CHANGE_LABELS[lastChange.changeType]}
                </span>
                {/* 在编辑器中打开 */}
                <button
                  title="在编辑器中打开文件"
                  onClick={(e) => { e.stopPropagation(); void window.electronAPI.openInEditor(fs.filePath); }}
                  style={{
                    display: 'flex', alignItems: 'center',
                    fontSize: 10, padding: '1px 5px', borderRadius: 3,
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    background: 'transparent', cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  <ExternalLink size={10} />
                </button>
                {/* 单文件操作按钮 */}
                <button
                  title="应用该文件所有变更"
                  disabled={filePendingCount === 0}
                  onClick={(e) => { e.stopPropagation(); handleAcceptFile(fs.filePath); }}
                  style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 3,
                    border: '1px solid var(--accent-success, #22c55e)',
                    color: filePendingCount === 0 ? 'var(--text-muted)' : 'var(--accent-success, #22c55e)',
                    background: 'transparent', cursor: filePendingCount === 0 ? 'not-allowed' : 'pointer',
                    opacity: filePendingCount === 0 ? 0.4 : 1, flexShrink: 0,
                  }}
                >
                  ✓ 应用
                </button>
                <button
                  title="将该文件回滚到修改前"
                  disabled={!canRevertThisFile}
                  onClick={(e) => { e.stopPropagation(); void handleRevertFile(fs.filePath); }}
                  style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 3,
                    border: '1px solid var(--accent-danger, #ef4444)',
                    color: !canRevertThisFile ? 'var(--text-muted)' : 'var(--accent-danger, #ef4444)',
                    background: 'transparent', cursor: !canRevertThisFile ? 'not-allowed' : 'pointer',
                    opacity: !canRevertThisFile ? 0.4 : 1, flexShrink: 0,
                  }}
                >
                  ↩ 回滚
                </button>
              </div>

              {/* 展开的变更详情 */}
              {isExpanded && (
                <div style={{ paddingLeft: 28 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 14px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {fs.filePath}
                  </div>
                  {fs.changes.map((change, idx) => {
                    const key = `${fs.filePath}-${idx}`;
                    const isDiffExpanded = expandedChanges.has(key);
                    // 查找该工具调用的审阅状态
                    const reviewStatus = trackedChanges.find((c) => c.toolCallId === change.toolCall.id)?.diffReviewStatus;
                    return (
                      <div key={key} style={{ margin: '4px 0' }}>
                        <div
                          data-toolcall-id={change.toolCall.id}
                          onClick={() => toggleChange(key)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '4px 14px', cursor: 'pointer',
                            fontSize: 12, color: 'var(--text-secondary)',
                            background: highlightedId === change.toolCall.id
                              ? 'rgba(139,92,246,0.18)'
                              : 'transparent',
                            transition: 'background 0.5s',
                            borderRadius: 4,
                          }}
                        >
                          {isDiffExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                          <span style={{ color: CHANGE_COLORS[change.changeType], display: 'flex', alignItems: 'center', gap: 4 }}>
                            {CHANGE_ICONS[change.changeType]}
                            {CHANGE_LABELS[change.changeType]}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            操作 {idx + 1}
                          </span>
                          {/* 审阅状态徽章 */}
                          {reviewStatus === 'accepted' && (
                            <span style={{ fontSize: 10, color: 'var(--accent-success, #22c55e)', marginLeft: 'auto' }}>
                              ✓ 已应用
                            </span>
                          )}
                          {reviewStatus === 'reverted' && (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                              ↩ 已回滚
                            </span>
                          )}
                          {!reviewStatus && (
                            <span style={{ fontSize: 10, color: 'var(--accent-warning, #f59e0b)', marginLeft: 'auto' }}>
                              待确认
                            </span>
                          )}
                        </div>
                        {isDiffExpanded && (
                          <div style={{ margin: '0 14px 8px', border: '1px solid var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
                            <ChangeDetail
                              change={change}
                              originalContent={trackedChanges.find((c) => c.toolCallId === change.toolCall.id)?.originalContent}
                              onLineClick={(lineNum) => void window.electronAPI.openInEditor(fs.filePath, lineNum)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
