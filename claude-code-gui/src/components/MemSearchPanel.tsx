import { useState, useEffect, useCallback, useRef } from 'react';
import { Brain, Search, Loader2, AlertCircle, Clock, Filter, ChevronLeft, ChevronRight, List, GitBranch, ChevronDown, ChevronUp } from 'lucide-react';

interface SearchOptions {
  limit: number;
  type: 'all' | 'observations' | 'sessions' | 'prompts';
  project: string;
}

/** 转义正则特殊字符 */
function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 在文本中高亮关键词，返回 React 节点数组 */
function highlight(text: string, kw: string): React.ReactNode {
  if (!kw.trim()) return text;
  const parts = text.split(new RegExp(`(${escapeRe(kw)})`, 'gi'));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === kw.toLowerCase() ? (
          <mark
            key={i}
            style={{
              background: 'rgba(251,191,36,0.35)',
              color: 'inherit',
              borderRadius: 2,
              padding: '0 1px',
            }}
          >
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}

export function MemSearchPanel() {
  const [mode, setMode] = useState<'search' | 'all' | 'timeline'>('search');
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState(''); // 已提交的查询词（用于高亮）
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<SearchOptions>({ limit: 20, type: 'all', project: '' });
  // 分页（仅 search/all 模式）
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  // 时间线专属状态
  const [tlAnchor, setTlAnchor] = useState('');
  const [tlQuery, setTlQuery] = useState('');
  const [tlDepthBefore, setTlDepthBefore] = useState(5);
  const [tlDepthAfter, setTlDepthAfter] = useState(5);
  const [cardDetails, setCardDetails] = useState<Map<string, string>>(new Map());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // 检查插件状态
  useEffect(() => {
    window.electronAPI.checkClaudeMem().then((res) => {
      setInstalled(res.installed);
      setEnabled(res.enabled);
    });
  }, []);

  const doFetch = useCallback(
    async (q: string | undefined, pageNum: number) => {
      if (loading) return;
      setLoading(true);
      setError(null);
      setContent(null);
      try {
        const opts: { limit?: number; offset?: number; project?: string; type?: string; orderBy?: string } = {
          limit: options.limit,
          offset: pageNum * options.limit,
          orderBy: 'date_desc',
        };
        if (options.project) opts.project = options.project;
        if (options.type !== 'all') opts.type = options.type;
        const res = await window.electronAPI.searchMemory(q, opts);
        if (res.success) {
          const text = res.content ?? '';
          setContent(text || '（无结果）');
          // 粗略判断是否有更多：行数 >= limit 则可能有下一页
          const dataRows = text
            .split('\n')
            .filter((l) => l.trim().startsWith('|') && !/^\|[-| ]+\|$/.test(l.trim()) && !/\*\*/.test(l))
            .length;
          setHasMore(dataRows >= options.limit);
        } else {
          setError(res.error ?? '查询失败');
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [loading, options],
  );

  // 切换到"全部"模式时自动加载
  useEffect(() => {
    if (mode === 'all' && installed) {
      setPage(0);
      setSubmittedQuery('');
      doFetch(undefined, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // 时间线查询
  const fetchTimeline = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setContent(null);
    try {
      const opts: { anchor?: string; query?: string; depthBefore?: number; depthAfter?: number } = {
        depthBefore: tlDepthBefore,
        depthAfter: tlDepthAfter,
      };
      if (tlAnchor.trim()) opts.anchor = tlAnchor.trim();
      if (tlQuery.trim()) opts.query = tlQuery.trim();
      const res = await window.electronAPI.timelineMemory(opts);
      if (res.success) {
        setContent(res.content ?? '（无结果）');
      } else {
        setError(res.error ?? '时间线查询失败');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [loading, tlAnchor, tlQuery, tlDepthBefore, tlDepthAfter]);

  // 切换模式时清空结果
  const switchMode = (m: 'search' | 'all' | 'timeline') => {
    if (m === mode) return;
    setMode(m);
    setContent(null);
    setError(null);
    setPage(0);
    setSubmittedQuery('');
    setExpandedIds(new Set());
    setCardDetails(new Map());
  };

  const handleSearch = () => {
    const q = query.trim();
    if (!q || loading) return;
    setSubmittedQuery(q);
    setPage(0);
    doFetch(q, 0);
  };

  const handlePrev = () => {
    const newPage = page - 1;
    setPage(newPage);
    if (mode === 'all') doFetch(undefined, newPage);
    else doFetch(submittedQuery, newPage);
  };

  const handleNext = () => {
    const newPage = page + 1;
    setPage(newPage);
    if (mode === 'all') doFetch(undefined, newPage);
    else doFetch(submittedQuery, newPage);
  };

  const toggleCardDetail = useCallback(async (id: string) => {
    if (expandedIds.has(id)) {
      setExpandedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      return;
    }
    if (cardDetails.has(id)) {
      setExpandedIds((prev) => new Set(prev).add(id));
      return;
    }
    setCardDetails((prev) => new Map(prev).set(id, 'loading'));
    setExpandedIds((prev) => new Set(prev).add(id));
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      setCardDetails((prev) => new Map(prev).set(id, 'error:ID 无效'));
      return;
    }
    try {
      const res = await window.electronAPI.getObservations([numId]);
      setCardDetails((prev) => new Map(prev).set(id, res.success ? (res.content ?? '') : ('error:' + (res.error ?? '请求失败'))));
    } catch (e) {
      setCardDetails((prev) => new Map(prev).set(id, 'error:' + String(e)));
    }
  }, [expandedIds, cardDetails]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  // 从搜索/全部模式跳转到时间线（直接传入 id，不依赖 state 时序）
  const jumpToTimeline = useCallback(
    async (id: string) => {
      setMode('timeline');
      setContent(null);
      setError(null);
      setTlAnchor(id); // 同步更新锚点输入框
      setLoading(true);
      try {
        const res = await window.electronAPI.timelineMemory({
          anchor: id,
          query: tlQuery.trim() || undefined,
          depthBefore: tlDepthBefore,
          depthAfter: tlDepthAfter,
        });
        if (res.success) setContent(res.content ?? '（无结果）');
        else setError(res.error ?? '时间线查询失败');
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [tlQuery, tlDepthBefore, tlDepthAfter],
  );

  // 类型 Badge 颜色映射
  const typeColor = (t: string) => {
    const lt = t.toLowerCase();
    if (lt.includes('observation')) return { bg: 'rgba(99,102,241,0.15)', fg: '#818cf8' };
    if (lt.includes('session')) return { bg: 'rgba(34,197,94,0.15)', fg: '#22c55e' };
    if (lt.includes('prompt')) return { bg: 'rgba(245,158,11,0.15)', fg: '#f59e0b' };
    return { bg: 'var(--bg-secondary)', fg: 'var(--text-secondary)' };
  };

  // 解析 markdown 表格为结构化数据
  const parseTable = (text: string): { headers: string[]; rows: string[][] } => {
    const headers: string[] = [];
    const rows: string[][] = [];
    let headerDone = false;
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (/^\|[-| :]+\|$/.test(trimmed)) continue;
      if (!trimmed.startsWith('|')) continue;
      const cells = trimmed.slice(1, -1).split('|').map((c) => c.trim());
      if (!headerDone) { headers.push(...cells); headerDone = true; }
      else rows.push(cells);
    }
    return { headers, rows };
  };

  // 卡片式渲染（搜索/全部模式）
  const renderCards = (text: string, kw: string) => {
    const { headers, rows } = parseTable(text);
    if (!headers.length) {
      // 无表格，降级为纯文本
      return text.split('\n').map((line, i) => (
        <div key={i} style={{ fontSize: 13, padding: '2px 0', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
          {kw ? highlight(line, kw) : line}
        </div>
      ));
    }

    // 识别关键列索引
    const idxId = headers.findIndex((h) => /^[#id]/i.test(h));
    const idxType = headers.findIndex((h) => /type/i.test(h));
    const idxDate = headers.findIndex((h) => /date|created|time/i.test(h));
    const idxContent = headers.length - 1; // 最后一列通常是内容/摘要

    return rows.map((row, ri) => {
      const id = idxId >= 0 ? row[idxId] : String(ri + 1);
      const type = idxType >= 0 ? row[idxType] : '';
      const date = idxDate >= 0 ? row[idxDate] : '';
      const { bg, fg } = typeColor(type);
      const isExpanded = expandedIds.has(id);
      const detail = cardDetails.get(id);

      return (
        <div
          key={ri}
          style={{
            marginBottom: 8,
            padding: '8px 10px',
            background: 'var(--bg-secondary)',
            borderRadius: 6,
            border: '1px solid var(--border-color)',
            borderLeft: `3px solid ${fg}`,
          }}
        >
          {/* 卡片头部 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
            {type && (
              <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: bg, color: fg }}>
                {type}
              </span>
            )}
            {/* 非 id/type/date/content 的额外列（如 project）*/}
            {row.map((cell, ci) => {
              if (ci === idxId || ci === idxType || ci === idxDate || ci === idxContent) return null;
              if (!cell) return null;
              return (
                <span key={ci} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 11, background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                  {headers[ci] ? `${headers[ci]}: ` : ''}{kw ? highlight(cell, kw) : cell}
                </span>
              );
            })}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
              {date && <span style={{ marginRight: 2 }}>{kw ? highlight(date, kw) : date}</span>}
              {id && <span style={{ opacity: 0.6 }}>#{id}</span>}
              <button
                onClick={() => jumpToTimeline(id)}
                title="在时间线中查看上下文"
                className="btn"
                style={{ padding: '1px 4px', marginLeft: 4, opacity: 0.5, lineHeight: 1 }}
              >
                <GitBranch size={10} />
              </button>
              <button
                onClick={() => toggleCardDetail(id)}
                title={isExpanded ? '收起详情' : '展开完整内容'}
                className="btn"
                style={{ padding: '1px 4px', opacity: 0.6, lineHeight: 1 }}
              >
                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </span>
          </div>
          {/* 卡片摘要 */}
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-primary)',
              lineHeight: 1.5,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
            }}
          >
            {kw ? highlight(row[idxContent] ?? '', kw) : (row[idxContent] ?? '')}
          </div>
          {isExpanded && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 10px',
                background: 'var(--bg-primary)',
                borderRadius: 4,
                border: '1px solid var(--border-color)',
                fontSize: 12,
                maxHeight: 320,
                overflowY: 'auto',
              }}
            >
              {detail === 'loading' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                  <Loader2 size={12} className="spin" />
                  <span>加载完整内容…</span>
                </div>
              ) : detail != null && detail.startsWith('error:') ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444' }}>
                  <AlertCircle size={12} />
                  <span>{detail.slice(6)}</span>
                </div>
              ) : (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-primary)', fontFamily: 'inherit', lineHeight: 1.5 }}>
                  {detail}
                </pre>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  // 渲染时间线专用视图：支持 ## 日期标题 + 表格行 + 普通文本
  const renderTimeline = (text: string) => {
    const kw = tlQuery.trim();
    const lines = text.split('\n');
    const result: React.ReactNode[] = [];
    let headerParsed = false;

    lines.forEach((line, i) => {
      const trimmed = line.trim();

      // 日期分组标题 ## / # / ### 开头
      if (/^#{1,3}\s/.test(trimmed)) {
        const title = trimmed.replace(/^#+\s*/, '');
        headerParsed = false; // 每个分组重置表头状态
        result.push(
          <div
            key={i}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0 4px' }}
          >
            <span
              style={{
                padding: '2px 8px',
                background: 'var(--accent-color)',
                color: '#fff',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {title}
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
          </div>,
        );
        return;
      }

      // 水平分割线
      if (/^---+$/.test(trimmed)) {
        result.push(<div key={i} style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />);
        return;
      }

      // 表头分隔行（|-----|）跳过
      if (/^\|[-| :]+\|$/.test(trimmed)) return;

      // 表格数据行
      if (trimmed.startsWith('|')) {
        const cells = trimmed.slice(1, -1).split('|').map((c) => c.trim());
        const isHeader = !headerParsed;
        if (!headerParsed) headerParsed = true;

        if (isHeader) {
          result.push(
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 6,
                padding: '3px 0',
                borderBottom: '1px solid var(--border-color)',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-secondary)',
              }}
            >
              {cells.map((c, j) => (
                <span
                  key={j}
                  style={{
                    flex: j === 0 ? '0 0 44px' : j === 1 ? '0 0 66px' : j === cells.length - 1 ? '0 0 58px' : 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c}
                </span>
              ))}
            </div>,
          );
        } else {
          // 数据行：最后一列（内容/摘要）允许换行显示
          result.push(
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 6,
                padding: '5px 0 5px 8px',
                borderBottom: '1px solid rgba(128,128,128,0.12)',
                borderLeft: '2px solid var(--accent-color)',
                marginLeft: 2,
                marginBottom: 1,
                fontSize: 12,
                alignItems: 'flex-start',
              }}
            >
              {cells.map((c, j) => {
                const isLast = j === cells.length - 1;
                return (
                  <span
                    key={j}
                    style={{
                      flex: j === 0 ? '0 0 44px' : j === 1 ? '0 0 66px' : isLast ? 1 : '0 0 58px',
                      overflow: 'hidden',
                      textOverflow: isLast ? 'clip' : 'ellipsis',
                      whiteSpace: isLast ? 'normal' : 'nowrap',
                      wordBreak: isLast ? 'break-word' : undefined,
                      color: j === 0 ? 'var(--text-secondary)' : 'var(--text-primary)',
                      fontSize: j === 0 ? 11 : 12,
                    }}
                    title={isLast ? undefined : c}
                  >
                    {kw ? highlight(c, kw) : c}
                  </span>
                );
              })}
            </div>,
          );
        }
        return;
      }

      // 空行
      if (!trimmed) {
        result.push(<div key={i} style={{ height: 4 }} />);
        return;
      }

      // 普通文本行
      result.push(
        <div key={i} style={{ fontSize: 12, padding: '2px 0', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
          {kw ? highlight(line, kw) : line}
        </div>,
      );
    });

    return result;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 头部 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Brain size={16} style={{ color: 'var(--accent-color)' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Claude-Mem 记忆</span>
          {installed !== null && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 4,
                background: installed && enabled ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: installed && enabled ? '#22c55e' : '#ef4444',
              }}
            >
              {installed ? (enabled ? '已启用' : '已禁用') : '未安装'}
            </span>
          )}
        </div>

        {/* 模式 Tab */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
          <button
            onClick={() => switchMode('search')}
            className="btn"
            style={{
              flex: 1,
              padding: '5px 0',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              background: mode === 'search' ? 'var(--accent-color)' : 'var(--bg-secondary)',
              color: mode === 'search' ? '#fff' : 'var(--text-secondary)',
              borderRadius: '6px 0 0 6px',
              border: '1px solid var(--border-color)',
            }}
          >
            <Search size={12} />
            搜索
          </button>
          <button
            onClick={() => switchMode('all')}
            disabled={installed === false}
            className="btn"
            style={{
              flex: 1,
              padding: '5px 0',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              background: mode === 'all' ? 'var(--accent-color)' : 'var(--bg-secondary)',
              color: mode === 'all' ? '#fff' : 'var(--text-secondary)',
              borderRadius: 0,
              border: '1px solid var(--border-color)',
              borderLeft: 'none',
            }}
          >
            <List size={12} />
            全部记忆
          </button>
          <button
            onClick={() => switchMode('timeline')}
            disabled={installed === false}
            className="btn"
            style={{
              flex: 1,
              padding: '5px 0',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              background: mode === 'timeline' ? 'var(--accent-color)' : 'var(--bg-secondary)',
              color: mode === 'timeline' ? '#fff' : 'var(--text-secondary)',
              borderRadius: '0 6px 6px 0',
              border: '1px solid var(--border-color)',
              borderLeft: 'none',
            }}
          >
            <GitBranch size={12} />
            时间线
          </button>
        </div>

        {/* 搜索栏（仅搜索模式） */}
        {mode === 'search' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="搜索记忆关键词…（按 Enter 搜索）"
              disabled={loading || installed === false}
              style={{
                flex: 1,
                padding: '7px 10px',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim() || installed === false}
              className="btn btn-primary"
              style={{ padding: '0 12px', flexShrink: 0 }}
            >
              {loading ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
            </button>
            <button
              onClick={() => setShowOptions(!showOptions)}
              title="搜索选项"
              className="btn"
              style={{
                padding: '0 8px',
                flexShrink: 0,
                background: showOptions ? 'var(--bg-hover)' : undefined,
              }}
            >
              <Filter size={14} />
            </button>
          </div>
        )}

        {/* 全部模式刷新按钮 */}
        {mode === 'all' && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>按时间倒序显示所有记忆</span>
            <button
              onClick={() => { setPage(0); doFetch(undefined, 0); }}
              disabled={loading || installed === false}
              className="btn btn-primary"
              style={{ padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {loading ? <Loader2 size={12} className="spin" /> : <List size={12} />}
              刷新
            </button>
            <button
              onClick={() => setShowOptions(!showOptions)}
              title="过滤选项"
              className="btn"
              style={{ padding: '0 8px', flexShrink: 0, background: showOptions ? 'var(--bg-hover)' : undefined }}
            >
              <Filter size={14} />
            </button>
          </div>
        )}

        {/* 展开选项 */}
        {showOptions && (
          <div
            style={{
              marginTop: 8,
              padding: 10,
              background: 'var(--bg-secondary)',
              borderRadius: 6,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              fontSize: 12,
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-secondary)' }}>每页</span>
              <select
                value={options.limit}
                onChange={(e) => setOptions((o) => ({ ...o, limit: +e.target.value }))}
                style={{
                  padding: '2px 4px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 4,
                }}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} 条
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-secondary)' }}>类型</span>
              <select
                value={options.type}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, type: e.target.value as SearchOptions['type'] }))
                }
                style={{
                  padding: '2px 4px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 4,
                }}
              >
                <option value="all">全部</option>
                <option value="observations">观察记录</option>
                <option value="sessions">会话</option>
                <option value="prompts">提示词</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
              <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>项目</span>
              <input
                value={options.project}
                onChange={(e) => setOptions((o) => ({ ...o, project: e.target.value }))}
                placeholder="留空=全部"
                style={{
                  flex: 1,
                  minWidth: 80,
                  padding: '2px 6px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 4,
                }}
              />
            </label>
          </div>
        )}
      </div>

      {/* 时间线控制面板 */}
      {mode === 'timeline' && (
        <div style={{ padding: '0 16px 12px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              value={tlAnchor}
              onChange={(e) => setTlAnchor(e.target.value)}
              placeholder="锚点（可选）：记忆 ID / 日期，如 2024-01-15"
              disabled={loading || installed === false}
              style={{
                padding: '7px 10px',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <input
              value={tlQuery}
              onChange={(e) => setTlQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && fetchTimeline()}
              placeholder="过滤关键词（可选，按 Enter 查询）"
              disabled={loading || installed === false}
              style={{
                padding: '7px 10px',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>前</span>
              <input
                type="number"
                min={1}
                max={20}
                value={tlDepthBefore}
                onChange={(e) => setTlDepthBefore(Math.max(1, Math.min(20, +e.target.value)))}
                style={{
                  width: 48,
                  padding: '2px 6px',
                  border: '1px solid var(--border-color)',
                  borderRadius: 4,
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  textAlign: 'center',
                }}
              />
              <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>条 · 后</span>
              <input
                type="number"
                min={1}
                max={20}
                value={tlDepthAfter}
                onChange={(e) => setTlDepthAfter(Math.max(1, Math.min(20, +e.target.value)))}
                style={{
                  width: 48,
                  padding: '2px 6px',
                  border: '1px solid var(--border-color)',
                  borderRadius: 4,
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  textAlign: 'center',
                }}
              />
              <span style={{ color: 'var(--text-secondary)', flex: 1 }}>条</span>
              <button
                onClick={fetchTimeline}
                disabled={loading || installed === false}
                className="btn btn-primary"
                style={{ padding: '4px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {loading ? <Loader2 size={12} className="spin" /> : <GitBranch size={12} />}
                查询时间线
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 结果区 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {/* 未安装 */}
        {installed === false && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <Brain size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div style={{ fontSize: 14, marginBottom: 8 }}>Claude-Mem 插件未安装</div>
            <code
              style={{
                fontSize: 12,
                background: 'var(--bg-secondary)',
                padding: '6px 12px',
                borderRadius: 6,
                display: 'inline-block',
              }}
            >
              claude plugin install thedotmack/claude-mem
            </code>
          </div>
        )}

        {/* 空态 */}
        {installed !== false && !content && !error && !loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <Brain size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontSize: 13 }}>
              {mode === 'search' ? '输入关键词，搜索跨会话记忆' : mode === 'all' ? '点击"刷新"按钮加载全部记忆' : '设置参数后点击"查询时间线"'}
            </div>
            <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>支持分页浏览 · 自动高亮命中词</div>
          </div>
        )}

        {/* 加载中 */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <Loader2 size={24} className="spin" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13 }}>正在查询…</div>
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.6 }}>首次启动约需 5-10 秒</div>
          </div>
        )}

        {/* 错误 */}
        {error && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: 12,
              background: 'rgba(239,68,68,0.1)',
              borderRadius: 6,
              color: '#ef4444',
              fontSize: 13,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error}</span>
          </div>
        )}

        {/* 结果 */}
        {content && !loading && (
          <div>
            {/* 分页工具栏（时间线模式不显示） */}
            {mode !== 'timeline' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} />
                  第 {page + 1} 页 · 每页 {options.limit} 条
                  {submittedQuery && mode === 'search' && (
                    <span style={{ marginLeft: 6 }}>
                      关键词{' '}
                      <mark
                        style={{
                          background: 'rgba(251,191,36,0.35)',
                          color: 'inherit',
                          borderRadius: 2,
                          padding: '0 3px',
                        }}
                      >
                        {submittedQuery}
                      </mark>
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={handlePrev}
                    disabled={page === 0 || loading}
                    className="btn"
                    style={{ padding: '2px 6px' }}
                    title="上一页"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!hasMore || loading}
                    className="btn"
                    style={{ padding: '2px 6px' }}
                    title="下一页"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* 时间线摘要栏 */}
            {mode === 'timeline' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 10,
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                }}
              >
                <GitBranch size={11} />
                <span>
                  时间线上下文 · 前 {tlDepthBefore} 后 {tlDepthAfter} 条
                  {tlAnchor && <span style={{ marginLeft: 6 }}>锚点：<code style={{ fontSize: 11 }}>{tlAnchor}</code></span>}
                  {tlQuery && (
                    <span style={{ marginLeft: 6 }}>
                      过滤：
                      <mark style={{ background: 'rgba(251,191,36,0.35)', color: 'inherit', borderRadius: 2, padding: '0 3px' }}>
                        {tlQuery}
                      </mark>
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* 内容区：时间线用专用渲染器，其余用卡片 */}
            <div style={{ fontSize: 13 }}>
              {mode === 'timeline'
                ? renderTimeline(content)
                : renderCards(content, mode === 'search' ? submittedQuery : '')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
