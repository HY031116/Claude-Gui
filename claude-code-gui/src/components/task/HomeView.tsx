/**
 * HomeView — 首屏欢迎页
 * 在无活跃会话（未连接 + 无消息）时展示
 * 提供：快速新建任务、最近会话入口、本周消费概览
 */
import { useMemo, useEffect, useState } from 'react';
import { Plus, FolderOpen, Clock, TrendingUp, Zap } from 'lucide-react';
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
}

function SessionCard({ record, onClick }: SessionCardProps) {
  const projectName = getProjectName(record.workingDirectory);
  const preview = formatPreview(record.preview);

  return (
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
  );
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

  // 今日消费
  const todayCost = useMemo(() => {
    const start = getDayStart(0);
    return tokenHistory
      .filter((r) => r.timestamp >= start)
      .reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
  }, [tokenHistory]);

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

  // 最近 6 条会话（最新优先）
  const recentSessions = useMemo<ConversationRecord[]>(() => {
    return [...conversationHistory]
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
      .slice(0, 6);
  }, [conversationHistory]);

  /** 点击历史会话：清理当前 tab 状态后跳转到该会话（UI 仅显示历史消息，不自动重连） */
  const handleResume = (record: ConversationRecord) => {
    clearMessages();
    setSession({ workingDirectory: record.workingDirectory, isConnected: false });
    // 简单加载历史预览（真正的 --resume 在 onStartSession 后由 CLI 处理）
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
        {todayCost > 0 && (
          <div className="home-today-cost">
            今日消费：<strong>{formatCost(todayCost)}</strong>
          </div>
        )}
      </div>

      {/* ── 主 CTA ── */}
      <button className="home-start-btn" onClick={onStartSession}>
        <Plus size={18} />
        开始新任务
      </button>

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
