import { useState, useEffect, useCallback, useRef } from 'react';
import { Brain, Search, Loader2, AlertCircle, Clock, Filter, ChevronDown } from 'lucide-react';

interface SearchOptions {
  limit: number;
  type: 'all' | 'observations' | 'sessions' | 'prompts';
  project: string;
}

export function MemSearchPanel() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<SearchOptions>({ limit: 20, type: 'all', project: '' });
  const inputRef = useRef<HTMLInputElement>(null);

  // 检查 Claude-Mem 安装状态
  useEffect(() => {
    window.electronAPI.checkClaudeMem().then((res) => {
      setInstalled(res.installed);
      setEnabled(res.enabled);
    });
  }, []);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setContent(null);
    try {
      const opts: { limit?: number; project?: string; type?: string } = { limit: options.limit };
      if (options.project) opts.project = options.project;
      if (options.type !== 'all') opts.type = options.type;
      const res = await window.electronAPI.searchMemory(q, opts);
      if (res.success) {
        setContent(res.content ?? '（无结果）');
      } else {
        setError(res.error ?? '搜索失败');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [query, loading, options]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  // 渲染内容（markdown 表格转为简洁列表）
  const renderContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // 表头分隔行（|---|...）跳过
      if (/^\|[-| ]+\|$/.test(line.trim())) return null;
      // 表格行
      if (line.trim().startsWith('|')) {
        const cells = line.split('|').filter((_, idx) => idx > 0 && idx < line.split('|').length - 1);
        const isHeader = i === 0 || lines[i - 1] === '' || !lines[i - 1]?.trim().startsWith('|');
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 8,
              padding: '4px 0',
              borderBottom: '1px solid var(--border-color)',
              fontSize: isHeader ? 11 : 13,
              fontWeight: isHeader ? 600 : 400,
              color: isHeader ? 'var(--text-secondary)' : 'var(--text-primary)',
              overflowX: 'hidden',
            }}
          >
            {cells.map((cell, j) => (
              <span
                key={j}
                style={{
                  flex: j === 0 ? '0 0 60px' : j === cells.length - 1 ? '0 0 50px' : 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={cell.trim()}
              >
                {cell.trim()}
              </span>
            ))}
          </div>
        );
      }
      // 普通文本行
      if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
      return (
        <div key={i} style={{ fontSize: 13, padding: '2px 0', color: 'var(--text-primary)' }}>
          {line}
        </div>
      );
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 头部 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Brain size={16} style={{ color: 'var(--accent-color)' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Claude-Mem 记忆搜索</span>
          {installed !== null && (
            <span style={{
              marginLeft: 'auto',
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: 4,
              background: installed && enabled ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color: installed && enabled ? '#22c55e' : '#ef4444',
            }}>
              {installed ? (enabled ? '已启用' : '已禁用') : '未安装'}
            </span>
          )}
        </div>

        {/* 搜索框 */}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索跨会话记忆…（如：authentication、bug fix）"
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
            style={{ padding: '0 8px', flexShrink: 0, background: showOptions ? 'var(--bg-hover)' : undefined }}
          >
            <Filter size={14} />
          </button>
        </div>

        {/* 展开选项 */}
        {showOptions && (
          <div style={{
            marginTop: 8,
            padding: 10,
            background: 'var(--bg-secondary)',
            borderRadius: 6,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            fontSize: 12,
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-secondary)' }}>数量</span>
              <select
                value={options.limit}
                onChange={(e) => setOptions(o => ({ ...o, limit: +e.target.value }))}
                style={{ padding: '2px 4px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 4 }}
              >
                {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} 条</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-secondary)' }}>类型</span>
              <select
                value={options.type}
                onChange={(e) => setOptions(o => ({ ...o, type: e.target.value as SearchOptions['type'] }))}
                style={{ padding: '2px 4px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 4 }}
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
                onChange={(e) => setOptions(o => ({ ...o, project: e.target.value }))}
                placeholder="留空=全部项目"
                style={{
                  flex: 1,
                  minWidth: 100,
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

      {/* 结果区域 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {/* 未安装提示 */}
        {installed === false && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <Brain size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div style={{ fontSize: 14, marginBottom: 8 }}>Claude-Mem 插件未安装</div>
            <div style={{ fontSize: 12, fontFamily: 'monospace', background: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: 6, display: 'inline-block' }}>
              claude plugin install thedotmack/claude-mem
            </div>
          </div>
        )}

        {/* 空状态 */}
        {installed !== false && !content && !error && !loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <Brain size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontSize: 13 }}>输入关键词搜索跨会话记忆</div>
            <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>按 Enter 或点击搜索按钮</div>
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <Loader2 size={24} className="spin" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13 }}>正在查询 Claude-Mem worker…</div>
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.6 }}>首次查询需要启动 worker（约 5-10 秒）</div>
          </div>
        )}

        {/* 错误 */}
        {error && (
          <div style={{
            display: 'flex',
            gap: 8,
            padding: 12,
            background: 'rgba(239,68,68,0.1)',
            borderRadius: 6,
            color: '#ef4444',
            fontSize: 13,
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error}</span>
          </div>
        )}

        {/* 搜索结果 */}
        {content && !loading && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} />
              搜索结果（最多 {options.limit} 条）
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {renderContent(content)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
