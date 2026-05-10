import { useRef, useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Terminal, Trash2, Maximize2, Minimize2, Send } from 'lucide-react';
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
  const [input, setInput] = useState('');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [terminalLines]);

  // Combine all lines into a single buffer for ANSI state continuity
  const renderedOutput = useMemo(() => {
    if (terminalLines.length === 0) return '';
    const rawText = terminalLines.map((line) => line.content).join('');
    return ansiConverter.toHtml(rawText);
  }, [terminalLines]);

  return (
    <div
      className="terminal-panel"
      style={{
        height: expanded ? '50%' : 200,
        minHeight: 120,
        maxHeight: expanded ? '60%' : 400,
      }}
    >
      {/* Terminal header */}
      <div className="terminal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Terminal size={14} />
          <span style={{ fontSize: 12, fontWeight: 500 }}>终端</span>
          {terminalLines.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              ({terminalLines.length} 行)
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="btn"
            onClick={() => setExpanded(!expanded)}
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
    </div>
  );
}
