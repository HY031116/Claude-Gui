/**
 * 公共 Diff 可视化组件
 * 供 ToolCallCard（ChatPanel）和 ToolCallView 共用
 *
 * 导出：
 *   computeLineDiff      — 行级 diff 计算（LCS 多 hunk，sep 折叠上下文）
 *   InlineDiff           — Unified diff 展示（带 hunk 标记）
 *   SideBySideDiff       — Side-by-Side diff 展示（带 hunk 标记）
 *   DiffViewer           — 带 Unified/Side-by-Side 模式切换 + Chunk 导航
 *   WritePreview         — Write 工具新内容预览
 *   WriteDiff            — Write 工具 diff（使用 DiffViewer）
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

/** Diff 行类型（sep 表示被折叠的上下文行，text 为跳过的行数） */
export type DiffLineType = 'del' | 'add' | 'ctx' | 'sep';
export interface DiffLine { type: DiffLineType; text: string; }

/** Side-by-side 对齐行类型 */
interface SideBySideRow {
  type: 'ctx' | 'change' | 'del' | 'add' | 'sep';
  leftLine?: number;
  leftText?: string;
  rightLine?: number;
  rightText?: string;
}

// ─── LCS 多 Hunk diff 实现 ─────────────────────────────────────────────────────
const CTX = 3; // 每个 hunk 保留上下文行数

/** 属于进阶文件时降级为单块算法（避免 O(n*m) 内存） */
function computeSimple(oldLines: string[], newLines: string[]): DiffLine[] {
  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++;
  let endOld = oldLines.length - 1;
  let endNew = newLines.length - 1;
  while (endOld >= start && endNew >= start && oldLines[endOld] === newLines[endNew]) { endOld--; endNew--; }

  const result: DiffLine[] = [];
  const ctxStart = Math.max(0, start - CTX);
  if (ctxStart > 0) result.push({ type: 'sep', text: String(ctxStart) });
  for (let i = ctxStart; i < start; i++) result.push({ type: 'ctx', text: oldLines[i] });
  for (let i = start; i <= endOld; i++) result.push({ type: 'del', text: oldLines[i] });
  for (let i = start; i <= endNew; i++) result.push({ type: 'add', text: newLines[i] });
  const ctxEnd = Math.min(endOld + CTX + 1, oldLines.length);
  for (let i = endOld + 1; i < ctxEnd; i++) result.push({ type: 'ctx', text: oldLines[i] });
  if (ctxEnd < oldLines.length) result.push({ type: 'sep', text: String(oldLines.length - ctxEnd) });
  return result;
}

/** LCS 追踪表 DP */
function computeLCS(a: string[], b: string[]): DiffLine[] {
  const n = a.length, m = b.length;
  const W = m + 1;
  const dp = new Int32Array((n + 1) * W);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i * W + j] = a[i - 1] === b[j - 1]
        ? dp[(i - 1) * W + (j - 1)] + 1
        : Math.max(dp[(i - 1) * W + j], dp[i * W + (j - 1)]);
    }
  }
  // 迭代回溯
  const raw: Array<{ type: 'del' | 'add' | 'ctx'; text: string }> = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      raw.unshift({ type: 'ctx', text: a[i - 1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i * W + (j - 1)] >= dp[(i - 1) * W + j])) {
      raw.unshift({ type: 'add', text: b[j - 1] }); j--;
    } else {
      raw.unshift({ type: 'del', text: a[i - 1] }); i--;
    }
  }
  // 收缩远程上下文为 sep
  const keep = new Uint8Array(raw.length);
  for (let k = 0; k < raw.length; k++) {
    if (raw[k].type !== 'ctx') {
      for (let c = Math.max(0, k - CTX); c <= Math.min(raw.length - 1, k + CTX); c++) keep[c] = 1;
    }
  }
  const result: DiffLine[] = [];
  let skipCount = 0;
  for (let k = 0; k < raw.length; k++) {
    if (keep[k]) {
      if (skipCount > 0) { result.push({ type: 'sep', text: String(skipCount) }); skipCount = 0; }
      result.push(raw[k] as DiffLine);
    } else { skipCount++; }
  }
  if (skipCount > 0) result.push({ type: 'sep', text: String(skipCount) });
  return result;
}

/**
 * 行级 diff：返回带标记的行数组（支持多 hunk）
 * 小文件（n*m≪250k）用 LCS，大文件降级为单块算法
 */
export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  if (oldLines.length * newLines.length > 250_000) {
    return computeSimple(oldLines, newLines);
  }
  return computeLCS(oldLines, newLines);
}

/** 行级 Diff 展示（红删 / 绿增 / 灰上下文，sep 行显示为折叠分隔符）
 *  - startLineOld / startLineNew：hunk 在原文件/新文件中的起始行号（1-based），用于计算绝对行号
 *  - onLineClick：点击行号时回调（传入新文件行号，del 行不触发）
 */
export function InlineDiff({ oldStr, newStr, startLineOld = 1, startLineNew = 1, onLineClick }: {
  oldStr: string; newStr: string;
  startLineOld?: number; startLineNew?: number;
  onLineClick?: (lineNum: number) => void;
}) {
  const lines = computeLineDiff(oldStr, newStr);
  if (lines.length === 0) {
    return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>内容相同</span>;
  }

  // 在 map 迭代中累计行号（外部变量，渲染期确定性赋值）
  let oldLine = startLineOld;
  let newLine = startLineNew;

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
      {lines.map((l, i) => {
        if (l.type === 'sep') {
          const skipped = parseInt(l.text, 10) || 0;
          oldLine += skipped;
          newLine += skipped;
          return (
            <div key={i} style={{
              padding: '2px 8px',
              background: 'var(--bg-secondary)',
              color: 'var(--text-muted)',
              fontSize: 10,
              borderTop: '1px dashed var(--border-color)',
              borderBottom: '1px dashed var(--border-color)',
              userSelect: 'none',
            }}>... {l.text} 行未显示 ...</div>
          );
        }
        // hunk 起始标记
        const isHunkStart = (l.type === 'del' || l.type === 'add') &&
          (i === 0 || lines[i - 1].type === 'ctx' || lines[i - 1].type === 'sep');

        // 计算显示行号与跳转行号
        let displayLineNum: number | undefined;
        let clickLineNum: number | undefined;
        if (l.type === 'ctx') {
          displayLineNum = newLine;
          clickLineNum = newLine;
          oldLine++; newLine++;
        } else if (l.type === 'del') {
          displayLineNum = oldLine++;
          // 该行已被删除，不提供跳转
        } else if (l.type === 'add') {
          displayLineNum = newLine;
          clickLineNum = newLine;
          newLine++;
        }

        const canClick = clickLineNum !== undefined && onLineClick !== undefined;
        return (
          <div
            key={i}
            data-hunk-start={isHunkStart ? 'true' : undefined}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              background:
                l.type === 'del' ? 'rgba(218,54,51,0.15)' :
                l.type === 'add' ? 'rgba(35,134,54,0.15)' :
                'transparent',
              color:
                l.type === 'del' ? 'var(--error-text)' :
                l.type === 'add' ? 'var(--success-text)' :
                'var(--text-secondary)',
            }}
          >
            {/* 行号 gutter */}
            <span
              onClick={canClick ? () => onLineClick!(clickLineNum!) : undefined}
              title={canClick ? `在编辑器中打开第 ${clickLineNum} 行` : undefined}
              style={{
                width: 32,
                minWidth: 32,
                textAlign: 'right',
                padding: '0 6px 0 4px',
                color: 'var(--text-muted)',
                userSelect: 'none',
                fontSize: 10,
                opacity: 0.6,
                flexShrink: 0,
                cursor: canClick ? 'pointer' : 'default',
                transition: 'opacity 0.15s',
              }}
            >
              {displayLineNum ?? ''}
            </span>
            {/* +/- 前缀 */}
            <span style={{ userSelect: 'none', opacity: 0.5, marginRight: 6, flexShrink: 0 }}>
              {l.type === 'del' ? '-' : l.type === 'add' ? '+' : ' '}
            </span>
            {/* 内容 */}
            <span style={{ flex: 1, minWidth: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', paddingRight: 8 }}>
              {l.text}
            </span>
          </div>
        );
      })}
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
export function WriteDiff({ originalContent, newContent, onLineClick }: {
  originalContent: string; newContent: string;
  onLineClick?: (lineNum: number) => void;
}) {
  return <DiffViewer oldStr={originalContent} newStr={newContent} onLineClick={onLineClick} />;
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
    if (l.type === 'sep') {
      rows.push({ type: 'sep', leftText: l.text });
      i++;
    } else if (l.type === 'ctx') {
      rows.push({ type: 'ctx', leftLine, leftText: l.text, rightLine, rightText: l.text });
      leftLine++;
      rightLine++;
      i++;
    } else {
      // 收集连续的 del / add 块
      const dels: string[] = [];
      const adds: string[] = [];
      while (i < lines.length && lines[i].type !== 'ctx' && lines[i].type !== 'sep') {
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

/** Side-by-Side Diff 展示：左列原始，右列修改后
 *  - startLineOld / startLineNew：偏移量（default 1），叠加到行号显示
 *  - onLineClick：点击行号时回调（传入新文件行号）
 */
export function SideBySideDiff({ oldStr, newStr, startLineOld = 1, startLineNew = 1, onLineClick }: {
  oldStr: string; newStr: string;
  startLineOld?: number; startLineNew?: number;
  onLineClick?: (lineNum: number) => void;
}) {
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
        // sep 折叠行
        if (row.type === 'sep') {
          return (
            <div key={idx} style={{
              display: 'flex',
              background: 'var(--bg-secondary)',
              borderTop: '1px dashed var(--border-color)',
              borderBottom: '1px dashed var(--border-color)',
            }}>
              <div style={{ ...cellStyle('transparent'), padding: '2px 8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 10, userSelect: 'none' }}>
                  ... {row.leftText} 行未显示 ...
                </span>
              </div>
              <div style={{ ...cellStyle('transparent'), borderLeft: '1px solid var(--border-color)', padding: '2px 8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 10, userSelect: 'none' }}>
                  ... {row.leftText} 行未显示 ...
                </span>
              </div>
            </div>
          );
        }

        // hunk 起始行：这是 del/add/change，且上一行是 ctx/sep 或是第一行
        const isHunkStart = (row.type === 'del' || row.type === 'add' || row.type === 'change') &&
          (idx === 0 || rows[idx - 1].type === 'ctx' || rows[idx - 1].type === 'sep');

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

        // 计算绝对行号（加偏移量）
        const absLeftLine = row.leftLine !== undefined ? row.leftLine + startLineOld - 1 : undefined;
        const absRightLine = row.rightLine !== undefined ? row.rightLine + startLineNew - 1 : undefined;
        // 右侧行可以跳转（ctx / add / change 的新文件行）
        const canClickRight = absRightLine !== undefined && onLineClick !== undefined &&
          (row.type === 'ctx' || row.type === 'add' || row.type === 'change');

        return (
          <div key={idx} style={{ display: 'flex' }} data-hunk-start={isHunkStart ? 'true' : undefined}>
            {/* 左列 */}
            <div style={cellStyle(leftBg)}>
              <span style={{ ...lineNumStyle, color: leftColor }}>
                {absLeftLine ?? ''}
              </span>
              <span style={{ ...contentStyle, color: leftColor }}>
                <span style={{ userSelect: 'none', opacity: 0.5, marginRight: 6 }}>{leftSym}</span>
                {row.leftText ?? ''}
              </span>
            </div>
            {/* 右列 */}
            <div style={{ ...cellStyle(rightBg), borderLeft: '1px solid var(--border-color)' }}>
              <span
                onClick={canClickRight ? () => onLineClick!(absRightLine!) : undefined}
                title={canClickRight ? `在编辑器中打开第 ${absRightLine} 行` : undefined}
                style={{
                  ...lineNumStyle,
                  color: rightColor,
                  cursor: canClickRight ? 'pointer' : 'default',
                }}
              >
                {absRightLine ?? ''}
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

// ─── DiffViewer：带模式切换 + Chunk 导航的组合组件 ──────────────

type DiffMode = 'unified' | 'split';

/** Diff 可视化组合组件，支持 Unified / Side-by-Side 切换，以及 Chunk 导航 */
export function DiffViewer({ oldStr, newStr, defaultMode = 'unified', startLineOld, startLineNew, onLineClick }: {
  oldStr: string;
  newStr: string;
  defaultMode?: DiffMode;
  startLineOld?: number;
  startLineNew?: number;
  onLineClick?: (lineNum: number) => void;
}) {
  const [mode, setMode] = useState<DiffMode>(() => {
    try { return (localStorage.getItem('diffViewerMode') as DiffMode) ?? defaultMode; }
    catch { return defaultMode; }
  });
  const [hunkIndex, setHunkIndex] = useState(0);
  const [hunkCount, setHunkCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleSetMode(m: DiffMode) {
    setMode(m);
    setHunkIndex(0);
    try { localStorage.setItem('diffViewerMode', m); } catch { /* ignore */ }
  }

  // 在每次 oldStr/newStr/mode 变化后重新计算 hunk 数量
  useEffect(() => {
    if (!containerRef.current) return;
    const count = containerRef.current.querySelectorAll('[data-hunk-start="true"]').length;
    setHunkCount(count);
    setHunkIndex(0);
  }, [oldStr, newStr, mode]);

  const navigateHunk = useCallback((dir: 1 | -1) => {
    if (!containerRef.current) return;
    const hunks = containerRef.current.querySelectorAll<HTMLElement>('[data-hunk-start="true"]');
    if (hunks.length === 0) return;
    const next = Math.max(0, Math.min(hunks.length - 1, hunkIndex + dir));
    setHunkIndex(next);
    hunks[next].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [hunkIndex]);

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

  const navBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '1px 5px',
    fontSize: 10,
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    cursor: hunkCount > 1 ? 'pointer' : 'default',
    background: 'transparent',
    color: hunkCount > 1 ? 'var(--text-secondary)' : 'var(--text-muted)',
    lineHeight: '18px',
    opacity: hunkCount > 1 ? 1 : 0.4,
  };

  return (
    <div ref={containerRef}>
      {/* 工具栏：Chunk 导航 + 模式切换 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
        {/* Chunk 导航（有多个 hunk 时显示） */}
        {hunkCount > 0 && (
          <>
            <button style={navBtnStyle} onClick={() => navigateHunk(-1)} disabled={hunkCount <= 1 || hunkIndex === 0} title="上一处变更">
              <ChevronUp size={10} />
            </button>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', userSelect: 'none' }}>
              {hunkCount > 1 ? `${hunkIndex + 1} / ${hunkCount}` : `${hunkCount} 处`}
            </span>
            <button style={navBtnStyle} onClick={() => navigateHunk(1)} disabled={hunkCount <= 1 || hunkIndex >= hunkCount - 1} title="下一处变更">
              <ChevronDown size={10} />
            </button>
            <span style={{ width: 4 }} />
          </>
        )}
        {/* 模式切换 */}
        <button style={btnStyle(mode === 'unified')} onClick={() => handleSetMode('unified')}>Unified</button>
        <button style={btnStyle(mode === 'split')} onClick={() => handleSetMode('split')}>Side-by-Side</button>
      </div>
      {mode === 'unified'
        ? <InlineDiff oldStr={oldStr} newStr={newStr} startLineOld={startLineOld} startLineNew={startLineNew} onLineClick={onLineClick} />
        : <SideBySideDiff oldStr={oldStr} newStr={newStr} startLineOld={startLineOld} startLineNew={startLineNew} onLineClick={onLineClick} />
      }
    </div>
  );
}
