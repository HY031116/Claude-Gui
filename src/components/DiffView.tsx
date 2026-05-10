/**
 * 公共 Diff 可视化组件
 * 供 ToolCallCard（ChatPanel）和 ToolCallView 共用
 */

/** 简单行级 diff：返回带标记的行数组 */
export function computeLineDiff(
  oldText: string,
  newText: string
): Array<{ type: 'del' | 'add' | 'ctx'; text: string }> {
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

/** 行级 Diff 展示（红删 / 绿增 / 灰上下文） */
export function InlineDiff({ oldStr, newStr }: { oldStr: string; newStr: string }) {
  const lines = computeLineDiff(oldStr, newStr);
  if (lines.length === 0) {
    return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>内容相同</span>;
  }

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
        <div
          key={i}
          style={{
            padding: '0 8px',
            background:
              l.type === 'del' ? 'rgba(218,54,51,0.15)' :
              l.type === 'add' ? 'rgba(35,134,54,0.15)' :
              'transparent',
            color:
              l.type === 'del' ? 'var(--error-text)' :
              l.type === 'add' ? 'var(--success-text)' :
              'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          <span style={{ userSelect: 'none', opacity: 0.5, marginRight: 8 }}>
            {l.type === 'del' ? '-' : l.type === 'add' ? '+' : ' '}
          </span>
          {l.text}
        </div>
      ))}
    </div>
  );
}

/** Write 工具新内容预览（仅展示前 30 行） */
export function WritePreview({ content }: { content: string }) {
  const lines = content.split('\n');
  const preview = lines.slice(0, 30).join('\n');
  const truncated = lines.length > 30;
  return (
    <pre style={{
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-color)',
      borderRadius: 4,
      padding: '6px 8px',
      overflow: 'auto',
      maxHeight: 200,
      fontFamily: 'monospace',
      fontSize: 11,
      lineHeight: 1.5,
      margin: 0,
      color: 'var(--text-secondary)',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
    }}>
      {preview}
      {truncated && `\n... 共 ${lines.length} 行（仅显示前 30 行）`}
    </pre>
  );
}

/** Write 工具：原内容 vs 新内容 diff */
export function WriteDiff({ originalContent, newContent }: { originalContent: string; newContent: string }) {
  return <InlineDiff oldStr={originalContent} newStr={newContent} />;
}
