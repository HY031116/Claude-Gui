/**
 * 轻量会话列表 — 嵌入 chat 侧边栏
 * 扁平展示所有历史会话（按时间倒序），支持搜索和一键切换
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { MessageSquare, Search, Plus, X, Clock } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import type { ConversationRecord, CliSessionRecord } from '../types';

function formatRelTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min}m`;
  if (hr < 24) return `${hr}h`;
  if (day < 7) return `${day}d`;
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

/** workingDirectory → CLI projectDirName 编码 */
function encodePathLikeCli(workingDir: string): string {
  if (!workingDir) return '';
  const normalized = workingDir.replace(/\\/g, '/').replace(/\/+$/, '');
  const colonIdx = normalized.indexOf(':');
  if (colonIdx !== -1) {
    const drive = normalized.slice(0, colonIdx).toLowerCase();
    const rest = normalized.slice(colonIdx + 2);
    const encoded = rest.split('/').map((p) => p.replace(/\s+/g, '-')).join('-');
    return drive + '--' + encoded;
  }
  return normalized.replace(/^\//, '').replace(/\//g, '-');
}

export function SessionList() {
  const {
    conversationHistory,
    session,
    setSession,
    clearMessages,
    setMessages,
  } = useAppStore();

  const [cliSessions, setCliSessions] = useState<CliSessionRecord[]>([]);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(false);

  // 加载 CLI 原生会话
  const loadSessions = useCallback(async () => {
    try {
      const r = await window.electronAPI.loadCliHistory();
      if (r.success && r.sessions) setCliSessions(r.sessions as CliSessionRecord[]);
    } catch { /* 非 Electron 环境忽略 */ }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // 新建对话时刷新列表
  useEffect(() => {
    if (!session.conversationSessionId) loadSessions();
  }, [session.conversationSessionId, loadSessions]);

  /** 合并 localStorage + CLI 会话，扁平列表按时间排序 */
  const sessions = useMemo(() => {
    const localIds = new Set(conversationHistory.map((r) => r.sessionId));
    const all: ConversationRecord[] = [...conversationHistory];

    for (const cli of cliSessions) {
      if (localIds.has(cli.sessionId)) continue;
      // 尝试匹配 workingDirectory
      let matchedDir = '';
      for (const rec of conversationHistory) {
        if (rec.workingDirectory && encodePathLikeCli(rec.workingDirectory).toLowerCase() === cli.projectDirName.toLowerCase()) {
          matchedDir = rec.workingDirectory;
          break;
        }
      }
      all.push({
        sessionId: cli.sessionId,
        workingDirectory: matchedDir,
        preview: cli.preview,
        startedAt: cli.startedAt,
        lastMessageAt: cli.lastMessageAt,
      });
    }

    // 按最后消息时间倒序
    all.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

    // 搜索过滤
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return all.filter(
        (s) => s.preview?.toLowerCase().includes(q) || s.workingDirectory?.toLowerCase().includes(q),
      );
    }
    return all;
  }, [conversationHistory, cliSessions, search]);

  const handleSelect = useCallback(
    async (record: ConversationRecord) => {
      if (record.sessionId === session.conversationSessionId) return;
      clearMessages();
      setSession({
        conversationSessionId: record.sessionId,
        workingDirectory: record.workingDirectory || session.workingDirectory,
      });

      // 查找对应的 projectDirName：先从 cliSessions 匹配，否则用工作目录推算
      const cliRecord = cliSessions.find((c) => c.sessionId === record.sessionId);
      const projectDirName =
        cliRecord?.projectDirName ||
        (record.workingDirectory ? encodePathLikeCli(record.workingDirectory) : '');

      if (!projectDirName) return;

      try {
        setLoading(true);
        const res = await window.electronAPI.loadSessionMessages(projectDirName, record.sessionId);
        if (res.success && res.messages && res.messages.length > 0) {
          setMessages(res.messages as import('../types').Message[]);
        }
      } catch { /* 非 Electron 环境忽略 */ } finally {
        setLoading(false);
      }
    },
    [clearMessages, setSession, setMessages, session.conversationSessionId, session.workingDirectory, cliSessions],
  );

  const handleNew = useCallback(() => {
    clearMessages();
    setSession({ conversationSessionId: undefined });
  }, [clearMessages, setSession]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 标题行 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px 4px',
        borderTop: '1px solid var(--border-color)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          对话历史
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            title="搜索"
            onClick={() => setShowSearch(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: showSearch ? 'var(--accent-primary, #7c3aed)' : 'var(--text-muted)', padding: 3, borderRadius: 4, display: 'flex' }}
          >
            <Search size={12} />
          </button>
          <button
            title="新建对话"
            onClick={handleNew}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3, borderRadius: 4, display: 'flex' }}
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* 搜索框 */}
      {showSearch && (
        <div style={{ padding: '0 8px 6px', display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索..."
            style={{
              flex: 1, fontSize: 12, padding: '4px 8px',
              background: 'var(--bg-input, var(--bg-tertiary))',
              border: '1px solid var(--border-color)',
              borderRadius: 4, color: 'var(--text-primary)', outline: 'none',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
              <X size={11} />
            </button>
          )}
        </div>
      )}

      {/* 会话列表 */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        {loading && (
          <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            加载历史消息…
          </div>
        )}
        {sessions.length === 0 ? (
          <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            <MessageSquare size={20} style={{ display: 'block', margin: '0 auto 6px', opacity: 0.3 }} />
            暂无历史对话
          </div>
        ) : (
          sessions.map((rec) => {
            const isActive = rec.sessionId === session.conversationSessionId;
            return (
              <div
                key={rec.sessionId}
                onClick={() => handleSelect(rec)}
                title={rec.preview || rec.sessionId}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  borderLeft: isActive ? '2px solid var(--accent-primary, #7c3aed)' : '2px solid transparent',
                  background: isActive ? 'var(--bg-active, rgba(124,58,237,0.08))' : 'transparent',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div style={{
                  fontSize: 12,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 500 : 400,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.4,
                }}>
                  {rec.preview || '（无预览）'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={9} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {formatRelTime(rec.lastMessageAt)}
                  </span>
                  {isActive && (
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      color: 'var(--accent-primary, #7c3aed)',
                      background: 'rgba(124,58,237,0.12)',
                      borderRadius: 3, padding: '0 4px', marginLeft: 2,
                    }}>
                      当前
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
