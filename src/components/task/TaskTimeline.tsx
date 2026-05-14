/**
 * TaskTimeline — 紧凑执行时序面板（v3.0 左栏顶部）
 * 按工具调用顺序展示本次会话的所有工具执行记录
 * 可折叠，自动滚动到最新记录
 */
import { useMemo, useRef, useEffect, useState } from 'react';
import {
  Check, X, Loader2, ChevronDown, ChevronUp,
  FileText, FilePlus, FileEdit, Terminal, Search,
  Folder, Globe, ListChecks, Circle,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { ToolCall } from '../../types';

/** 工具名 → 友好显示名 + 图标 */
const TOOL_META: Record<string, { label: string; Icon: React.FC<{ size?: number }> }> = {
  Read:                     { label: 'Read',    Icon: FileText },
  read_file:                { label: 'Read',    Icon: FileText },
  Write:                    { label: 'Write',   Icon: FilePlus },
  write_file:               { label: 'Write',   Icon: FilePlus },
  Edit:                     { label: 'Edit',    Icon: FileEdit },
  edit_file:                { label: 'Edit',    Icon: FileEdit },
  str_replace_editor:       { label: 'Edit',    Icon: FileEdit },
  str_replace_based_edit_tool: { label: 'Edit', Icon: FileEdit },
  MultiEdit:                { label: 'MultiEdit', Icon: FileEdit },
  multiedit:                { label: 'MultiEdit', Icon: FileEdit },
  Bash:                     { label: 'Bash',    Icon: Terminal },
  bash:                     { label: 'Bash',    Icon: Terminal },
  Grep:                     { label: 'Grep',    Icon: Search },
  grep:                     { label: 'Grep',    Icon: Search },
  Glob:                     { label: 'Glob',    Icon: Search },
  glob:                     { label: 'Glob',    Icon: Search },
  LS:                       { label: 'LS',      Icon: Folder },
  ls:                       { label: 'LS',      Icon: Folder },
  WebSearch:                { label: 'Search',  Icon: Globe },
  web_search:               { label: 'Search',  Icon: Globe },
  TodoRead:                 { label: 'Tasks',   Icon: ListChecks },
  TodoWrite:                { label: 'Tasks',   Icon: ListChecks },
  todo_read:                { label: 'Tasks',   Icon: ListChecks },
  todo_write:               { label: 'Tasks',   Icon: ListChecks },
};

/** 从工具调用参数提取关键路径/命令摘要 */
function getPathOrCmd(tc: ToolCall): string {
  const args = tc.arguments ?? {};
  const fp = (args['file_path'] ?? args['path'] ?? args['filename'] ?? '') as string;
  if (fp) {
    const parts = fp.replace(/\\/g, '/').split('/');
    return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : fp;
  }
  const cmd = (args['command'] ?? '') as string;
  if (cmd) return cmd.length > 40 ? cmd.slice(0, 40) + '…' : cmd;
  const pattern = (args['pattern'] ?? args['glob'] ?? '') as string;
  if (pattern) return pattern;
  return '';
}

/** 单个时序行 */
function TimelineRow({ tc }: { tc: ToolCall }) {
  const meta = TOOL_META[tc.name] ?? { label: tc.name, Icon: Circle };
  const pathOrCmd = getPathOrCmd(tc);
  const isPending = tc.status === 'pending';
  const isError = tc.status === 'error';
  const isSuccess = tc.status === 'success';

  return (
    <div
      className="task-timeline-row"
      title={`${tc.name}${pathOrCmd ? ` — ${pathOrCmd}` : ''}`}
    >
      {/* 状态图标 */}
      <span className={`task-timeline-status ${isPending ? 'running' : isError ? 'error' : 'done'}`}>
        {isPending
          ? <Loader2 size={10} className="spin-anim" />
          : isError
            ? <X size={10} />
            : <Check size={10} />}
      </span>

      {/* 工具名 */}
      <span className="task-timeline-tool">
        <meta.Icon size={10} />
        <span>{meta.label}</span>
      </span>

      {/* 路径/命令 */}
      {pathOrCmd && (
        <code className={`task-timeline-path ${isError ? 'error' : isSuccess ? '' : 'muted'}`}>
          {pathOrCmd}
        </code>
      )}
    </div>
  );
}

export function TaskTimeline() {
  const messages = useAppStore((s) => s.messages);
  const [collapsed, setCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  /** 从所有消息中提取全部工具调用（保持原始顺序） */
  const allToolCalls = useMemo<ToolCall[]>(() => {
    const result: ToolCall[] = [];
    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.toolCalls) {
        result.push(...msg.toolCalls);
      }
    }
    return result;
  }, [messages]);

  const pendingCount = allToolCalls.filter((tc) => tc.status === 'pending').length;
  const doneCount = allToolCalls.filter((tc) => tc.status === 'success').length;
  const errorCount = allToolCalls.filter((tc) => tc.status === 'error').length;

  /** 有新调用时自动滚动到最新 */
  useEffect(() => {
    if (!collapsed && allToolCalls.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [allToolCalls.length, collapsed]);

  // 没有工具调用时不显示（对话初始状态）
  if (allToolCalls.length === 0) return null;

  return (
    <div className={`task-timeline ${collapsed ? 'collapsed' : ''}`}>
      {/* 标题栏：折叠控制 + 统计 */}
      <div
        className="task-timeline-header"
        onClick={() => setCollapsed((v) => !v)}
        role="button"
        aria-expanded={!collapsed}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setCollapsed((v) => !v)}
      >
        <div className="task-timeline-header-left">
          {pendingCount > 0 && <span className="task-timeline-running-dot" />}
          <span className="task-timeline-title">执行时序</span>
          <span className="task-timeline-badge">
            {doneCount}/{allToolCalls.length}
            {errorCount > 0 && <span className="task-timeline-badge-err"> · {errorCount} 错误</span>}
          </span>
          {pendingCount > 0 && (
            <span className="task-timeline-running-label">运行中</span>
          )}
        </div>
        <button
          className="task-timeline-collapse-btn"
          onClick={(e) => { e.stopPropagation(); setCollapsed((v) => !v); }}
          aria-label={collapsed ? '展开执行时序' : '折叠执行时序'}
        >
          {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
      </div>

      {/* 时序列表（可滚动） */}
      {!collapsed && (
        <div className="task-timeline-body">
          {allToolCalls.map((tc) => (
            <TimelineRow key={tc.id} tc={tc} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
