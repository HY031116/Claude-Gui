import { useState, useMemo } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { RotateCcw, FileCode, ChevronDown, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';

/** 文件修改工具名（需记录 originalContent 快照的工具） */
const FILE_MODIFY_TOOLS = new Set([
  'Write', 'write_file',
  'Edit', 'edit_file', 'str_replace_editor',
  'MultiEdit', 'multiedit',
  'str_replace_based_edit_tool',
]);

/** 从工具调用 arguments 中提取文件路径 */
function getFilePath(args: Record<string, unknown>): string {
  return ((args.file_path ?? args.path ?? args.filename ?? '') as string);
}

/** 工具名的中文标签 */
function toolLabel(name: string): string {
  const n = name.toLowerCase();
  if (n === 'write' || n === 'write_file') return '写入';
  if (n.includes('edit') || n.includes('str_replace')) return '编辑';
  if (n.includes('multi')) return '批量编辑';
  return name;
}

interface CheckpointEntry {
  /** tool_use id */
  id: string;
  /** 文件绝对路径 */
  filePath: string;
  /** 操作类型（Write/Edit/…） */
  toolName: string;
  /** 操作前的文件内容快照（用于回滚） */
  originalContent: string;
  /** 操作后的新内容（仅 Write 工具有完整新内容） */
  newContent?: string;
  /** 操作在消息列表中的顺序索引（用于排序） */
  order: number;
}

/** 恢复状态 Map<entryId, 'restoring'|'done'|'error'> */
type RestoreState = Map<string, 'restoring' | 'done' | 'error'>;

/**
 * CheckpointPanel — 当前会话文件修改快照列表
 *
 * 展示本 Session 内所有文件写入/编辑操作（Write/Edit/MultiEdit），
 * 每条记录保存了操作前的文件内容，支持一键还原。
 */
export function CheckpointPanel() {
  const messages = useAppStore((s) => s.messages);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [restoreState, setRestoreState] = useState<RestoreState>(new Map());
  const [confirmEntry, setConfirmEntry] = useState<CheckpointEntry | null>(null);

  // 从当前会话 messages 中提取所有已捕获快照的文件修改记录
  const allEntries = useMemo<CheckpointEntry[]>(() => {
    const result: CheckpointEntry[] = [];
    messages.forEach((msg, msgIdx) => {
      (msg.toolCalls ?? []).forEach((tc, tcIdx) => {
        if (
          FILE_MODIFY_TOOLS.has(tc.name) &&
          tc.originalContent !== undefined &&
          tc.status === 'success'
        ) {
          const fp = getFilePath(tc.arguments);
          if (!fp) return;
          result.push({
            id: tc.id,
            filePath: fp,
            toolName: tc.name,
            originalContent: tc.originalContent,
            newContent:
              (tc.name === 'Write' || tc.name === 'write_file')
                ? (tc.arguments.content as string | undefined)
                : undefined,
            order: msgIdx * 10000 + tcIdx,
          });
        }
      });
    });
    // 最新的在前
    return result.reverse();
  }, [messages]);

  // 按文件路径分组
  const byFile = useMemo(() => {
    const map = new Map<string, CheckpointEntry[]>();
    for (const e of allEntries) {
      if (!map.has(e.filePath)) map.set(e.filePath, []);
      map.get(e.filePath)!.push(e);
    }
    return map;
  }, [allEntries]);

  const toggleFile = (fp: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fp)) next.delete(fp);
      else next.add(fp);
      return next;
    });
  };

  /** 执行回滚：将文件内容还原为 originalContent */
  const handleRestore = async (entry: CheckpointEntry) => {
    setConfirmEntry(null);
    setRestoreState((prev) => new Map(prev).set(entry.id, 'restoring'));
    const result = await window.electronAPI?.writeFile(entry.filePath, entry.originalContent);
    setRestoreState((prev) => new Map(prev).set(entry.id, result?.success ? 'done' : 'error'));
    // 3 秒后清除状态提示
    setTimeout(() => {
      setRestoreState((prev) => {
        const next = new Map(prev);
        next.delete(entry.id);
        return next;
      });
    }, 3000);
  };

  /** 短路径显示（只显示最后 3 段） */
  const shortPath = (fp: string) => {
    const parts = fp.replace(/\\/g, '/').split('/');
    return parts.slice(-3).join('/');
  };

  if (allEntries.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 10,
          color: 'var(--text-muted)',
          fontSize: 13,
        }}
      >
        <RotateCcw size={28} />
        <div>当前会话暂无文件修改记录</div>
        <div style={{ fontSize: 11 }}>当 Claude 使用 Write/Edit 工具修改文件时，快照会自动记录在这里</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 顶部栏 */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <RotateCcw size={15} color="var(--accent-color)" />
        <span style={{ fontSize: 13, fontWeight: 600 }}>文件快照（{allEntries.length} 条）</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          共 {byFile.size} 个文件
        </span>
      </div>

      {/* 提示 */}
      <div
        style={{
          padding: '6px 14px',
          fontSize: 11,
          color: 'var(--text-muted)',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}
      >
        以下为本 Session 内捕获的操作前文件快照。点击"还原"可将文件恢复到该操作执行前的状态。
      </div>

      {/* 列表（按文件分组） */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {Array.from(byFile.entries()).map(([fp, entries]) => {
          const expanded = expandedFiles.has(fp);
          return (
            <div key={fp} style={{ borderBottom: '1px solid var(--border-color)' }}>
              {/* 文件组标题 */}
              <button
                onClick={() => toggleFile(fp)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: 'var(--bg-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <FileCode size={14} color="var(--accent-color)" style={{ flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                  title={fp}
                >
                  {shortPath(fp)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {entries.length} 次修改
                </span>
              </button>

              {/* 该文件的快照列表 */}
              {expanded && entries.map((entry, idx) => {
                const rs = restoreState.get(entry.id);
                return (
                  <div
                    key={entry.id}
                    style={{
                      padding: '8px 14px 8px 34px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      borderTop: '1px solid var(--border-color)',
                      background: idx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                    }}
                  >
                    {/* 序号（从最新开始计） */}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, minWidth: 20 }}>
                      #{entries.length - idx}
                    </span>
                    {/* 操作类型标签 */}
                    <span
                      style={{
                        fontSize: 11,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 4,
                        padding: '1px 6px',
                        flexShrink: 0,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {toolLabel(entry.toolName)}
                    </span>
                    {/* 快照大小 */}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
                      {(entry.originalContent.length / 1024).toFixed(1)} KB
                    </span>
                    {/* 状态 / 还原按钮 */}
                    {rs === 'restoring' ? (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>还原中…</span>
                    ) : rs === 'done' ? (
                      <span style={{ fontSize: 11, color: 'var(--success-color, #4caf50)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <CheckCircle size={12} /> 已还原
                      </span>
                    ) : rs === 'error' ? (
                      <span style={{ fontSize: 11, color: 'var(--error-color, #f44336)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <AlertTriangle size={12} /> 失败
                      </span>
                    ) : (
                      <button
                        className="btn"
                        onClick={() => setConfirmEntry(entry)}
                        style={{ fontSize: 11, padding: '2px 10px', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                        title={`将 ${fp} 还原到此操作前的内容`}
                      >
                        <RotateCcw size={11} />
                        还原
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* 确认弹窗 */}
      {confirmEntry && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setConfirmEntry(null)}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: 24,
              maxWidth: 420,
              width: '90%',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={18} color="#d4a017" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>确认还原文件？</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              即将将以下文件还原到该操作执行前的状态：
            </div>
            <div
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-mono, monospace)',
                background: 'var(--bg-secondary)',
                borderRadius: 6,
                padding: '6px 10px',
                marginBottom: 16,
                wordBreak: 'break-all',
                color: 'var(--accent-color)',
              }}
            >
              {confirmEntry.filePath}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
              此操作会覆盖文件当前内容，且无法撤销（除非再次运行 Claude Code 修改）。
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setConfirmEntry(null)} style={{ fontSize: 12 }}>
                取消
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleRestore(confirmEntry)}
                style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <RotateCcw size={12} />
                确认还原
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
