/**
 * CommandCenter — 指挥中心（默认首页）
 * Agent 中心设计 v3.0
 * 展示：介入待办队列 + Agent 舰队状态 + 今日统计
 */
import { useMemo, useCallback } from 'react';
import {
  AlertTriangle,
  Clock,
  DollarSign,
  FileEdit,
  GitBranch,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { NavClick } from '../../utils/nav';

interface CommandCenterProps {
  onNavClick: (id: NavClick) => void;
  onStartSession: () => void;
}

/** 格式化成本 */
function formatCost(usd?: number): string {
  if (!usd || usd < 0.0001) return '$0.00';
  return `$${usd.toFixed(4)}`;
}

/** 格式化相对时间 */
function formatRelTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min}m 前`;
  if (hr < 24) return `${hr}h 前`;
  return `${day}天前`;
}

/** 文件修改类工具名称 */
const FILE_MODIFY_TOOLS = new Set([
  'Write', 'write_file',
  'Edit', 'edit_file', 'str_replace_editor', 'str_replace_based_edit_tool',
  'MultiEdit', 'multiedit',
]);

export function CommandCenter({ onNavClick, onStartSession }: CommandCenterProps) {
  const session = useAppStore((s) => s.session);
  const messages = useAppStore((s) => s.messages);
  const processingTabs = useAppStore((s) => s.processingTabs);
  const tabs = useAppStore((s) => s.tabs);
  const tokenUsage = useAppStore((s) => s.tokenUsage);
  const conversationHistory = useAppStore((s) => s.conversationHistory);

  // 计算待审查变更数量
  const pendingChangesCount = useMemo(() => {
    let count = 0;
    for (const msg of messages) {
      for (const tc of msg.toolCalls ?? []) {
        if (FILE_MODIFY_TOOLS.has(tc.name) && tc.status === 'success' && !tc.diffReviewStatus) {
          count++;
        }
      }
    }
    return count;
  }, [messages]);

  // 处理中的 Tab 列表
  const processingTabList = useMemo(
    () => tabs.filter((t) => processingTabs[t.id]),
    [tabs, processingTabs],
  );

  // 今日会话数量
  const todaySessionCount = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return conversationHistory.filter((r) => r.lastMessageAt >= todayStart.getTime()).length;
  }, [conversationHistory]);

  // 今日总文件变更数
  const todayFileChanges = useMemo(() => {
    let count = 0;
    for (const msg of messages) {
      for (const tc of msg.toolCalls ?? []) {
        if (FILE_MODIFY_TOOLS.has(tc.name) && tc.status === 'success') {
          count++;
        }
      }
    }
    return count;
  }, [messages]);

  const handleDispatch = useCallback(() => {
    if (!session.isConnected) {
      onStartSession();
    }
    onNavClick('dispatch');
  }, [session.isConnected, onStartSession, onNavClick]);

  // 工作目录最后一段
  const projectName = session.workingDirectory
    ? session.workingDirectory.replace(/\\/g, '/').replace(/\/$/, '').split('/').pop() || '未知项目'
    : null;

  return (
    <div className="command-center">
      {/* 页头 */}
      <div className="command-center-header">
        <div>
          <h1 className="command-center-title">指挥中心</h1>
          <p className="command-center-subtitle">
            {projectName ? `项目：${projectName}` : '选择工作目录开始'}
            {session.isConnected && (
              <span className="status-dot connected" title="已连接" />
            )}
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={handleDispatch}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={14} />
          委派新任务
        </button>
      </div>

      {/* 介入队列 */}
      {(pendingChangesCount > 0 || processingTabList.length > 0) && (
        <section className="command-section">
          <div className="command-section-title">
            <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
            <span>介入队列</span>
            <span className="badge badge-warning">{pendingChangesCount + processingTabList.length}</span>
          </div>

          {/* 待审查变更 */}
          {pendingChangesCount > 0 && (
            <div className="intervention-card intervention-warning">
              <div className="intervention-card-left">
                <FileEdit size={16} style={{ color: '#f59e0b' }} />
                <div>
                  <div className="intervention-title">
                    {pendingChangesCount} 处文件变更待审查
                  </div>
                  <div className="intervention-desc">Claude 已修改代码，请确认变更内容</div>
                </div>
              </div>
              <div className="intervention-actions">
                <button
                  className="btn-sm btn-outline"
                  onClick={() => onNavClick('review')}
                >
                  查看变更
                </button>
              </div>
            </div>
          )}

          {/* 处理中的 Tab */}
          {processingTabList.map((tab) => (
            <div key={tab.id} className="intervention-card intervention-info">
              <div className="intervention-card-left">
                <RefreshCw size={16} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
                <div>
                  <div className="intervention-title">{tab.label} 正在执行</div>
                  <div className="intervention-desc">Agent 正在处理任务中…</div>
                </div>
              </div>
              <div className="intervention-actions">
                <button className="btn-sm btn-outline" onClick={() => onNavClick('dispatch')}>
                  查看日志
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Agent 状态卡片 */}
      <section className="command-section">
        <div className="command-section-title">
          <Layers size={14} />
          <span>会话状态</span>
          {tabs.length > 0 && (
            <span className="badge badge-default">{tabs.length} 个会话</span>
          )}
        </div>

        {tabs.length === 0 ? (
          <div className="empty-state-card">
            <Zap size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 8 }} />
            <p>还没有活跃会话</p>
            <button className="btn-primary" onClick={handleDispatch}>
              <Play size={13} />
              开始第一个任务
            </button>
          </div>
        ) : (
          <div className="agent-fleet-grid">
            {tabs.map((tab) => {
              const isProcessing = !!processingTabs[tab.id];
              return (
                <div
                  key={tab.id}
                  className={`agent-card${isProcessing ? ' agent-card-active' : ''}`}
                  onClick={() => onNavClick('dispatch')}
                >
                  <div className="agent-card-header">
                    <span
                      className="agent-status-dot"
                      style={{ background: isProcessing ? '#3b82f6' : '#6b7280' }}
                    />
                    <span className="agent-card-name">{tab.label}</span>
                    {isProcessing && (
                      <span className="agent-processing-badge">执行中</span>
                    )}
                  </div>
                  <div className="agent-card-footer">
                    <GitBranch size={11} style={{ color: 'var(--text-tertiary)' }} />
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                      {session.workingDirectory
                        ? session.workingDirectory.replace(/\\/g, '/').split('/').pop()
                        : '未选择目录'}
                    </span>
                  </div>
                </div>
              );
            })}
            <div
              className="agent-card agent-card-new"
              onClick={handleDispatch}
              title="新建会话"
            >
              <Plus size={20} style={{ color: 'var(--text-tertiary)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>新会话</span>
            </div>
          </div>
        )}
      </section>

      {/* 今日统计 */}
      <section className="command-section">
        <div className="command-section-title">
          <Clock size={14} />
          <span>今日统计</span>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{todaySessionCount}</div>
            <div className="stat-label">会话数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{todayFileChanges}</div>
            <div className="stat-label">文件变更</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {tokenUsage ? `${((tokenUsage.inputTokens + tokenUsage.outputTokens) / 1000).toFixed(1)}k` : '0'}
            </div>
            <div className="stat-label">Token 用量</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatCost(tokenUsage?.costUsd)}</div>
            <div className="stat-label">
              <DollarSign size={10} style={{ display: 'inline' }} />
              成本
            </div>
          </div>
        </div>
      </section>

      {/* 最近会话历史 */}
      {conversationHistory.length > 0 && (
        <section className="command-section">
          <div className="command-section-title">
            <Clock size={14} />
            <span>最近会话</span>
          </div>
          <div className="recent-sessions-list">
            {conversationHistory.slice(0, 5).map((record) => (
              <div key={record.sessionId} className="recent-session-item">
                <div className="recent-session-title">
                  {record.preview || '（无标题）'}
                </div>
                <div className="recent-session-meta">
                  <span>{formatRelTime(record.lastMessageAt)}</span>
                  {record.workingDirectory && (
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      ·{' '}
                      {record.workingDirectory.replace(/\\/g, '/').split('/').pop()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
