import { useState, useMemo } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { RotateCcw, FileCode, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, GitCommit } from 'lucide-react';

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

/** 一个 Checkpoint = 同一条 assistant 消息内的全部文件修改记录 */
interface Checkpoint {
  /** 消息索引 —— 唯一 key */
  msgIdx: number;
  /** 消息时间戳（毫秒） */
  timestamp: number;
  /** 该 checkpoint 触发的主要工具名（最多显示一个） */
  primaryTool: string;
  /** 该 checkpoint 内所有文件修改记录 */
  entries: CheckpointEntry[];
}

/** 恢复状态 Map<checkpointKey, 'restoring'|'done'|'error'> */
type RestoreState = Map<string, 'restoring' | 'done' | 'error'>;

/** 格式化时间戳 */
function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

/**
 * CheckpointPanel — 时间轴视图（FEAT-512）
 *
 * 将 Session 内所有文件修改记录按消息分组为「Checkpoint」，
 * 显示时间轴，支持「回滚到此点」批量还原该 Checkpoint 之后的所有文件变更。
 */
export function CheckpointPanel() {
  const messages = useAppStore((s) => s.messages);
  const [expandedCps, setExpandedCps] = useState<Set<number>>(new Set());
  const [restoreState, setRestoreState] = useState<RestoreState>(new Map());
  const [confirmCp, setConfirmCp] = useState<Checkpoint | null>(null);

  // 从 messages 按消息分组构建 Checkpoint 列表（最新在前）
  const checkpoints = useMemo<Checkpoint[]>(() => {
    const result: Checkpoint[] = [];
    messages.forEach((msg, msgIdx) => {
      const entries: CheckpointEntry[] = [];
      (msg.toolCalls ?? []).forEach((tc, tcIdx) => {
        if (
          FILE_MODIFY_TOOLS.has(tc.name) &&
          tc.originalContent !== undefined &&
          tc.status === 'success'
        ) {
          const fp = getFilePath(tc.arguments);
          if (!fp) return;
          entries.push({
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
      if (entries.length > 0) {
        result.push({
          msgIdx,
          timestamp: (msg as unknown as { timestamp?: number }).timestamp ?? Date.now(),
          primaryTool: entries[0].toolName,
          entries,
        });
      }
    });
    // 最新的在前
    return result.reverse();
  }, [messages]);

  // 「回滚到此点」时需要还原的文件 = 该 checkpoint 之后（index 更大，时间更晚）的所有 entries
  const getEntriesAfter = (cp: Checkpoint): CheckpointEntry[] => {
    const after: CheckpointEntry[] = [];
    for (const c of checkpoints) {
      if (c.msgIdx > cp.msgIdx) after.push(...c.entries);
    }
    return after;
  };

  const toggleCp = (idx: number) => {
    setExpandedCps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  /** 批量回滚：将 checkpoint 之后所有文件还原为各自操作前的快照 */
  const handleRollback = async (cp: Checkpoint) => {
    setConfirmCp(null);
    const key = String(cp.msgIdx);
    setRestoreState((prev) => new Map(prev).set(key, 'restoring'));
    const toRestore = getEntriesAfter(cp);
    // 若 checkpoint 之后没有更晚的变更，直接还原本 checkpoint 自身
    const targets = toRestore.length > 0 ? toRestore : cp.entries;
    let allOk = true;
    for (const e of targets) {
      const r = await window.electronAPI?.writeFile(e.filePath, e.originalContent);
      if (!r?.success) { allOk = false; break; }
    }
    setRestoreState((prev) => new Map(prev).set(key, allOk ? 'done' : 'error'));
    setTimeout(() => {
      setRestoreState((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    }, 3000);
  };

  /** 短路径显示（只显示最后 3 段） */
  const shortPath = (fp: string) => {
    const parts = fp.replace(/\\/g, '/').split('/');
    return parts.slice(-3).join('/');
  };

  const totalEntries = checkpoints.reduce((s, c) => s + c.entries.length, 0);

  if (checkpoints.length === 0) {
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
        <div>暂无文件修改记录</div>
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
        <GitCommit size={15} color="var(--accent-color)" />
        <span style={{ fontSize: 13, fontWeight: 600 }}>变更时间轴（{checkpoints.length} 个快照）</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          共 {totalEntries} 次文件操作
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
        每个节点对应一次 Claude 操作批次。「回滚到此点」将还原该节点之后所有文件到操作前的状态。
      </div>

      {/* 时间轴列表 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {checkpoints.map((cp, cpIdx) => {
          const key = String(cp.msgIdx);
          const expanded = expandedCps.has(cp.msgIdx);
          const rs = restoreState.get(key);
          const isLast = cpIdx === checkpoints.length - 1;
          return (
            <div key={key} style={{ display: 'flex', gap: 0 }}>
              {/* 时间轴竖线 + 圆点 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0 }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%', marginTop: 12, flexShrink: 0,
                  background: cpIdx === 0 ? 'var(--accent-color, #7c3aed)' : 'var(--border-color)',
                  border: '2px solid var(--accent-color, #7c3aed)',
                }} />
                {!isLast && (
                  <div style={{ flex: 1, width: 2, background: 'var(--border-color)', minHeight: 20 }} />
                )}
              </div>
              {/* 内容区 */}
              <div style={{ flex: 1, paddingRight: 12, paddingBottom: 4 }}>
                {/* 标题行 */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    padding: '8px 0 4px',
                  }}
                  onClick={() => toggleCp(cp.msgIdx)}
                >
                  {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'monospace' }}>
                    {fmtTime(cp.timestamp)}
                  </span>
                  <span style={{
                    fontSize: 11, background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)', borderRadius: 4,
                    padding: '1px 5px', color: 'var(--text-secondary)', flexShrink: 0,
                  }}>
                    {toolLabel(cp.primaryTool)}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>
                    {cp.entries.length} 个文件变更
                  </span>
                  {/* 回滚按钮 */}
                  {rs === 'restoring' ? (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>回滚中…</span>
                  ) : rs === 'done' ? (
                    <span style={{ fontSize: 11, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <CheckCircle size={11} /> 已回滚
                    </span>
                  ) : rs === 'error' ? (
                    <span style={{ fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <AlertTriangle size={11} /> 失败
                    </span>
                  ) : (
                    <button
                      className="btn"
                      onClick={(e) => { e.stopPropagation(); setConfirmCp(cp); }}
                      style={{ fontSize: 11, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}
                    >
                      <RotateCcw size={10} />
                      回滚到此点
                    </button>
                  )}
                </div>

                {/* 展开：该 checkpoint 的文件列表 */}
                {expanded && (
                  <div style={{ paddingLeft: 4, paddingBottom: 6 }}>
                    {cp.entries.map((entry) => (
                      <div
                        key={entry.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '3px 0', fontSize: 11, color: 'var(--text-secondary)',
                        }}
                      >
                        <FileCode size={11} style={{ flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.filePath}>
                          {shortPath(entry.filePath)}
                        </span>
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                          {(entry.originalContent.length / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 回滚确认弹窗 */}
      {confirmCp && (() => {
        const toRestore = getEntriesAfter(confirmCp);
        const targets = toRestore.length > 0 ? toRestore : confirmCp.entries;
        // 去重：同一文件取最早的快照
        const uniqueFiles = Array.from(
          new Map(targets.map(e => [e.filePath, e])).values()
        );
        return (
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
            }}
            onClick={() => setConfirmCp(null)}
          >
            <div
              style={{
                background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                borderRadius: 10, padding: 24, maxWidth: 460, width: '90%',
                boxShadow: 'var(--shadow-lg)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <AlertTriangle size={18} color="#d4a017" />
                <span style={{ fontWeight: 600, fontSize: 14 }}>确认回滚到此快照点？</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                以下 {uniqueFiles.length} 个文件将被还原到 {fmtTime(confirmCp.timestamp)} 操作前的状态：
              </div>
              <div style={{
                maxHeight: 160, overflowY: 'auto',
                background: 'var(--bg-secondary)', borderRadius: 6,
                padding: '6px 10px', marginBottom: 12,
              }}>
                {uniqueFiles.map(e => (
                  <div key={e.id} style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--accent-color)', padding: '2px 0', wordBreak: 'break-all' }}>
                    {shortPath(e.filePath)}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
                此操作不可撤销。文件将被覆盖为快照时的内容。
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => setConfirmCp(null)} style={{ fontSize: 12 }}>取消</button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleRollback(confirmCp)}
                  style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <RotateCcw size={12} />
                  确认回滚
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
