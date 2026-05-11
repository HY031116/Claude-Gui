/**
 * 变更文件汇总面板
 * 从当前会话的所有消息中扫描 Write/Edit/MultiEdit 工具调用，
 * 展示每个文件的变更次数、操作类型及可展开的 Diff 预览
 */
import { useMemo, useState } from 'react';
import { FileText, ChevronDown, ChevronRight, Edit3, FilePlus, Layers } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import type { ToolCall } from '../types';
import { InlineDiff, WritePreview, WriteDiff } from './DiffView';

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
function ChangeDetail({ change }: { change: FileChange }) {
  const args = change.toolCall.arguments ?? {};
  if (change.changeType === 'write') {
    const content = (args.content ?? args.file_content ?? '') as string;
    const original = change.toolCall.originalContent;
    if (original !== undefined) return <WriteDiff originalContent={original} newContent={content} />;
    return <WritePreview content={content} />;
  }
  if (change.changeType === 'edit') {
    const oldStr = (args.old_string ?? args.old_content ?? '') as string;
    const newStr = (args.new_string ?? args.new_content ?? '') as string;
    return <InlineDiff oldStr={oldStr} newStr={newStr} />;
  }
  if (change.changeType === 'multi_edit') {
    const edits = (args.edits ?? []) as Array<{ old_string: string; new_string: string }>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {edits.map((e, i) => (
          <div key={i}>
            {edits.length > 1 && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 0', marginBottom: 2 }}>
                段落 {i + 1}
              </div>
            )}
            <InlineDiff oldStr={e.old_string ?? ''} newStr={e.new_string ?? ''} />
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export function ChangeSummaryPanel() {
  const { messages } = useAppStore();
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());

  /** 从所有消息中收集工具调用 */
  const fileSummaries = useMemo(() => {
    const allToolCalls: ToolCall[] = [];
    for (const msg of messages) {
      if (msg.toolCalls?.length) allToolCalls.push(...msg.toolCalls);
    }
    const changes = getFileChanges(allToolCalls);
    return summarizeByFile(changes);
  }, [messages]);

  const totalFiles = fileSummaries.length;
  const totalChanges = fileSummaries.reduce((s, f) => s + f.changes.length, 0);

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
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <FileText size={14} style={{ color: 'var(--accent-primary, #7c3aed)' }} />
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>变更文件汇总</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {totalFiles} 个文件 · {totalChanges} 次操作
        </span>
      </div>

      {/* 文件列表 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {fileSummaries.map((fs) => {
          const isExpanded = expandedFiles.has(fs.filePath);
          // 主要操作类型（最后一次）
          const lastChange = fs.changes[fs.changes.length - 1];
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
                    return (
                      <div key={key} style={{ margin: '4px 0' }}>
                        <div
                          onClick={() => toggleChange(key)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '4px 14px', cursor: 'pointer',
                            fontSize: 12, color: 'var(--text-secondary)',
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
                        </div>
                        {isDiffExpanded && (
                          <div style={{ margin: '0 14px 8px', border: '1px solid var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
                            <ChangeDetail change={change} />
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
