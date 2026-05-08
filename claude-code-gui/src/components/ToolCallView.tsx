import { useAppStore } from '../stores/useAppStore';
import { Wrench, CheckCircle, XCircle, Clock, ChevronDown, ChevronRight, FileDiff } from 'lucide-react';
import { useState } from 'react';

/** 简单行级 diff：返回带标记的行数组 */
function computeLineDiff(oldText: string, newText: string): Array<{ type: 'del' | 'add' | 'ctx'; text: string }> {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: Array<{ type: 'del' | 'add' | 'ctx'; text: string }> = [];

  // 找公共前缀
  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) {
    start++;
  }
  // 找公共后缀
  let endOld = oldLines.length - 1;
  let endNew = newLines.length - 1;
  while (endOld >= start && endNew >= start && oldLines[endOld] === newLines[endNew]) {
    endOld--;
    endNew--;
  }

  const CTX = 2; // 上下文行数
  const ctxStart = Math.max(0, start - CTX);
  for (let i = ctxStart; i < start; i++) result.push({ type: 'ctx', text: oldLines[i] });

  for (let i = start; i <= endOld; i++) result.push({ type: 'del', text: oldLines[i] });
  for (let i = start; i <= endNew; i++) result.push({ type: 'add', text: newLines[i] });

  const ctxEnd = Math.min(endOld + CTX + 1, oldLines.length);
  for (let i = endOld + 1; i < ctxEnd; i++) result.push({ type: 'ctx', text: oldLines[i] });

  return result;
}

/** Edit 工具的 diff 展示 */
function InlineDiff({ oldStr, newStr }: { oldStr: string; newStr: string }) {
  const lines = computeLineDiff(oldStr, newStr);
  if (lines.length === 0) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>内容相同</span>;

  return (
    <div style={{
      fontFamily: 'monospace',
      fontSize: 11,
      lineHeight: 1.5,
      borderRadius: 4,
      overflow: 'auto',
      maxHeight: 300,
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-color)',
    }}>
      {lines.map((l, i) => (
        <div key={i} style={{
          padding: '0 8px',
          background: l.type === 'del'
            ? 'rgba(218, 54, 51, 0.15)'
            : l.type === 'add'
            ? 'rgba(35, 134, 54, 0.15)'
            : 'transparent',
          color: l.type === 'del'
            ? 'var(--error-text)'
            : l.type === 'add'
            ? 'var(--success-text)'
            : 'var(--text-secondary)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}>
          <span style={{ userSelect: 'none', opacity: 0.5, marginRight: 8 }}>
            {l.type === 'del' ? '-' : l.type === 'add' ? '+' : ' '}
          </span>
          {l.text}
        </div>
      ))}
    </div>
  );
}

/** Write 工具新内容预览 */
function WritePreview({ content }: { content: string }) {
  const lines = content.split('\n');
  const preview = lines.slice(0, 30).join('\n');
  const truncated = lines.length > 30;
  return (
    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
      <pre style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: 4,
        padding: '6px 8px',
        overflow: 'auto',
        maxHeight: 200,
        fontFamily: 'monospace',
        lineHeight: 1.5,
        margin: 0,
        color: 'var(--text-secondary)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}>
        {preview}
        {truncated && `\n... 共 ${lines.length} 行（仅显示前 30 行）`}
      </pre>
    </div>
  );
}

/** Write 工具原始内容 vs 新内容 diff */
function WriteDiff({ originalContent, newContent }: { originalContent: string; newContent: string }) {
  return <InlineDiff oldStr={originalContent} newStr={newContent} />;
}

export function ToolCallView() {
  const { messages } = useAppStore();
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());

  // Extract tool calls from messages
  const toolCalls = messages
    .flatMap((msg) => msg.toolCalls || [])
    .filter(Boolean);

  const toggleExpanded = (id: string) => {
    setExpandedCalls((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={14} color="var(--success-text)" />;
      case 'error':
        return <XCircle size={14} color="var(--error-text)" />;
      default:
        return <Clock size={14} color="var(--warning)" />;
    }
  };

  if (toolCalls.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          gap: 12,
          textAlign: 'center',
        }}
      >
        <Wrench size={32} strokeWidth={1} />
        <p style={{ fontSize: 13 }}>
          暂无工具调用记录
          <br />
          <span style={{ fontSize: 12 }}>与 Claude 交互时，工具调用将显示在这里</span>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          padding: '8px 12px',
          fontSize: 11,
          color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: 4,
        }}
      >
        共 {toolCalls.length} 次工具调用
      </div>

      {toolCalls.map((call) => {
        const isExpanded = expandedCalls.has(call.id);
        return (
          <div
            key={call.id}
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                background: 'var(--bg-tertiary)',
              }}
              onClick={() => toggleExpanded(call.id)}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>

              {getStatusIcon(call.status)}

              <span style={{ fontWeight: 500, fontSize: 13, flex: 1 }}>
                {call.name}
              </span>

              <span
                style={{
                  fontSize: 11,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background:
                    call.status === 'success'
                      ? 'rgba(35, 134, 54, 0.2)'
                      : call.status === 'error'
                      ? 'rgba(218, 54, 51, 0.2)'
                      : 'rgba(210, 153, 34, 0.2)',
                  color:
                    call.status === 'success'
                      ? 'var(--success-text)'
                      : call.status === 'error'
                      ? 'var(--error-text)'
                      : 'var(--warning)',
                }}
              >
                {call.status === 'success' ? '成功' : call.status === 'error' ? '失败' : '执行中'}
              </span>
            </div>

            {isExpanded && (
              <div style={{ padding: 12, fontSize: 12 }}>
                {/* 文件变更 Diff 区域 */}
                {call.name === 'Edit' && call.arguments?.old_string !== undefined && call.arguments?.new_string !== undefined && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', marginBottom: 6, fontSize: 11 }}>
                      <FileDiff size={12} />
                      <span>文件变更 — <code style={{ fontSize: 10 }}>{String(call.arguments.file_path || call.arguments.path || '')}</code></span>
                    </div>
                    <InlineDiff oldStr={String(call.arguments.old_string)} newStr={String(call.arguments.new_string)} />
                  </div>
                )}
                {call.name === 'MultiEdit' && Array.isArray(call.arguments?.edits) && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', marginBottom: 6, fontSize: 11 }}>
                      <FileDiff size={12} />
                      <span>多段变更 — <code style={{ fontSize: 10 }}>{String(call.arguments.file_path || call.arguments.path || '')}</code></span>
                    </div>
                    {(call.arguments.edits as Array<{ old_string: string; new_string: string }>).map((edit, idx) => (
                      <div key={idx} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>变更 {idx + 1}</div>
                        <InlineDiff oldStr={edit.old_string ?? ''} newStr={edit.new_string ?? ''} />
                      </div>
                    ))}
                  </div>
                )}
                {call.name === 'Write' && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', marginBottom: 6, fontSize: 11 }}>
                      <FileDiff size={12} />
                      <span>
                        {call.originalContent !== undefined ? '文件变更' : '写入内容'} — <code style={{ fontSize: 10 }}>{String(call.arguments.file_path || call.arguments.path || '')}</code>
                      </span>
                    </div>
                    {call.originalContent !== undefined && call.arguments.content !== undefined
                      ? <WriteDiff originalContent={call.originalContent} newContent={String(call.arguments.content)} />
                      : call.arguments.content !== undefined && <WritePreview content={String(call.arguments.content)} />
                    }
                  </div>
                )}

                <div style={{ marginBottom: 8 }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>参数:</div>
                  <pre
                    style={{
                      background: 'var(--bg-primary)',
                      padding: 8,
                      borderRadius: 4,
                      overflow: 'auto',
                      maxHeight: 200,
                    }}
                  >
                    {JSON.stringify(call.arguments, null, 2)}
                  </pre>
                </div>

                {call.result && (
                  <div>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>结果:</div>
                    <pre
                      style={{
                        background: 'var(--bg-primary)',
                        padding: 8,
                        borderRadius: 4,
                        overflow: 'auto',
                        maxHeight: 300,
                      }}
                    >
                      {call.result}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
