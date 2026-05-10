import { useState, useEffect, useCallback, useRef } from 'react';
import { Brain, Search, Loader2, AlertCircle, Clock, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState(''); // 已提交的查询词（用于高亮）
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<SearchOptions>({ limit: 20, type: 'all', project: '' });
  // 分页
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 检查插件状态
  useEffect(() => {
    window.electronAPI.checkClaudeMem().then((res) => {
      setInstalled(res.installed);
      setEnabled(res.enabled);
    });
  }, []);

  const doSearch = useCallback(
    async (q: string, pageNum: number) => {
      if (!q || loading) return;
      setLoading(true);
      setError(null);
      setContent(null);
      try {
        const opts: { limit?: number; offset?: number; project?: string; type?: string } = {
          limit: options.limit,
          offset: pageNum * options.limit,
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
          setError(res.error ?? '搜索失败');
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, options],
  );

  const handleSearch = () => {
    const q = query.trim();
    if (!q || loading) return;
    setSubmittedQuery(q);
    setPage(0);
    doSearch(q, 0);
  };

  const handlePrev = () => {
    const newPage = page - 1;
    setPage(newPage);
    doSearch(submittedQuery, newPage);
  };

  const handleNext = () => {
    const newPage = page + 1;
    setPage(newPage);
    doSearch(submittedQuery, newPage);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  // 渲染 markdown 表格行，支持关键词高亮
  const renderContent = (text: string) => {
    const lines = text.split('\n');
    let headerParsed = false;
    return lines.map((line, i) => {
      const trimmed = line.trim();
      // 分隔行跳过
      if (/^\|[-| :]+\|$/.test(trimmed)) return null;
      if (trimmed.startsWith('|')) {
        const rawCells = trimmed.slice(1, -1).split('|');
        const isHeader = !headerParsed;
        if (!headerParsed) headerParsed = true;
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 8,
              padding: '4px 2px',
              borderBottom: '1px solid var(--border-color)',
              fontSize: isHeader ? 11 : 13,
              fontWeight: isHeader ? 700 : 400,
              color: isHeader ? 'var(--text-secondary)' : 'var(--text-primary)',
            }}
          >
            {rawCells.map((cell, j) => (
              <span
                key={j}
                style={{
                  flex: j === 0 ? '0 0 55px' : j === rawCells.length - 1 ? '0 0 55px' : 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={cell.trim()}
              >
                {isHeader ? cell.trim() : highlight(cell.trim(), submittedQuery)}
              </span>
            ))}
          </div>
        );
      }
      if (!trimmed) return <div key={i} style={{ height: 6 }} />;
      return (
        <div key={i} style={{ fontSize: 13, padding: '2px 0', color: 'var(--text-secondary)' }}>
          {highlight(line, submittedQuery)}
        </div>
      );
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 头部 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Brain size={16} style={{ color: 'var(--accent-color)' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Claude-Mem 记忆搜索</span>
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

        {/* 搜索栏 */}
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
            <div style={{ fontSize: 13 }}>输入关键词，搜索跨会话记忆</div>
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
            {/* 分页工具栏 */}
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
                {submittedQuery && (
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
            {/* 表格 */}
            <div style={{ fontSize: 13 }}>{renderContent(content)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
