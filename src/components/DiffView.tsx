/**
 * 公共 Diff 可视化组件
 * 供 ToolCallCard（ChatPanel）和 ToolCallView 共用
 *
 * 导出：
 *   computeLineDiff      — 行级 diff 计算
 *   InlineDiff           — Unified diff 展示
 *   SideBySideDiff       — Side-by-Side diff 展示
 *   DiffViewer           — 带 Unified/Side-by-Side 模式切换的组合组件
 *   WritePreview         — Write 工具新内容预览
 *   WriteDiff            — Write 工具 diff（使用 DiffViewer）
 */
import { useState } from 'react';

/** Side-by-side 对齐行类型 */
interface SideBySideRow {
  type: 'ctx' | 'change' | 'del' | 'add';
  leftLine?: number;
  leftText?: string;
  rightLine?: number;
  rightText?: string;
}

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

/** Write 工具：原内容 vs 新内容 diff（使用 DiffViewer，支持模式切换） */
export function WriteDiff({ originalContent, newContent }: { originalContent: string; newContent: string }) {
  return <DiffViewer oldStr={originalContent} newStr={newContent} />;
}

// ─── Side-by-Side Diff ────────────────────────────────────────────

/**
 * 将 computeLineDiff 结果对齐为 side-by-side 行对
 * del 行与 add 行按数量配对（change）；多余的一侧单独显示
 */
function buildSideBySideRows(oldText: string, newText: string): SideBySideRow[] {
  const lines = computeLineDiff(oldText, newText);
  const rows: SideBySideRow[] = [];
  let leftLine = 1;
  let rightLine = 1;
  let i = 0;

  while (i < lines.length) {
    const l = lines[i];
    if (l.type === 'ctx') {
      rows.push({ type: 'ctx', leftLine, leftText: l.text, rightLine, rightText: l.text });
      leftLine++;
      rightLine++;
      i++;
    } else {
      // 收集连续的 del / add 块
      const dels: string[] = [];
      const adds: string[] = [];
      while (i < lines.length && lines[i].type !== 'ctx') {
        if (lines[i].type === 'del') dels.push(lines[i].text);
        else if (lines[i].type === 'add') adds.push(lines[i].text);
        i++;
      }
      // 两侧按数量配对
      const maxLen = Math.max(dels.length, adds.length);
      for (let j = 0; j < maxLen; j++) {
        const hasDel = j < dels.length;
        const hasAdd = j < adds.length;
        if (hasDel && hasAdd) {
          rows.push({ type: 'change', leftLine: leftLine++, leftText: dels[j], rightLine: rightLine++, rightText: adds[j] });
        } else if (hasDel) {
          rows.push({ type: 'del', leftLine: leftLine++, leftText: dels[j] });
        } else {
          rows.push({ type: 'add', rightLine: rightLine++, rightText: adds[j] });
        }
      }
    }
  }
  return rows;
}

/** Side-by-Side Diff 展示：左列原始，右列修改后 */
export function SideBySideDiff({ oldStr, newStr }: { oldStr: string; newStr: string }) {
  const rows = buildSideBySideRows(oldStr, newStr);
  if (rows.length === 0) {
    return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>内容相同</span>;
  }

  const lineNumStyle: React.CSSProperties = {
    width: 32,
    minWidth: 32,
    textAlign: 'right',
    paddingRight: 6,
    paddingLeft: 4,
    color: 'var(--text-muted)',
    userSelect: 'none',
    fontSize: 10,
    opacity: 0.6,
    flexShrink: 0,
  };

  const cellStyle = (bg: string): React.CSSProperties => ({
    width: '50%',
    display: 'flex',
    alignItems: 'flex-start',
    background: bg,
    overflow: 'hidden',
  });

  const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: '0 8px 0 2px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    minWidth: 0,
  };

  return (
    <div style={{
      fontFamily: 'monospace',
      fontSize: 11,
      lineHeight: 1.5,
      borderRadius: 4,
      overflow: 'auto',
      maxHeight: 400,
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-color)',
    }}>
      {/* 列头 */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', opacity: 0.5 }}>
        <div style={{ ...cellStyle('transparent'), padding: '2px 0' }}>
          <span style={{ ...lineNumStyle }} />
          <span style={{ ...contentStyle, color: 'var(--text-muted)', fontSize: 10 }}>原始</span>
        </div>
        <div style={{ ...cellStyle('transparent'), borderLeft: '1px solid var(--border-color)', padding: '2px 0' }}>
          <span style={{ ...lineNumStyle }} />
          <span style={{ ...contentStyle, color: 'var(--text-muted)', fontSize: 10 }}>修改后</span>
        </div>
      </div>

      {rows.map((row, idx) => {
        // 左侧背景色
        const leftBg =
          row.type === 'del' ? 'rgba(218,54,51,0.12)' :
          row.type === 'change' ? 'rgba(218,54,51,0.12)' :
          'transparent';
        // 右侧背景色
        const rightBg =
          row.type === 'add' ? 'rgba(35,134,54,0.12)' :
          row.type === 'change' ? 'rgba(35,134,54,0.12)' :
          'transparent';
        // 左侧文字色
        const leftColor =
          (row.type === 'del' || row.type === 'change') ? 'var(--error-text)' : 'var(--text-secondary)';
        // 右侧文字色
        const rightColor =
          (row.type === 'add' || row.type === 'change') ? 'var(--success-text)' : 'var(--text-secondary)';
        // 左侧符号
        const leftSym = row.type === 'del' ? '-' : row.type === 'change' ? '-' : ' ';
        // 右侧符号
        const rightSym = row.type === 'add' ? '+' : row.type === 'change' ? '+' : ' ';

        return (
          <div key={idx} style={{ display: 'flex' }}>
            {/* 左列 */}
            <div style={cellStyle(leftBg)}>
              <span style={{ ...lineNumStyle, color: leftColor }}>
                {row.leftLine ?? ''}
              </span>
              <span style={{ ...contentStyle, color: leftColor }}>
                <span style={{ userSelect: 'none', opacity: 0.5, marginRight: 6 }}>{leftSym}</span>
                {row.leftText ?? ''}
              </span>
            </div>
            {/* 右列 */}
            <div style={{ ...cellStyle(rightBg), borderLeft: '1px solid var(--border-color)' }}>
              <span style={{ ...lineNumStyle, color: rightColor }}>
                {row.rightLine ?? ''}
              </span>
              <span style={{ ...contentStyle, color: rightColor }}>
                <span style={{ userSelect: 'none', opacity: 0.5, marginRight: 6 }}>{rightSym}</span>
                {row.rightText ?? ''}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── DiffViewer：带模式切换的组合组件 ────────────────────────────

type DiffMode = 'unified' | 'split';

/** Diff 可视化组合组件，支持 Unified / Side-by-Side 切换 */
export function DiffViewer({ oldStr, newStr, defaultMode = 'unified' }: {
  oldStr: string;
  newStr: string;
  /** 默认展示模式，可选 'unified' 或 'split' */
  defaultMode?: DiffMode;
}) {
  const [mode, setMode] = useState<DiffMode>(() => {
    try {
      return (localStorage.getItem('diffViewerMode') as DiffMode) ?? defaultMode;
    } catch {
      return defaultMode;
    }
  });

  function handleSetMode(m: DiffMode) {
    setMode(m);
    try { localStorage.setItem('diffViewerMode', m); } catch { /* ignore */ }
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '1px 8px',
    fontSize: 10,
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    cursor: 'pointer',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)',
    lineHeight: '18px',
    transition: 'all 0.15s',
  });

  return (
    <div>
      {/* 模式切换 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 4, justifyContent: 'flex-end' }}>
        <button style={btnStyle(mode === 'unified')} onClick={() => handleSetMode('unified')}>Unified</button>
        <button style={btnStyle(mode === 'split')} onClick={() => handleSetMode('split')}>Side-by-Side</button>
      </div>
      {mode === 'unified'
        ? <InlineDiff oldStr={oldStr} newStr={newStr} />
        : <SideBySideDiff oldStr={oldStr} newStr={newStr} />
      }
    </div>
  );
}
