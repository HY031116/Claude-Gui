/**
 * HomeView — 首屏欢迎页（v3.0 两栏布局）
 * 左栏：会话列表（继续任务）+ 新建任务按钮
 * 右栏：3 统计卡片 + 最近修改文件 + 快速导航
 */
import { useMemo, useEffect, useState, useCallback } from 'react';
import {
  Plus, FolderOpen, Clock, TrendingUp, Zap,
  GitBranch, SlidersHorizontal, Cpu, Hash, Trash2, FileText, RefreshCw,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { WorkspaceSelector } from '../workspace/WorkspaceSelector';
import type { ConversationRecord, TokenRecord } from '../../types';

// 含本地修改时间的文件记录（扩展自 GitFile）
interface RecentGitFile {
  path: string;
  status: string;
  mtime?: number;
}

// ─── 工具函数 ───────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function formatRelTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min}m 前`;
  if (hr < 24) return `${hr}h 前`;
  if (day < 7) return `${day}天前`;
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function formatCost(usd: number): string {
  if (usd < 0.0001) return '<$0.0001';
  return `$${usd.toFixed(4)}`;
}

/** 取目录最后一段作为项目名 */
function getProjectName(workingDir?: string): string {
  if (!workingDir) return '（未知项目）';
  const parts = workingDir.replace(/\\/g, '/').replace(/\/$/, '').split('/');
  return parts[parts.length - 1] || workingDir;
}

/** 过去 N 天的零点时间戳 */
function getDayStart(daysAgo: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.getTime();
}

/** 格式化会话预览 */
function formatPreview(preview: string): string {
  const text = preview.replace(/@\S+/g, '').replace(/```[\s\S]*?```/g, '').trim();
  const line = text.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? text;
  return line.length > 45 ? line.slice(0, 45) + '…' : line || '（空会话）';
}

/** 格式化文件修改时间 */
function formatFileTime(mtime: number): string {
  const d = new Date(mtime);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const hm = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  if (d.toDateString() === today.toDateString()) return `今天 ${hm}`;
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${hm}`;
  const days = Math.floor((Date.now() - mtime) / 86400000);
  if (days < 7) return `${days}天前`;
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

/** 文件状态对应颜色 */
function getStatusColor(status: string): string {
  if (status === 'M' || status === 'modified') return 'var(--warning-text, #f59e0b)';
  if (status === 'A' || status === 'added') return 'var(--success-text, #22c55e)';
  if (status === 'D' || status === 'deleted') return 'var(--error-text, #ef4444)';
  return 'var(--text-muted)';
}

// ─── 子组件：会话卡片 ────────────────────────────────────────────────────────

interface SessionCardProps {
  record: ConversationRecord;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function SessionCard({ record, onClick, onDelete }: SessionCardProps) {
  const projectName = getProjectName(record.workingDirectory);
  const preview = formatPreview(record.preview);

  return (
    <div className="home-session-card-wrap">
      <button className="home-session-card" onClick={onClick} title={record.workingDirectory}>
        <div className="home-session-project">
          <FolderOpen size={11} />
          {projectName}
        </div>
        <div className="home-session-preview">{preview}</div>
        <div className="home-session-time">
          <Clock size={10} />
          {formatRelTime(record.lastMessageAt)}
        </div>
      </button>
      <button className="home-session-delete-btn" title="删除此会话记录" onClick={onDelete}>
        <Trash2 size={11} />
      </button>
    </div>
  );
}

// ─── 子组件：统计卡片 ────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  accent?: boolean;
}

function StatCard({ icon, value, label, accent }: StatCardProps) {
  return (
    <div className={`home-stat-card${accent ? ' home-stat-card--accent' : ''}`}>
      <div className="home-stat-card-icon">{icon}</div>
      <div className="home-stat-card-value">{value}</div>
      <div className="home-stat-card-label">{label}</div>
    </div>
  );
}

// ─── 子组件：7 天消费柱状图 ────────────────────────────────────────────────

interface DayCost { label: string; costUsd: number; }

function WeeklyChart({ records }: { records: TokenRecord[] }) {
  const days = useMemo<DayCost[]>(() => {
    const result: DayCost[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = getDayStart(i);
      const end = getDayStart(i - 1);
      const dayRecs = records.filter((r) => r.timestamp >= start && r.timestamp < end);
      const d = new Date(start);
      result.push({
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        costUsd: dayRecs.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
      });
    }
    return result;
  }, [records]);

  const maxCost = Math.max(...days.map((d) => d.costUsd), 0.0001);

  return (
    <div className="home-chart-bars">
      {days.map((day) => (
        <div key={day.label} className="home-chart-bar-col">
          <div
            className="home-chart-bar-inner"
            title={`${day.label}: ${formatCost(day.costUsd)}`}
            style={{ height: `${Math.max(4, (day.costUsd / maxCost) * 48)}px` }}
          />
          <span className="home-chart-bar-label">{day.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── 持久化会话摘要类型 ───────────────────────────────────────────────────────

interface PersistedSessionSummary {
  sessionId: string;
  title: string;
  workingDirectory: string;
  createdAt: number;
  updatedAt: number;
  tokenSummary: { inputTokens: number; outputTokens: number; costUsd?: number };
}

// ─── 主组件 ───────────────────────────────────────────────────────────────

interface HomeViewProps {
  onStartSession: () => void;
}

export function HomeView({ onStartSession }: HomeViewProps) {
  const conversationHistory = useAppStore((s) => s.conversationHistory);
  const tokenHistory = useAppStore((s) => s.tokenHistory);
  const setMessages = useAppStore((s) => s.setMessages);
  const setSession = useAppStore((s) => s.setSession);
  const clearMessages = useAppStore((s) => s.clearMessages);
  const session = useAppStore((s) => s.session);
  const setActiveNavSection = useAppStore((s) => s.setActiveNavSection);
  const setActiveAuxSubPanel = useAppStore((s) => s.setActiveAuxSubPanel);
  const activeWorkspacePath = useAppStore((s) => s.activeWorkspacePath);

  // 持久化会话列表
  const [persistedSessions, setPersistedSessions] = useState<PersistedSessionSummary[]>([]);
  // 最近修改文件（Git status + mtime）
  const [recentFiles, setRecentFiles] = useState<RecentGitFile[]>([]);
  // Git 分支信息
  const [gitBranch, setGitBranch] = useState('');
  const [gitAhead, setGitAhead] = useState(0);
  const [gitBehind, setGitBehind] = useState(0);
  const [gitLoading, setGitLoading] = useState(false);

  // 本周任务次数
  const weekSessionCount = useMemo(() => {
    const start = getDayStart(7);
    if (persistedSessions.length > 0) {
      return persistedSessions.filter((s) => s.updatedAt >= start).length;
    }
    return conversationHistory.filter((r) => r.lastMessageAt >= start).length;
  }, [persistedSessions, conversationHistory]);

  // 本周费用
  const weekCost = useMemo(() => {
    const start = getDayStart(7);
    return tokenHistory.filter((r) => r.timestamp >= start).reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
  }, [tokenHistory]);

  // 全局累计费用
  const totalCost = useMemo(
    () => tokenHistory.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
    [tokenHistory]
  );

  // 工作区级统计（activeWorkspacePath 为空则不计算）
  const wsSessionCount = useMemo(() => {
    if (!activeWorkspacePath) return null;
    if (persistedSessions.length > 0) {
      return persistedSessions.filter((s) => s.workingDirectory === activeWorkspacePath).length;
    }
    return conversationHistory.filter((r) => r.workingDirectory === activeWorkspacePath).length;
  }, [activeWorkspacePath, persistedSessions, conversationHistory]);

  const wsTotalCost = useMemo(() => {
    if (!activeWorkspacePath) return 0;
    return tokenHistory.filter((r) => r.workingDirectory === activeWorkspacePath)
      .reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
  }, [activeWorkspacePath, tokenHistory]);

  const wsTokenHistory = useMemo(() => {
    if (!activeWorkspacePath) return tokenHistory;
    return tokenHistory.filter((r) => r.workingDirectory === activeWorkspacePath);
  }, [activeWorkspacePath, tokenHistory]);

  /** 加载 Git 状态（响应 activeWorkspacePath / session.workingDirectory 变化） */
  const loadGitStatus = useCallback(async (cwd: string) => {
    if (!cwd) return;
    setGitLoading(true);
    try {
      const res = await window.electronAPI?.gitStatus?.(cwd);
      if (res?.success && res.status) {
        const { staged, unstaged, untracked, branch, ahead, behind } = res.status;
        setGitBranch(branch ?? '');
        setGitAhead(ahead ?? 0);
        setGitBehind(behind ?? 0);
        // staged + unstaged 去重聚合（staged 状态优先）
        const fileMap = new Map<string, string>();
        for (const f of (staged ?? [])) fileMap.set(f.path, f.status);
        for (const f of (unstaged ?? [])) if (!fileMap.has(f.path)) fileMap.set(f.path, f.status);
        for (const p of (untracked ?? [])) if (!fileMap.has(p)) fileMap.set(p, '?');
        const files = Array.from(fileMap.entries())
          .map(([path, status]) => ({ path, status }))
          .slice(0, 10);
        // 批量获取文件修改时间（按父目录分组调用 listDirectory）
        const dirSet = new Set<string>();
        for (const f of files) {
          const normalized = f.path.replace(/\\/g, '/');
          const lastSlash = normalized.lastIndexOf('/');
          dirSet.add(lastSlash >= 0 ? normalized.slice(0, lastSlash) : '');
        }
        const mtimeMap = new Map<string, number>();
        await Promise.all(Array.from(dirSet).map(async (relDir) => {
          const absDir = relDir ? `${cwd}/${relDir}` : cwd;
          try {
            const lr = await window.electronAPI?.listDirectory?.(absDir);
            if (lr?.success && Array.isArray(lr.entries)) {
              for (const entry of lr.entries) {
                const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
                if (entry.modified) mtimeMap.set(relPath, new Date(entry.modified).getTime());
              }
            }
          } catch { /* ignore */ }
        }));
        const filesWithMtime: RecentGitFile[] = files.map((f) => ({
          ...f,
          mtime: mtimeMap.get(f.path.replace(/\\/g, '/')),
        }));
        setRecentFiles(filesWithMtime);
      } else {
        setRecentFiles([]);
        setGitBranch('');
      }
    } catch {
      setRecentFiles([]);
    } finally {
      setGitLoading(false);
    }
  }, []);

  useEffect(() => {
    // 加载持久化会话列表
    window.electronAPI?.sessionList?.().then((res) => {
      if (res.success && res.sessions) setPersistedSessions(res.sessions);
    }).catch(() => {});

    // 加载 Git 最近修改文件：优先激活工作区，否则用当前会话目录
    const cwd = useAppStore.getState().activeWorkspacePath || useAppStore.getState().session.workingDirectory;
    if (cwd) loadGitStatus(cwd);
  }, [loadGitStatus]);

  // 工作区或会话目录变化时重新加载 Git 状态
  useEffect(() => {
    const cwd = activeWorkspacePath || session.workingDirectory;
    if (cwd) loadGitStatus(cwd);
  }, [activeWorkspacePath, session.workingDirectory, loadGitStatus]);

  // 最近 8 条会话（优先持久化来源）
  const recentSessions = useMemo<ConversationRecord[]>(() => {
    let records: ConversationRecord[];
    if (persistedSessions.length > 0) {
      records = persistedSessions.slice(0, 50).map((s) => ({
        sessionId: s.sessionId,
        workingDirectory: s.workingDirectory,
        preview: s.title,
        startedAt: s.createdAt,
        lastMessageAt: s.updatedAt,
      }));
    } else {
      records = [...conversationHistory].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    }
    // 按当前工作区过滤
    if (activeWorkspacePath) {
      records = records.filter((r) => r.workingDirectory === activeWorkspacePath);
    }
    return records.slice(0, 8);
  }, [conversationHistory, persistedSessions, activeWorkspacePath]);

  /** 删除持久化会话 */
  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await window.electronAPI?.sessionDelete?.(sessionId);
      const res = await window.electronAPI?.sessionList?.();
      if (res?.success && res.sessions) setPersistedSessions(res.sessions);
    } catch { /* 静默失败 */ }
  };

  /** 恢复历史会话 */
  const handleResume = async (record: ConversationRecord) => {
    clearMessages();
    setSession({ workingDirectory: record.workingDirectory, isConnected: false });
    try {
      const res = await window.electronAPI?.sessionLoad?.(record.sessionId);
      if (res?.success && res.data && typeof res.data === 'object') {
        const data = res.data as { messages?: unknown[] };
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages as Parameters<typeof setMessages>[0]);
          return;
        }
      }
    } catch { /* 回退 */ }
    setMessages([{
      id: 'history-preview',
      role: 'system',
      content: `已加载会话 ${record.sessionId}，点击连接后可继续。`,
      timestamp: Date.now(),
    }]);
  };

  return (
    <div className="home-view">
      {/* ── 左栏：会话列表 ── */}
      <div className="home-left">
        <div className="home-left-header">
          <span className="home-left-title">继续任务</span>
          {recentSessions.length > 0 && (
            <span className="home-left-count">{recentSessions.length}</span>
          )}
        </div>

        {/* 工作区选择器 */}
        <WorkspaceSelector />

        <div className="home-sessions-list">
          {recentSessions.length === 0 ? (
            <div className="home-sessions-empty">暂无历史会话</div>
          ) : (
            recentSessions.map((rec) => (
              <SessionCard
                key={rec.sessionId}
                record={rec}
                onClick={() => handleResume(rec)}
                onDelete={(e) => handleDelete(e, rec.sessionId)}
              />
            ))
          )}
        </div>

        <button className="home-new-btn" onClick={() => {
          // 若有激活工作区，将其设为新会话工作目录
          if (activeWorkspacePath) {
            setSession({ workingDirectory: activeWorkspacePath });
          }
          onStartSession();
        }}>
          <Plus size={15} />
          新建任务
        </button>
      </div>

      {/* ── 右栏：概览面板 ── */}
      <div className="home-right">
        {/* 工作区横幅卡片（激活工作区时显示） */}
        {activeWorkspacePath ? (
          <div className="home-workspace-banner">
            <FolderOpen size={15} className="home-workspace-icon" />
            <div className="home-workspace-info">
              <span className="home-workspace-name">{getProjectName(activeWorkspacePath)}</span>
              <span className="home-workspace-path">{activeWorkspacePath}</span>
            </div>
          </div>
        ) : (
          /* 无工作区时显示问候语 */
          <div className="home-greeting-row">
            <Zap size={17} className="home-greeting-icon" />
            <span className="home-greeting-text">{getGreeting()}，准备好了吗？</span>
          </div>
        )}

        {/* 3 个统计卡片 */}
        <div className="home-stat-cards">
          <StatCard
            icon={<Hash size={15} />}
            value={String(activeWorkspacePath ? (wsSessionCount ?? '—') : (weekSessionCount || '—'))}
            label={activeWorkspacePath ? '工作区会话' : '本周任务'}
          />
          <StatCard
            icon={<TrendingUp size={15} />}
            value={activeWorkspacePath
              ? (wsTotalCost > 0 ? formatCost(wsTotalCost) : '—')
              : (weekCost > 0 ? formatCost(weekCost) : '—')}
            label={activeWorkspacePath ? '工作区消耗' : '本周消费'}
            accent={activeWorkspacePath ? wsTotalCost > 0 : weekCost > 0}
          />
          <StatCard
            icon={<FileText size={15} />}
            value={recentFiles.length > 0 ? String(recentFiles.length) : '—'}
            label="文件变更"
          />
        </div>

        {/* 本周消费柱状图 */}
        {wsTokenHistory.length > 0 && (
          <div className="home-section">
            <div className="home-section-header">
              <TrendingUp size={12} />
              <span>{activeWorkspacePath ? '工作区消费趋势' : '本周消费趋势'}</span>
              {(activeWorkspacePath ? wsTotalCost : totalCost) > 0 && (
                <span className="home-section-meta">累计 {formatCost(activeWorkspacePath ? wsTotalCost : totalCost)}</span>
              )}
            </div>
            <WeeklyChart records={wsTokenHistory} />
          </div>
        )}

        {/* 最近修改文件（有 Git 数据时显示） */}
        {(recentFiles.length > 0 || gitBranch) && (activeWorkspacePath || session.workingDirectory) && (
          <div className="home-section">
            <div className="home-section-header">
              <GitBranch size={12} />
              <span>最近修改</span>
              {gitBranch && (
                <span className="home-section-meta">
                  {gitBranch}
                  {gitAhead > 0 && ` ↑${gitAhead}`}
                  {gitBehind > 0 && ` ↓${gitBehind}`}
                </span>
              )}
              <button
                className="home-git-refresh-btn"
                title="刷新 Git 状态"
                disabled={gitLoading}
                onClick={() => {
                  const cwd = activeWorkspacePath || session.workingDirectory;
                  if (cwd) loadGitStatus(cwd);
                }}
                style={{ marginLeft: 'auto' }}
              >
                <RefreshCw size={11} style={gitLoading ? { animation: 'spin 1s linear infinite' } : {}} />
              </button>
            </div>
            {recentFiles.length === 0 ? (
              <div className="home-section-empty">暂无未提交变更</div>
            ) : (
              <div className="home-recent-files">
                {recentFiles.map((file) => (
                  <div key={file.path} className="home-recent-file">
                    <span
                      className="home-recent-file-status"
                      style={{ color: getStatusColor(file.status) }}
                    >
                      {file.status.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="home-recent-file-name" title={file.path}>
                      {file.path.split('/').pop() ?? file.path}
                    </span>
                    <span className="home-recent-file-dir">
                      {file.path.includes('/') ? file.path.split('/').slice(0, -1).join('/') : ''}
                    </span>
                    {file.mtime && (
                      <span className="home-recent-file-time">{formatFileTime(file.mtime)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 快速跳转 */}
        <div className="home-quick-links">
          <button
            className="home-quick-link"
            onClick={() => { setActiveNavSection('project'); setActiveAuxSubPanel('changes'); }}
          >
            <GitBranch size={12} />
            Git 面板
          </button>
          <button
            className="home-quick-link"
            onClick={() => { setActiveNavSection('tools'); setActiveAuxSubPanel('mcp'); }}
          >
            <Cpu size={12} />
            MCP 工具
          </button>
          <button
            className="home-quick-link"
            onClick={() => { setActiveNavSection('tools'); setActiveAuxSubPanel('settings'); }}
          >
            <SlidersHorizontal size={12} />
            设置
          </button>
        </div>
      </div>
    </div>
  );
}
