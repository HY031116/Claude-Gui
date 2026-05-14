/**
 * MonitorView — 监控视图
 * 展示：实时指标仪表盘 + 上下文用量 + Token/成本统计 + 历史会话
 */
import { useMemo, useState } from 'react';
import { Info, DollarSign, Clock, Cpu, Activity } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { ContextPanel } from '../ContextPanel';
import { CostPanel } from '../CostPanel';
import { HistoryPanel } from '../HistoryPanel';

type MonitorTab = 'context' | 'cost' | 'sessions';

/** 格式化 token 数量 */
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** 格式化 USD */
function fmtCost(usd: number): string {
  if (usd < 0.0001) return '$0.00';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export function MonitorView() {
  const [activeTab, setActiveTab] = useState<MonitorTab>('context');
  const tokenUsage = useAppStore((s) => s.tokenUsage);
  const tokenHistory = useAppStore((s) => s.tokenHistory);
  const conversationHistory = useAppStore((s) => s.conversationHistory);
  const processingTabs = useAppStore((s) => s.processingTabs);

  // 当前上下文用量
  const totalTokens = (tokenUsage?.inputTokens ?? 0) + (tokenUsage?.outputTokens ?? 0);
  const contextLimit = 200_000;
  const usagePct = Math.min((totalTokens / contextLimit) * 100, 100);
  const usageColor = usagePct > 80 ? 'var(--danger, #ef4444)' : usagePct > 50 ? 'var(--warning, #f59e0b)' : 'var(--accent, #6366f1)';

  // 今日成本（从 tokenHistory 过滤）
  const todayCost = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return tokenHistory
      .filter((r) => r.timestamp >= todayStart.getTime())
      .reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
  }, [tokenHistory]);

  // 累计总成本
  const totalCost = useMemo(
    () => tokenHistory.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
    [tokenHistory],
  );

  // 活跃 agent 数量
  const activeAgentCount = Object.values(processingTabs).filter(Boolean).length;

  const tabs: { id: MonitorTab; label: string; icon: React.ElementType }[] = [
    { id: 'context', label: '上下文', icon: Info },
    { id: 'cost', label: '成本统计', icon: DollarSign },
    { id: 'sessions', label: '历史会话', icon: Clock },
  ];

  return (
    <div className="full-view">
      {/* 实时指标仪表盘 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1,
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
        background: 'var(--border-color)',
      }}>
        {/* 上下文用量 */}
        <div style={{ background: 'var(--bg-primary)', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Cpu size={12} style={{ color: usageColor }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>上下文</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: usageColor, lineHeight: 1 }}>
            {usagePct.toFixed(1)}%
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
            {fmtTokens(totalTokens)} / 200K
          </div>
          {/* 进度条 */}
          <div style={{ height: 2, background: 'var(--bg-hover)', borderRadius: 1, marginTop: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${usagePct}%`, background: usageColor, borderRadius: 1, transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* 今日成本 */}
        <div style={{ background: 'var(--bg-primary)', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <DollarSign size={12} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>今日成本</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
            {fmtCost(todayCost)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
            累计 {fmtCost(totalCost)}
          </div>
        </div>

        {/* 历史会话数 */}
        <div style={{ background: 'var(--bg-primary)', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Clock size={12} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>历史会话</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
            {conversationHistory.length}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
            今日 {conversationHistory.filter((r) => {
              const today = new Date(); today.setHours(0, 0, 0, 0);
              return r.lastMessageAt >= today.getTime();
            }).length} 次
          </div>
        </div>

        {/* 活跃 Agent */}
        <div style={{ background: 'var(--bg-primary)', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Activity size={12} style={{ color: activeAgentCount > 0 ? 'var(--accent, #6366f1)' : 'var(--text-secondary)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>活跃 Agent</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: activeAgentCount > 0 ? 'var(--accent, #6366f1)' : 'var(--text-primary)', lineHeight: 1 }}>
            {activeAgentCount}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
            {activeAgentCount > 0 ? '处理中…' : '全部空闲'}
          </div>
        </div>
      </div>

      <div className="view-tab-bar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`view-tab-btn${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="full-view-content">
        {activeTab === 'context' && <ContextPanel />}
        {activeTab === 'cost' && <CostPanel />}
        {activeTab === 'sessions' && <HistoryPanel />}
      </div>
    </div>
  );
}
