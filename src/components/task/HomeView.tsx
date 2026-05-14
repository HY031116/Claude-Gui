/**
 * HomeView — 首屏欢迎页
 * 在无活跃会话（未连接 + 无消息）时展示
 * 提供：快速新建任务、快速导航、最近会话入口、本周消费概览、全局统计
 */
import { useMemo, useEffect, useState } from 'react';
import { Plus, FolderOpen, Clock, TrendingUp, Zap, GitBranch, SlidersHorizontal, Cpu, Hash, MapPin, Trash2 } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { ConversationRecord, TokenRecord } from '../../types';

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

/** 格式化会话预览（截取 50 字符） */
function formatPreview(preview: string): string {
  const text = preview.replace(/@\S+/g, '').replace(/```[\s\S]*?```/g, '').trim();
  const line = text.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? text;
  return line.length > 50 ? line.slice(0, 50) + '…' : line || '（空会话）';
}

// ─── 子组件：快速导航按钮组 ─────────────────────────────────────────────────

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  section: 'tools' | 'config' | 'project';
  sub?: string;
}

function QuickActions() {
  const setActiveNavSection = useAppStore((s) => s.setActiveNavSection);
  const setActiveAuxSubPanel = useAppStore((s) => s.setActiveAuxSubPanel);

  const actions: QuickAction[] = [
    { icon: <GitBranch size={13} />, label: 'Git 变更', section: 'project', sub: 'changes' },
    { icon: <Cpu size={13} />, label: 'MCP 工具', section: 'tools', sub: 'mcp' },
    { icon: <SlidersHorizontal size={13} />, label: '设置', section: 'config', sub: 'settings' },
  ];

  const handleClick = (action: QuickAction) => {
    setActiveNavSection(action.section);
    if (action.sub) setActiveAuxSubPanel(action.sub);
  };

  return (
    <div className="home-quick-actions">
      {actions.map((a) => (
        <button key={a.label} className="home-quick-btn" onClick={() => handleClick(a)}>
          {a.icon}
          {a.label}
        </button>
      ))}
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
  const totalCost = days.reduce((sum, d) => sum + d.costUsd, 0);

  return (
    <div className="home-chart-wrap">
      <div className="home-chart-header">
        <span className="home-chart-title">
          <TrendingUp size={14} />
          本周消费
        </span>
        <span className="home-chart-total">{formatCost(totalCost)}</span>
      </div>
      <div className="home-chart-bars">
        {days.map((day) => (
          <div key={day.label} className="home-chart-bar-col">
            <div
              className="home-chart-bar-inner"
              title={`${day.label}: ${formatCost(day.costUsd)}`}
              style={{ height: `${Math.max(4, (day.costUsd / maxCost) * 60)}px` }}
            />
            <span className="home-chart-bar-label">{day.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 子组件：最近会话卡片 ──────────────────────────────────────────────────

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
          <FolderOpen size={12} />
          {projectName}
        </div>
        <div className="home-session-preview">{preview}</div>
        <div className="home-session-time">
          <Clock size={10} />
          {formatRelTime(record.lastMessageAt)}
        </div>
      </button>
      <button
        className="home-session-delete-btn"
        title="删除此会话记录"
        onClick={onDelete}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────────────

interface HomeViewProps {
  onStartSession: () => void;
}

/** 持久化会话摘要（从 userData/sessions/*.json 读取） */
interface PersistedSessionSummary {
  sessionId: string;
  title: string;
  workingDirectory: string;
  createdAt: number;
  updatedAt: number;
  tokenSummary: { inputTokens: number; outputTokens: number; costUsd?: number };
}

export function HomeView({ onStartSession }: HomeViewProps) {
  const conversationHistory = useAppStore((s) => s.conversationHistory);
  const tokenHistory = useAppStore((s) => s.tokenHistory);
  const setMessages = useAppStore((s) => s.setMessages);
  const setSession = useAppStore((s) => s.setSession);
  const clearMessages = useAppStore((s) => s.clearMessages);
  const session = useAppStore((s) => s.session);

  // 持久化会话列表（从 userData/sessions/ 读取）
  const [persistedSessions, setPersistedSessions] = useState<PersistedSessionSummary[]>([]);

  useEffect(() => {
    window.electronAPI?.sessionList?.().then((res) => {
      if (res.success && res.sessions) {
        setPersistedSessions(res.sessions);
      }
    }).catch(() => {});
  }, []);

  // 今日消费
  const todayCost = useMemo(() => {
    const start = getDayStart(0);
    return tokenHistory
      .filter((r) => r.timestamp >= start)
      .reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
  }, [tokenHistory]);

  // 全局累计消费
  const totalCost = useMemo(
    () => tokenHistory.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
    [tokenHistory]
  );

  // 当前日期显示
  const [dateStr, setDateStr] = useState(() =>
    new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setDateStr(new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // 最近 6 条会话：优先使用持久化来源，回退到 localStorage 历史
  const recentSessions = useMemo<ConversationRecord[]>(() => {
    if (persistedSessions.length > 0) {
      // 将持久化格式映射为 ConversationRecord 兼容格式
      return persistedSessions.slice(0, 6).map((s) => ({
        sessionId: s.sessionId,
        workingDirectory: s.workingDirectory,
        preview: s.title,
        startedAt: s.createdAt,
        lastMessageAt: s.updatedAt,
      }));
    }
    return [...conversationHistory]
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
      .slice(0, 6);
  }, [conversationHistory, persistedSessions]);

  /** 删除持久化会话 */
  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await window.electronAPI?.sessionDelete?.(sessionId);
      // 刷新持久化列表
      const res = await window.electronAPI?.sessionList?.();
      if (res?.success && res.sessions) {
        setPersistedSessions(res.sessions);
      }
    } catch { /* 静默失败 */ }
  };

  /** 点击历史会话：优先从持久化加载完整消息 */
  const handleResume = async (record: ConversationRecord) => {
    clearMessages();
    setSession({ workingDirectory: record.workingDirectory, isConnected: false });

    // 尝试从持久化存储加载完整消息
    try {
      const res = await window.electronAPI?.sessionLoad?.(record.sessionId);
      if (res?.success && res.data && typeof res.data === 'object') {
        const data = res.data as { messages?: unknown[] };
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages as Parameters<typeof setMessages>[0]);
          return;
        }
      }
    } catch { /* 回退到提示消息 */ }

    // 无持久化数据时显示提示
    setMessages([{
      id: 'history-preview',
      role: 'system',
      content: `已切换到会话 ${record.sessionId}，点击连接后可使用 --resume 继续上下文。`,
      timestamp: Date.now(),
    }]);
  };

  return (
    <div className="home-view">
      {/* ── 顶部问候区 ── */}
      <div className="home-header">
        <div className="home-greeting">
          <Zap size={20} className="home-greeting-icon" />
          <span>{getGreeting()}，准备好了吗？</span>
        </div>
        <div className="home-date">{dateStr}</div>
        {/* 全局统计小徽章 */}
        {(conversationHistory.length > 0 || totalCost > 0) && (
          <div className="home-stats-row">
            {conversationHistory.length > 0 && (
              <span className="home-stat-item">
                <Hash size={10} />
                {conversationHistory.length} 次会话
              </span>
            )}
            {totalCost > 0 && (
              <span className="home-stat-item">
                <TrendingUp size={10} />
                累计 {formatCost(totalCost)}
              </span>
            )}
            {todayCost > 0 && (
              <span className="home-stat-item home-stat-today">
                今日 {formatCost(todayCost)}
              </span>
            )}
          </div>
        )}
        {/* 当前工作目录 */}
        {session.workingDirectory && (
          <div className="home-workdir">
            <MapPin size={10} />
            <span title={session.workingDirectory}>
              {getProjectName(session.workingDirectory)}
            </span>
          </div>
        )}
      </div>

      {/* ── 主 CTA ── */}
      <button className="home-start-btn" onClick={onStartSession}>
        <Plus size={18} />
        开始新任务
      </button>

      {/* ── 快速导航 ── */}
      <QuickActions />

      {/* ── 内容区（最近会话 + 本周图表）── */}
      <div className="home-content">
        {/* 最近会话 */}
        {recentSessions.length > 0 && (
          <section className="home-section">
            <h3 className="home-section-title">最近会话</h3>
            <div className="home-sessions-grid">
              {recentSessions.map((rec) => (
                <SessionCard
                  key={rec.sessionId}
                  record={rec}
                  onClick={() => handleResume(rec)}
                  onDelete={(e) => handleDelete(e, rec.sessionId)}
                />
              ))}
            </div>
          </section>
        )}

        {/* 本周消费 */}
        {tokenHistory.length > 0 && (
          <section className="home-section">
            <WeeklyChart records={tokenHistory} />
          </section>
        )}

        {/* 空状态引导 */}
        {recentSessions.length === 0 && tokenHistory.length === 0 && (
          <div className="home-empty">
            <p>没有历史记录</p>
            <p className="home-empty-sub">点击上方"开始新任务"连接 Claude CLI，开始编码吧！</p>
          </div>
        )}
      </div>
    </div>
  );
}
