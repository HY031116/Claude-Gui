/**
 * ReviewQueue — 常驻右侧的变更审查队列（任务中心范式）
 * 复用 ChangeSummaryPanel 核心逻辑，但以紧凑右栏形式呈现。
 * 仅展示待审查的文件变更，提供逐文件接受/拒绝 + 批量操作。
 */
import { useMemo, useState, useCallback } from 'react';
import {
  Check,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  FilePlus,
  Edit3,
  Layers,
  GitBranch,
  Inbox,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { ToolCall } from '../../types';
import { DiffViewer, WritePreview, WriteDiff } from '../DiffView';

const FILE_MODIFY_TOOLS = [
  'Write', 'write_file', 'Edit', 'edit_file',
  'str_replace_editor', 'str_replace_based_edit_tool', 'MultiEdit', 'multiedit',
];

type ChangeType = 'write' | 'edit' | 'multi_edit';

interface FileChange {
  filePath: string;
  changeType: ChangeType;
  toolCall: ToolCall;
  msgId: string;
}

/** 提取工具调用类型 */
function resolveChangeType(name: string): ChangeType {
  if (name === 'Write' || name === 'write_file') return 'write';
  if (name === 'MultiEdit' || name === 'multiedit') return 'multi_edit';
  return 'edit';
}

/** 文件路径缩短显示 */
function shortPath(fp: string) {
  const parts = fp.replace(/\\/g, '/').split('/');
  if (parts.length <= 2) return fp;
  return `…/${parts.slice(-2).join('/')}`;
}

const TYPE_ICONS: Record<ChangeType, React.ReactNode> = {
  write: <FilePlus size={11} />,
  edit: <Edit3 size={11} />,
  multi_edit: <Layers size={11} />,
};

/** 单个变更的 diff 预览 */
function ChangeDiff({ change }: { change: FileChange }) {
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
    return <DiffViewer oldStr={oldStr} newStr={newStr} />;
  }
  if (change.changeType === 'multi_edit') {
    const edits = (args.edits ?? []) as Array<{ old_string: string; new_string: string }>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {edits.map((e, i) => (
          <DiffViewer key={i} oldStr={e.old_string ?? ''} newStr={e.new_string ?? ''} />
        ))}
      </div>
    );
  }
  return null;
}

/** 单个文件卡片 */
function FileCard({
  filePath,
  changes,
  onAccept,
  onRevert,
  busy,
}: {
  filePath: string;
  changes: FileChange[];
  onAccept: () => void;
  onRevert: () => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TYPE_ICONS[changes[0]?.changeType ?? 'edit'];

  return (
    <div style={{
      border: '1px solid var(--border-color)',
      borderRadius: 6,
      overflow: 'hidden',
      background: 'var(--bg-secondary)',
      marginBottom: 6,
    }}>
      {/* 文件头部 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span style={{ color: 'var(--accent-color)', flexShrink: 0 }}>{Icon}</span>
        <code
          style={{
            flex: 1,
            fontSize: 11,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={filePath}
        >
          {shortPath(filePath)}
        </code>
        {/* 操作按钮 */}
        <button
          className="btn"
          disabled={busy}
          onClick={(e) => { e.stopPropagation(); onAccept(); }}
          title="接受此文件变更"
          style={{ fontSize: 10, padding: '2px 7px', display: 'flex', alignItems: 'center', gap: 2, color: 'var(--success-text)' }}
        >
          <Check size={10} /> 接受
        </button>
        <button
          className="btn"
          disabled={busy}
          onClick={(e) => { e.stopPropagation(); onRevert(); }}
          title="撤销此文件变更"
          style={{ fontSize: 10, padding: '2px 7px', display: 'flex', alignItems: 'center', gap: 2 }}
        >
          <RotateCcw size={10} /> 撤销
        </button>
      </div>

      {/* Diff 展开区域 */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-color)', padding: 8 }}>
          {changes.map((c) => (
            <ChangeDiff key={c.toolCall.id} change={c} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ReviewQueue() {
  const messages = useAppStore((s) => s.messages);
  const updateMessage = useAppStore((s) => s.updateMessage);
  const setActiveNavSection = useAppStore((s) => s.setActiveNavSection);
  const setActiveAuxSubPanel = useAppStore((s) => s.setActiveAuxSubPanel);
  const [revertBusy, setRevertBusy] = useState(false);

  /** 收集所有待审查的文件变更（未审阅 + success） */
  const pendingChanges = useMemo((): FileChange[] => {
    const result: FileChange[] = [];
    for (const msg of messages) {
      for (const tc of (msg.toolCalls ?? [])) {
        if (!FILE_MODIFY_TOOLS.includes(tc.name)) continue;
        if (tc.status !== 'success') continue;
        if (tc.diffReviewStatus) continue; // 已处理
        const args = tc.arguments ?? {};
        const fp = (args.file_path ?? args.path ?? args.filename ?? '') as string;
        if (!fp) continue;
        result.push({
          filePath: fp,
          changeType: resolveChangeType(tc.name),
          toolCall: tc,
          msgId: msg.id,
        });
      }
    }
    return result;
  }, [messages]);

  /** 按文件路径分组 */
  const byFile = useMemo(() => {
    const map = new Map<string, FileChange[]>();
    for (const c of pendingChanges) {
      if (!map.has(c.filePath)) map.set(c.filePath, []);
      map.get(c.filePath)!.push(c);
    }
    return map;
  }, [pendingChanges]);

  /** 接受单个文件的所有变更 */
  const acceptFile = useCallback((filePath: string) => {
    const ids = new Set((byFile.get(filePath) ?? []).map((c) => c.toolCall.id));
    const msgIds = new Set((byFile.get(filePath) ?? []).map((c) => c.msgId));
    for (const msg of messages) {
      if (!msgIds.has(msg.id) || !msg.toolCalls) continue;
      updateMessage(msg.id, {
        toolCalls: msg.toolCalls.map((tc) =>
          ids.has(tc.id) ? { ...tc, diffReviewStatus: 'accepted' as const } : tc
        ),
      });
    }
  }, [byFile, messages, updateMessage]);

  /** 撤销单个文件的所有变更（写回最早快照） */
  const revertFile = useCallback(async (filePath: string) => {
    if (revertBusy) return;
    setRevertBusy(true);
    try {
      const changes = byFile.get(filePath) ?? [];
      const firstWithOriginal = changes.find((c) => c.toolCall.originalContent !== undefined);
      if (firstWithOriginal?.toolCall.originalContent !== undefined) {
        await window.electronAPI.writeFile(filePath, firstWithOriginal.toolCall.originalContent);
      }
      const ids = new Set(changes.map((c) => c.toolCall.id));
      const msgIds = new Set(changes.map((c) => c.msgId));
      for (const msg of messages) {
        if (!msgIds.has(msg.id) || !msg.toolCalls) continue;
        updateMessage(msg.id, {
          toolCalls: msg.toolCalls.map((tc) =>
            ids.has(tc.id) ? { ...tc, diffReviewStatus: 'reverted' as const } : tc
          ),
        });
      }
    } finally {
      setRevertBusy(false);
    }
  }, [revertBusy, byFile, messages, updateMessage]);

  /** 批量接受全部 */
  const acceptAll = useCallback(() => {
    const ids = new Set(pendingChanges.map((c) => c.toolCall.id));
    const msgIds = new Set(pendingChanges.map((c) => c.msgId));
    for (const msg of messages) {
      if (!msgIds.has(msg.id) || !msg.toolCalls) continue;
      updateMessage(msg.id, {
        toolCalls: msg.toolCalls.map((tc) =>
          ids.has(tc.id) ? { ...tc, diffReviewStatus: 'accepted' as const } : tc
        ),
      });
    }
  }, [pendingChanges, messages, updateMessage]);

  /** 批量撤销全部（每个文件取最早快照） */
  const revertAll = useCallback(async () => {
    if (revertBusy) return;
    setRevertBusy(true);
    try {
      const fileFirstOriginal = new Map<string, string>();
      for (const c of pendingChanges) {
        if (c.toolCall.originalContent !== undefined && !fileFirstOriginal.has(c.filePath)) {
          fileFirstOriginal.set(c.filePath, c.toolCall.originalContent);
        }
      }
      await Promise.all(
        Array.from(fileFirstOriginal.entries()).map(([fp, orig]) =>
          window.electronAPI.writeFile(fp, orig)
        )
      );
      const ids = new Set(pendingChanges.map((c) => c.toolCall.id));
      const msgIds = new Set(pendingChanges.map((c) => c.msgId));
      for (const msg of messages) {
        if (!msgIds.has(msg.id) || !msg.toolCalls) continue;
        updateMessage(msg.id, {
          toolCalls: msg.toolCalls.map((tc) =>
            ids.has(tc.id) ? { ...tc, diffReviewStatus: 'reverted' as const } : tc
          ),
        });
      }
    } finally {
      setRevertBusy(false);
    }
  }, [revertBusy, pendingChanges, messages, updateMessage]);

  /** 跳转到 Git 提交面板 */
  const goToGit = useCallback(() => {
    setActiveNavSection('project');
    setActiveAuxSubPanel('git');
  }, [setActiveNavSection, setActiveAuxSubPanel]);

  const hasAccepted = messages.some((m) =>
    (m.toolCalls ?? []).some((tc) => tc.diffReviewStatus === 'accepted')
  );

  // 无待审查变更：空状态
  if (byFile.size === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 8,
        color: 'var(--text-muted)',
        padding: 24,
      }}>
        <Inbox size={32} strokeWidth={1.5} />
        <span style={{ fontSize: 12, textAlign: 'center' }}>
          {hasAccepted ? '所有变更已审查完成' : '本轮任务暂无文件变更'}
        </span>
        {hasAccepted && (
          <button
            className="btn"
            onClick={goToGit}
            style={{ fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <GitBranch size={12} /> 提交到 Git
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 顶栏：统计 + 批量操作 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          待审查 {byFile.size} 个文件
        </span>
        <button
          className="btn"
          disabled={revertBusy}
          onClick={acceptAll}
          style={{ fontSize: 11, padding: '2px 10px', display: 'flex', alignItems: 'center', gap: 3, color: 'var(--success-text)' }}
        >
          <Check size={11} /> 全部接受
        </button>
        <button
          className="btn"
          disabled={revertBusy}
          onClick={() => void revertAll()}
          style={{ fontSize: 11, padding: '2px 10px', display: 'flex', alignItems: 'center', gap: 3 }}
        >
          <RotateCcw size={11} /> 全部撤销
        </button>
      </div>

      {/* 文件列表（可滚动） */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        {Array.from(byFile.entries()).map(([fp, changes]) => (
          <FileCard
            key={fp}
            filePath={fp}
            changes={changes}
            onAccept={() => acceptFile(fp)}
            onRevert={() => void revertFile(fp)}
            busy={revertBusy}
          />
        ))}
      </div>

      {/* 底部：Git 提交入口 */}
      <div style={{
        borderTop: '1px solid var(--border-color)',
        padding: '8px 12px',
        flexShrink: 0,
      }}>
        <button
          className="btn"
          onClick={goToGit}
          style={{
            width: '100%',
            fontSize: 12,
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <GitBranch size={13} /> 接受并提交到 Git ↗
        </button>
      </div>
    </div>
  );
}
