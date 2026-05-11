import { useRef, useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Terminal, Trash2, Maximize2, Minimize2, Send, ChevronDown, ChevronUp } from 'lucide-react';
import Convert from 'ansi-to-html';

const ansiConverter = new Convert({
  fg: '#c9d1d9',
  bg: '#0d1117',
  newline: true,
  escapeXML: true,
  stream: false,
});

export function TerminalPanel() {
  // 精确订阅，避免消息/文件等无关状态变化触发重渲
  const terminalLines = useAppStore((s) => s.terminalLines);
  const clearTerminal = useAppStore((s) => s.clearTerminal);
  const session = useAppStore((s) => s.session);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [terminalLines]);

  // 终端默认折叠，不再自动展开（用户手动展开）

  // Combine all lines into a single buffer for ANSI state continuity
  const renderedOutput = useMemo(() => {
    if (terminalLines.length === 0) return '';
    const rawText = terminalLines.map((line) => line.content).join('');
    return ansiConverter.toHtml(rawText);
  }, [terminalLines]);

  const latestLinePreview = useMemo(() => {
    for (let i = terminalLines.length - 1; i >= 0; i--) {
      const line = terminalLines[i]?.content?.replace(/\s+/g, ' ').trim();
      if (line) return line.slice(0, 96);
    }
    return session.isConnected ? '会话已连接，可直接输入命令' : '未连接到 Claude CLI';
  }, [session.isConnected, terminalLines]);

  return (
    <div
      className={`terminal-panel${collapsed ? ' collapsed' : ''}`}
      style={{
        height: collapsed ? 44 : expanded ? '38vh' : 148,
        minHeight: collapsed ? 44 : 96,
        maxHeight: expanded ? '46vh' : collapsed ? 44 : 220,
      }}
    >
      {/* Terminal header */}
      <div className="terminal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Terminal size={14} />
          <span style={{ fontSize: 12, fontWeight: 500 }}>终端</span>
          {terminalLines.length > 0 && (
            <span className="terminal-header-badge">
              ({terminalLines.length} 行)
            </span>
          )}
          <span className={`terminal-header-status ${session.isConnected ? 'connected' : ''}`}>
            {session.isConnected ? '在线' : '离线'}
          </span>
          <span className="terminal-header-preview" title={latestLinePreview}>
            {latestLinePreview}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="btn"
            onClick={() => setCollapsed((value) => !value)}
            style={{ padding: '2px 6px' }}
            title={collapsed ? '展开终端' : '收起终端'}
          >
            {collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button
            className="btn"
            onClick={() => {
              setCollapsed(false);
              setExpanded(!expanded);
            }}
            style={{ padding: '2px 6px' }}
            title={expanded ? '最小化' : '最大化'}
          >
            {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            className="btn"
            onClick={clearTerminal}
            style={{ padding: '2px 6px' }}
            title="清空"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
      {/* Terminal output */}
      <div
        ref={scrollRef}
        className="terminal-output"
      >
        {terminalLines.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            终端输出将显示在这里...
          </div>
        ) : (
          <div
            style={{ color: 'var(--text-primary)' }}
            dangerouslySetInnerHTML={{ __html: renderedOutput }}
          />
        )}
      </div>

      {/* Terminal input */}
      <div className="terminal-input-area">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="terminal-input-prompt">
            $
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={session.isConnected ? '输入命令...' : '请先启动 CLI 会话'}
            disabled={!session.isConnected}
            className="terminal-input"
            style={{
              opacity: session.isConnected ? 1 : 0.5,
            }}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && input.trim() && session.isConnected) {
                const cmd = input.trim();
                setInput('');
                try {
                  await window.electronAPI.cliSend(cmd);
                } catch (err) {
                  console.error('Failed to send command:', err);
                }
              }
            }}
          />
          <button
            className="btn"
            onClick={async () => {
              if (input.trim() && session.isConnected) {
                const cmd = input.trim();
                setInput('');
                try {
                  await window.electronAPI.cliSend(cmd);
                } catch (err) {
                  console.error('Failed to send command:', err);
                }
              }
            }}
            disabled={!session.isConnected || !input.trim()}
            style={{ padding: '2px 8px', opacity: session.isConnected && input.trim() ? 1 : 0.5 }}
          >
            <Send size={12} />
          </button>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
