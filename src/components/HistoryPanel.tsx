import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { MessageSquare, Trash2, FolderOpen, ArrowLeft, Clock, RefreshCw, Search, ArrowUpDown } from 'lucide-react';
import type { ConversationRecord, CliSessionRecord } from '../types';

/** 格式化相对时间 */
function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  if (hr < 24) return `${hr} 小时前`;
  if (day < 7) return `${day} 天前`;
  if (day < 30) return `${day} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

/** 格式化完整时间 */
function formatFullTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

/** 获取路径最后一段作为显示名称 */
function getDisplayName(path: string): string {
  if (!path) return '';
  return path.replace(/[\\/]+$/, '').replace(/.*[\\/]/, '') || path;
}

/**
 * 将 workingDirectory 编码成 Claude CLI 项目目录名格式
 * "D:\My Project\claude" → "d--My-Project-claude"
 */
function encodePathLikeCli(workingDir: string): string {
  if (!workingDir) return '';
  const normalized = workingDir.replace(/\\/g, '/').replace(/\/+$/, '');
  const colonIdx = normalized.indexOf(':');
  if (colonIdx !== -1) {
    // Windows 路径
    const drive = normalized.slice(0, colonIdx).toLowerCase();
    const rest = normalized.slice(colonIdx + 2); // 跳过 ':/'
    const encoded = rest.split('/').map((p) => p.replace(/\s+/g, '-')).join('-');
    return drive + '--' + encoded;
  }
  // Unix 路径
  return normalized.replace(/^\//, '').replace(/\//g, '-');
}

/**
 * 将 CLI 项目目录名解码为可读路径（启发式，仅用于展示）
 * CLI 编码规则：drive--pathseg1-pathseg2（分隔符 `-`，子目录也用 `-`，空格也用 `-`）
 * 例：d--My-Project-claude → D:\My-Project-claude（无法区分 \ 和空格，已知限制）
 * 多级目录：C--Users-Administrator--claude-mem → C:\Users-Administrator--claude-mem
 * 实际上 `--` 在 drive 之后仅出现一次；后续 `--` 为子目录分隔符
 */
function decodeProjectDirName(name: string): string {
  // 首个 `--` 是驱动器分隔符，后续 `--` 是路径分隔符
  const parts = name.split('--');
  if (parts.length === 0) return name;
  const drive = parts[0].toUpperCase();
  const pathParts = parts.slice(1);
  return `${drive}:\\${pathParts.join('\\')}`;
}

interface ProjectGroup {
  key: string;
  displayName: string;
  displayPath: string;
  sessions: ConversationRecord[];
}

export function HistoryPanel() {
  const { conversationHistory, clearConversationHistory, removeConversation, session, setSession, clearMessages, setActivePanel } = useAppStore();
  const [cliSessions, setCliSessions] = useState<CliSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  /** 当前处于"待确认删除"状态的 sessionId */
  const [deletingId, setDeletingId] = useState<string | null>(null);
  /** 批量选择模式 */
  const [batchMode, setBatchMode] = useState(false);
  /** 批量模式中已选中的 sessionId 集合 */
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  /** 当前处于"待确认删除整个项目"的项目 key */
  const [deletingProjectKey, setDeletingProjectKey] = useState<string | null>(null);
  /** 搜索关键词 */
  const [searchQuery, setSearchQuery] = useState('');
  /** 时间排序：false=最新优先，true=最旧优先 */
  const [sortAsc, setSortAsc] = useState(false);

  /** 加载 CLI 本地历史会话 */
  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.loadCliHistory();
      if (result.success && result.sessions) {
        setCliSessions(result.sessions as CliSessionRecord[]);
      }
    } catch {
      // 非 Electron 环境忽略
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  /** 构建按项目分组的会话列表 */
  const projectGroups = useMemo<ProjectGroup[]>(() => {
    const groups = new Map<string, ProjectGroup>();

    // 先加入 localStorage 会话（含 workingDirectory）
    for (const rec of conversationHistory) {
      const key = rec.workingDirectory || '_unknown';
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          displayName: getDisplayName(rec.workingDirectory) || '未知项目',
          displayPath: rec.workingDirectory || '未知目录',
          sessions: [],
        });
      }
      groups.get(key)!.sessions.push(rec);
    }

    // 再加入 CLI 原生会话（去重，尝试匹配已有 workingDirectory 分组）
    const localIds = new Set(conversationHistory.map((r) => r.sessionId));
    for (const cli of cliSessions) {
      if (localIds.has(cli.sessionId)) continue;

      // 尝试匹配已有 workingDirectory 分组（大小写不敏感）
      let matchedKey: string | null = null;
      for (const [key] of groups) {
        if (key !== '_unknown' && encodePathLikeCli(key).toLowerCase() === cli.projectDirName.toLowerCase()) {
          matchedKey = key;
          break;
        }
      }

      const rec: ConversationRecord = {
        sessionId: cli.sessionId,
        workingDirectory: matchedKey || '',
        preview: cli.preview,
        startedAt: cli.startedAt,
        lastMessageAt: cli.lastMessageAt,
      };

      if (matchedKey) {
        groups.get(matchedKey)!.sessions.push(rec);
      } else {
        // 新建分组（CLI 专属）
        const key = cli.projectDirName;
        const decoded = decodeProjectDirName(cli.projectDirName);
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            displayName: getDisplayName(decoded) || cli.projectDirName,
            displayPath: decoded,
            sessions: [],
          });
        }
        groups.get(key)!.sessions.push(rec);
      }
    }

    // 每组内按最后消息时间排列（受 sortAsc 控制）
    for (const group of groups.values()) {
      group.sessions.sort((a, b) =>
        sortAsc ? a.lastMessageAt - b.lastMessageAt : b.lastMessageAt - a.lastMessageAt,
      );
    }

    // 构建结果并按最新会话时间排列
    let result = Array.from(groups.values()).sort(
      (a, b) => sortAsc
        ? (a.sessions.slice(-1)[0]?.lastMessageAt ?? 0) - (b.sessions.slice(-1)[0]?.lastMessageAt ?? 0)
        : (b.sessions[0]?.lastMessageAt ?? 0) - (a.sessions[0]?.lastMessageAt ?? 0),
    );

    // 搜索过滤
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result
        .map((group) => {
          // 项目名/路径匹配 → 保留全部会话；否则只保留预览内容匹配的会话
          const projectMatch =
            group.displayName.toLowerCase().includes(q) ||
            group.displayPath.toLowerCase().includes(q);
          const filteredSessions = projectMatch
            ? group.sessions
            : group.sessions.filter((s) => s.preview?.toLowerCase().includes(q));
          return { ...group, sessions: filteredSessions };
        })
        .filter((group) => group.sessions.length > 0);
    }

    return result;
  }, [conversationHistory, cliSessions, sortAsc, searchQuery]);

  /** 自动选中第一个项目（或当前会话所在项目） */
  useEffect(() => {
    if (projectGroups.length === 0) return;
    if (selectedProject !== null && projectGroups.some((g) => g.key === selectedProject)) return;
    // 优先选中当前会话所在项目
    const currentGroup = projectGroups.find((g) =>
      g.sessions.some((s) => s.sessionId === session.conversationSessionId),
    );
    setSelectedProject(currentGroup?.key ?? projectGroups[0].key);
  }, [projectGroups, selectedProject, session.conversationSessionId]);

  const activeGroup = projectGroups.find((g) => g.key === selectedProject) ?? projectGroups[0];
  const totalCount = projectGroups.reduce((sum, g) => sum + g.sessions.length, 0);

  /** 点击会话：切换 sessionId 并回到对话面板 */
  const handleSelectSession = useCallback(
    (record: ConversationRecord) => {
      clearMessages();
      setSession({
        conversationSessionId: record.sessionId,
        workingDirectory: record.workingDirectory || session.workingDirectory,
      });
      setActivePanel('chat');
    },
    [clearMessages, setSession, setActivePanel, session.workingDirectory],
  );

  /**
   * 执行删除：同时删除 localStorage 记录 + CLI .jsonl 文件
   * projectDirName 为空时说明是纯 localStorage 会话，只删本地记录
   */
  const handleDeleteSession = useCallback(
    async (record: ConversationRecord, projectDirName: string) => {
      // 删除 localStorage 记录（如果存在）
      removeConversation(record.sessionId);
      // 删除 CLI .jsonl 文件（如果有 projectDirName）
      if (projectDirName) {
        try {
          await window.electronAPI.deleteCliSession(projectDirName, record.sessionId);
        } catch {
          // 非 Electron 环境忽略
        }
      }
      // 从本地 cliSessions 状态移除（避免等待重新加载）
      setCliSessions((prev) => prev.filter((s) => s.sessionId !== record.sessionId));
      setDeletingId(null);
      // 如果删的是当前会话，清空 sessionId
      if (session.conversationSessionId === record.sessionId) {
        setSession({ conversationSessionId: undefined });
        clearMessages();
      }
    },
    [removeConversation, session.conversationSessionId, setSession, clearMessages],
  );

  /** 进入/退出批量选择模式 */
  const toggleBatchMode = useCallback(() => {
    setBatchMode((prev) => !prev);
    setBatchSelected(new Set());
    setDeletingId(null);
  }, []);

  /**
   * 删除整个项目下所有会话（localStorage 记录 + CLI .jsonl 文件）
   * projectDirName：CLI 目录名（含 `--` 分隔符）；可能为空（纯 localStorage 项目）
   */
  const handleDeleteProject = useCallback(
    async (group: ProjectGroup) => {
      // 删除 localStorage 中该项目所有记录
      group.sessions.forEach((s) => removeConversation(s.sessionId));
      // 找出该组所有会话对应的 CLI projectDirName（可能有多个或来自合并组）
      const cliDirNames = new Set(
        group.sessions
          .map((s) => cliSessions.find((c) => c.sessionId === s.sessionId)?.projectDirName)
          .filter((d): d is string => Boolean(d)),
      );
      // key 本身是 CLI 目录名（含 '--'，纯 CLI 专属组）时也加入
      if (group.key.includes('--')) cliDirNames.add(group.key);
      // 批量删除各 CLI 目录下所有 .jsonl 文件
      for (const dirName of cliDirNames) {
        try {
          await window.electronAPI.deleteAllCliSessions(dirName);
        } catch { /* 非 Electron 环境忽略 */ }
      }
      // 从本地 cliSessions 移除该项目相关的所有会话
      const groupSessionIds = new Set(group.sessions.map((s) => s.sessionId));
      setCliSessions((prev) => prev.filter((s) => !groupSessionIds.has(s.sessionId)));
      // 如果当前会话属于该项目，清空 sessionId
      if (group.sessions.some((s) => s.sessionId === session.conversationSessionId)) {
        setSession({ conversationSessionId: undefined });
        clearMessages();
      }
      setDeletingProjectKey(null);
      // 如果删的是当前选中的项目，重置为空
      if (selectedProject === group.key) setSelectedProject(null);
    },
    [removeConversation, cliSessions, session.conversationSessionId, setSession, clearMessages, selectedProject],
  );

  /** 切换单条选中状态 */
  const toggleBatchSelect = useCallback((sessionId: string) => {
    setBatchSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }, []);

  /** 全选/反全选当前项目的所有会话 */
  const toggleSelectAll = useCallback((sessions: ConversationRecord[]) => {
    setBatchSelected((prev) => {
      const allIds = sessions.map((s) => s.sessionId);
      const allSelected = allIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        allIds.forEach((id) => next.delete(id));
      } else {
        allIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, []);

  /** 批量删除选中的会话 */
  const handleBatchDelete = useCallback(
    async (sessions: ConversationRecord[]) => {
      const toDelete = sessions.filter((s) => batchSelected.has(s.sessionId));
      for (const record of toDelete) {
        removeConversation(record.sessionId);
        const cliRec = cliSessions.find((s) => s.sessionId === record.sessionId);
        if (cliRec) {
          try {
            await window.electronAPI.deleteCliSession(cliRec.projectDirName, record.sessionId);
          } catch { /* 非 Electron 环境忽略 */ }
        }
        if (session.conversationSessionId === record.sessionId) {
          setSession({ conversationSessionId: undefined });
          clearMessages();
        }
      }
      const deletedIds = new Set(toDelete.map((s) => s.sessionId));
      setCliSessions((prev) => prev.filter((s) => !deletedIds.has(s.sessionId)));
      setBatchSelected(new Set());
      setBatchMode(false);
    },
    [batchSelected, cliSessions, removeConversation, session.conversationSessionId, setSession, clearMessages],
  );

  return (
    <div className="history-page">
      {/* 顶部工具栏 */}
      <div className="history-page-toolbar">
        <button className="history-back-btn" onClick={() => { setActivePanel('chat'); if (batchMode) toggleBatchMode(); }} title="返回对话">
          <ArrowLeft size={15} />
          返回对话
        </button>
        <span className="history-page-title">
          历史对话
          {totalCount > 0 && <span className="history-page-count">{totalCount}</span>}
        </span>
        <button
          className="history-back-btn"
          onClick={loadHistory}
          title="刷新"
          disabled={loading}
          style={{ marginLeft: 'auto' }}
        >
          <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>
        {/* 排序切换 */}
        <button
          className={`history-back-btn ${sortAsc ? 'active' : ''}`}
          onClick={() => setSortAsc((prev) => !prev)}
          title={sortAsc ? '当前：最旧优先，点击切换为最新优先' : '当前：最新优先，点击切换为最旧优先'}
          style={sortAsc ? { color: 'var(--accent-color, #4299e1)' } : {}}
        >
          <ArrowUpDown size={13} />
        </button>
        {/* 批量选择切换 */}
        {totalCount > 0 && (
          <button
            className={`history-back-btn ${batchMode ? 'active' : ''}`}
            onClick={toggleBatchMode}
            title={batchMode ? '退出批量选择' : '批量选择'}
            style={batchMode ? { color: 'var(--accent-color, #4299e1)' } : {}}
          >
            <Trash2 size={13} />
            {batchMode ? '取消' : '批量'}
          </button>
        )}
        {!batchMode && conversationHistory.length > 0 && (
          <button className="history-clear-btn" onClick={clearConversationHistory} title="清空本地历史">
            清空全部
          </button>
        )}
      </div>

      {/* 搜索框 */}
      <div className="history-search-bar">
        <Search size={13} className="history-search-icon" />
        <input
          className="history-search-input"
          type="text"
          placeholder="搜索项目或对话内容..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="history-search-clear" onClick={() => setSearchQuery('')} title="清除搜索">
            ×
          </button>
        )}
      </div>

      {/* 内容区 */}
      {loading ? (
        <div className="history-empty">
          <RefreshCw size={32} strokeWidth={1} style={{ animation: 'spin 1s linear infinite' }} />
          <p>加载历史记录中…</p>
        </div>
      ) : projectGroups.length === 0 ? (
        <div className="history-empty">
          <MessageSquare size={48} strokeWidth={1} />
          <p>暂无历史对话</p>
          <p className="history-empty-sub">完成一次对话后将自动保存在这里</p>
        </div>
      ) : (
        <div className="history-body">
          {/* 左侧：项目列表 */}
          <div className="history-sidebar">
            <div className="history-sidebar-title">项目</div>
            {projectGroups.map((group) => {
              const isActive = selectedProject === group.key;
              const isDeletingProject = deletingProjectKey === group.key;
              const latestTs = group.sessions[0]?.lastMessageAt;
              return (
                <div
                  key={group.key}
                  className={`history-project-item ${isActive ? 'active' : ''}`}
                  onClick={() => { if (!isDeletingProject) setSelectedProject(group.key); }}
                >
                  {!isDeletingProject && <FolderOpen size={14} className="history-project-icon" />}
                  {isDeletingProject ? (
                    /* 删除确认状态：整行替换为确认UI */
                    <div
                      className="history-project-delete-confirm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="history-project-delete-tip">删除全部 {group.sessions.length} 条？</span>
                      <button
                        className="history-session-delete-ok"
                        onClick={(e) => { e.stopPropagation(); handleDeleteProject(group); }}
                      >
                        确认
                      </button>
                      <button
                        className="history-session-delete-cancel"
                        onClick={(e) => { e.stopPropagation(); setDeletingProjectKey(null); }}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="history-project-info">
                        <span className="history-project-name" title={group.displayPath}>
                          {group.displayName}
                        </span>
                        <span className="history-project-meta">
                          {group.sessions.length} 条
                          {latestTs ? ` · ${formatRelativeTime(latestTs)}` : ''}
                        </span>
                      </div>
                      <button
                        className="history-project-delete-btn"
                        title="删除该项目所有会话"
                        onClick={(e) => { e.stopPropagation(); setDeletingProjectKey(group.key); }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* 右侧：会话列表 */}
          <div className="history-session-list">
            {activeGroup && (
              <>
                <div className="history-session-header">
                  <FolderOpen size={13} />
                  <span className="history-session-path" title={activeGroup.displayPath}>
                    {activeGroup.displayPath}
                  </span>
                  <span className="history-session-count">{activeGroup.sessions.length} 条对话</span>
                  {/* 批量模式：全选按钮 */}
                  {batchMode && (
                    <button
                      className="history-batch-selectall"
                      onClick={() => toggleSelectAll(activeGroup.sessions)}
                    >
                      {activeGroup.sessions.every((s) => batchSelected.has(s.sessionId)) ? '取消全选' : '全选'}
                    </button>
                  )}
                </div>
                <div className="history-session-rows">
                  {activeGroup.sessions.map((record) => {
                    const isActive = session.conversationSessionId === record.sessionId;
                    const isDeleting = deletingId === record.sessionId;
                    const isBatchChecked = batchSelected.has(record.sessionId);
                    // 找到该会话对应的 CLI projectDirName（用于删除文件）
                    const cliRec = cliSessions.find((s) => s.sessionId === record.sessionId);
                    const projectDirName = cliRec?.projectDirName ?? (activeGroup.key.includes('--') ? activeGroup.key : '');
                    return (
                      <div
                        key={record.sessionId}
                        className={`history-session-row ${isActive && !batchMode ? 'active' : ''} ${batchMode && isBatchChecked ? 'batch-checked' : ''}`}
                        onClick={() => {
                          if (batchMode) { toggleBatchSelect(record.sessionId); return; }
                          if (!isDeleting) handleSelectSession(record);
                        }}
                      >
                        {/* 批量模式 checkbox */}
                        {batchMode ? (
                          <input
                            type="checkbox"
                            className="history-session-checkbox"
                            checked={isBatchChecked}
                            onChange={() => toggleBatchSelect(record.sessionId)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div className={`history-session-dot ${isActive ? 'active' : ''}`} />
                        )}
                        <div className="history-session-content">
                          <div className="history-session-preview">
                            {record.preview || '（无预览内容）'}
                          </div>
                          <div className="history-session-meta">
                            <span className="history-session-id">{record.sessionId.slice(0, 12)}…</span>
                            <span className="history-session-time">
                              <Clock size={10} />
                              {formatFullTime(record.lastMessageAt)}
                            </span>
                          </div>
                        </div>
                        {isActive && !isDeleting && !batchMode && <div className="history-active-badge">当前</div>}
                        {/* 单条删除区域（非批量模式） */}
                        {!batchMode && (isDeleting ? (
                          <div className="history-session-delete-confirm" onClick={(e) => e.stopPropagation()}>
                            <span className="history-session-delete-tip">确认删除？</span>
                            <button
                              className="history-session-delete-ok"
                              onClick={(e) => { e.stopPropagation(); handleDeleteSession(record, projectDirName); }}
                            >
                              删除
                            </button>
                            <button
                              className="history-session-delete-cancel"
                              onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            className="history-session-delete-btn"
                            title="删除此会话"
                            onClick={(e) => { e.stopPropagation(); setDeletingId(record.sessionId); }}
                          >
                            <Trash2 size={13} />
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
                {/* 批量模式底部操作栏 */}
                {batchMode && (
                  <div className="history-batch-bar">
                    <span className="history-batch-count">
                      已选 {batchSelected.size} / {activeGroup.sessions.length} 条
                    </span>
                    <button
                      className="history-batch-delete-btn"
                      disabled={batchSelected.size === 0}
                      onClick={() => handleBatchDelete(activeGroup.sessions)}
                    >
                      <Trash2 size={13} />
                      删除所选 ({batchSelected.size})
                    </button>
                    <button className="history-batch-cancel-btn" onClick={toggleBatchMode}>
                      取消
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

