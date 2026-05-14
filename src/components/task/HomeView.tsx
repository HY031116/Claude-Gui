/**
 * HomeView — 首屏欢迎页（v3.0 两栏布局）
 * 左栏：会话列表（继续任务）+ 新建任务按钮
 * 右栏：3 统计卡片 + 最近修改文件 + 快速导航
 */
import { useMemo, useEffect, useState } from 'react';
import {
  Plus, FolderOpen, Clock, TrendingUp, Zap,
  GitBranch, SlidersHorizontal, Cpu, Hash, Trash2, FileText,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { ConversationRecord, TokenRecord } from '../../types';
import type { GitFile } from '../../types/electron.d';

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

  // 持久化会话列表
  const [persistedSessions, setPersistedSessions] = useState<PersistedSessionSummary[]>([]);
  // 最近修改文件（Git status）
  const [recentFiles, setRecentFiles] = useState<GitFile[]>([]);

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

  useEffect(() => {
    // 加载持久化会话列表
    window.electronAPI?.sessionList?.().then((res) => {
      if (res.success && res.sessions) setPersistedSessions(res.sessions);
    }).catch(() => {});

    // 加载 Git 最近修改文件
    const cwd = useAppStore.getState().session.workingDirectory;
    if (cwd) {
      window.electronAPI?.gitStatus?.(cwd).then((res) => {
        if (res.success && res.status) {
          const files = [
            ...(res.status.staged ?? []),
            ...(res.status.unstaged ?? []),
          ];
          const seen = new Set<string>();
          setRecentFiles(files.filter((f) => {
            if (seen.has(f.path)) return false;
            seen.add(f.path);
            return true;
          }).slice(0, 8));
        }
      }).catch(() => {});
    }
  }, []);

  // 最近 8 条会话（优先持久化来源）
  const recentSessions = useMemo<ConversationRecord[]>(() => {
    if (persistedSessions.length > 0) {
      return persistedSessions.slice(0, 8).map((s) => ({
        sessionId: s.sessionId,
        workingDirectory: s.workingDirectory,
        preview: s.title,
        startedAt: s.createdAt,
        lastMessageAt: s.updatedAt,
      }));
    }
    return [...conversationHistory]
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
      .slice(0, 8);
  }, [conversationHistory, persistedSessions]);

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

  const sessionCount = persistedSessions.length || conversationHistory.length;

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

        <button className="home-new-btn" onClick={onStartSession}>
          <Plus size={15} />
          新建任务
        </button>
      </div>

      {/* ── 右栏：概览面板 ── */}
      <div className="home-right">
        {/* 问候语 */}
        <div className="home-greeting-row">
          <Zap size={17} className="home-greeting-icon" />
          <span className="home-greeting-text">{getGreeting()}，准备好了吗？</span>
        </div>

        {/* 3 个统计卡片 */}
        <div className="home-stat-cards">
          <StatCard
            icon={<Hash size={15} />}
            value={String(sessionCount || '—')}
            label="历史会话"
          />
          <StatCard
            icon={<TrendingUp size={15} />}
            value={weekCost > 0 ? formatCost(weekCost) : '—'}
            label="本周消费"
            accent={weekCost > 0}
          />
          <StatCard
            icon={<FileText size={15} />}
            value={recentFiles.length > 0 ? String(recentFiles.length) : '—'}
            label="文件变更"
          />
        </div>

        {/* 本周消费柱状图 */}
        {tokenHistory.length > 0 && (
          <div className="home-section">
            <div className="home-section-header">
              <TrendingUp size={12} />
              <span>本周消费趋势</span>
              {totalCost > 0 && (
                <span className="home-section-meta">累计 {formatCost(totalCost)}</span>
              )}
            </div>
            <WeeklyChart records={tokenHistory} />
          </div>
        )}

        {/* 最近修改文件（有 Git 数据时显示） */}
        {recentFiles.length > 0 && (
          <div className="home-section">
            <div className="home-section-header">
              <GitBranch size={12} />
              <span>最近修改</span>
              <span className="home-section-meta">{getProjectName(session.workingDirectory)}</span>
            </div>
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
                </div>
              ))}
            </div>
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
            onClick={() => { setActiveNavSection('config'); setActiveAuxSubPanel('settings'); }}
          >
            <SlidersHorizontal size={12} />
            设置
          </button>
        </div>
      </div>
    </div>
  );
}
