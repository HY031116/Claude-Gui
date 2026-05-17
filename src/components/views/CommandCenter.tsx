/**
 * CommandCenter — 指挥中心（默认首页）
 * Agent 中心设计 v3.1：5 分组会话看板 + 会话图标系统 + Peek 快速预览面板
 */
import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import {
  Clock,
  FileEdit,
  Pin,
  PinOff,
  Play,
  Plus,
  StopCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { DISPATCH_AUX_SUBS, DISPATCH_AUX_DEFAULT } from '../../utils/nav';
import type { NavClick } from '../../utils/nav';
import type { Message, PlanStep } from '../../types';

interface CommandCenterProps {
  onNavClick: (id: NavClick) => void;
  onStartSession: () => void;
}

/** 格式化成本 */
function formatCost(usd?: number): string {
  if (!usd || usd < 0.0001) return '$0.00';
  return `$${usd.toFixed(2)}`;
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

/** 决策关键词（用于 needsInput 检测） */
const DECISION_KEYWORDS = [
  'which', 'should i', 'do you want', 'do you prefer',
  'would you like', 'please choose', 'please select',
  '哪种', '哪个', '你想要', '你希望', '请选择', '请确认',
  '方案 a', '方案 b', 'option a', 'option b',
];

type TabGroup = 'pinned' | 'needsInput' | 'pendingReview' | 'working' | 'done';
type SessionIcon = '✽' | '✻' | '∙';

interface EffectiveSnap {
  messages: Message[];
  activePlanSteps: PlanStep[];
  tokenUsage: { inputTokens: number; outputTokens: number; costUsd?: number } | null;
}

/** 检测 tab 是否在等待用户输入 */
function isNeedsInput(snap: EffectiveSnap, isProcessing: boolean): boolean {
  if (isProcessing) return false;
  const lastMsg = snap.messages.at(-1);
  if (!lastMsg || lastMsg.role !== 'assistant') return false;
  const text = typeof lastMsg.content === 'string' ? lastMsg.content : '';
  const endsWithQuestion = /[?？]\s*$/.test(text.trim());
  const hasKeyword = DECISION_KEYWORDS.some((kw) => text.toLowerCase().includes(kw));
  const hasOptionList = /\b(option|choice|方案|选项)\s*[A-D1-4][.)：:]/i.test(text);
  return endsWithQuestion || (hasKeyword && hasOptionList);
}

/** 检测 tab 是否有未审查的文件变更 */
function hasPendingChanges(snap: EffectiveSnap): boolean {
  return snap.messages.some((msg) =>
    msg.toolCalls?.some(
      (tc) => FILE_MODIFY_TOOLS.has(tc.name) && tc.status === 'success' && !tc.diffReviewStatus,
    ),
  );
}

/** 获取会话状态图标 */
function getSessionIcon(isProcessing: boolean, snap: EffectiveSnap): SessionIcon {
  if (isProcessing) return '✽';
  if (isNeedsInput(snap, false)) return '✻';
  return '∙';
}

/** 对 tab 进行分组分类 */
function classifyTab(
  tabId: string,
  isProcessing: boolean,
  snap: EffectiveSnap,
  pinnedTabIds: string[],
): TabGroup {
  if (pinnedTabIds.includes(tabId)) return 'pinned';
  if (isProcessing) return 'working';
  if (isNeedsInput(snap, false)) return 'needsInput';
  if (hasPendingChanges(snap)) return 'pendingReview';
  return 'done';
}

/** 从 messages 中找到最后一个工具调用的摘要 */
function getLastToolSummary(snap: EffectiveSnap): string {
  const runningStep = snap.activePlanSteps.find((s) => s.status === 'running');
  if (runningStep) return `${runningStep.label}：${runningStep.description}`;
  const lastStep = snap.activePlanSteps.at(-1);
  if (lastStep) return `${lastStep.label}：${lastStep.description}`;
  // 回退到 messages 中找最后工具调用
  for (let i = snap.messages.length - 1; i >= 0; i--) {
    const tc = snap.messages[i].toolCalls?.at(-1);
    if (tc) {
      const file = (tc.arguments?.path ?? tc.arguments?.file_path ?? '') as string;
      return `${tc.name}${file ? `：${file.split('/').pop()}` : ''}`;
    }
  }
  return '正在执行…';
}

/** 获取 tab 最后 assistant 消息的摘要（最多 120 字） */
function getLastAssistantPreview(snap: EffectiveSnap): string {
  for (let i = snap.messages.length - 1; i >= 0; i--) {
    if (snap.messages[i].role === 'assistant') {
      const text = typeof snap.messages[i].content === 'string' ? snap.messages[i].content : '';
      return text.length > 120 ? text.slice(0, 120) + '…' : text;
    }
  }
  return '';
}

/** 获取 tab 待审查文件列表（最多 3 条） */
function getPendingFiles(snap: EffectiveSnap): string[] {
  const files: string[] = [];
  for (const msg of snap.messages) {
    for (const tc of msg.toolCalls ?? []) {
      if (FILE_MODIFY_TOOLS.has(tc.name) && tc.status === 'success' && !tc.diffReviewStatus) {
        const path = (tc.arguments?.path ?? tc.arguments?.file_path ?? '') as string;
        if (path && !files.includes(path)) files.push(path);
        if (files.length >= 3) return files;
      }
    }
  }
  return files;
}

export function CommandCenter({ onNavClick, onStartSession }: CommandCenterProps) {
  const session = useAppStore((s) => s.session);
  const messages = useAppStore((s) => s.messages);
  const processingTabs = useAppStore((s) => s.processingTabs);
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const tabSnapshots = useAppStore((s) => s.tabSnapshots);
  const tokenUsage = useAppStore((s) => s.tokenUsage);
  const activePlanSteps = useAppStore((s) => s.activePlanSteps);
  const conversationHistory = useAppStore((s) => s.conversationHistory);
  const pinnedTabIds = useAppStore((s) => s.pinnedTabIds);
  const togglePinTab = useAppStore((s) => s.togglePinTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setPendingMonitorTab = useAppStore((s) => s.setPendingMonitorTab);
  const setPendingHighlightSessionId = useAppStore((s) => s.setPendingHighlightSessionId);

  // Peek 展开状态
  const [expandedTabId, setExpandedTabId] = useState<string | null>(null);
  const peekInputRef = useRef<HTMLInputElement>(null);

  // 展开 Peek 时自动聚焦输入框
  useEffect(() => {
    if (expandedTabId && peekInputRef.current) {
      peekInputRef.current.focus();
    }
  }, [expandedTabId]);

  /** 获取指定 tab 的有效快照（当前活跃 tab 用 live state） */
  const getSnap = useCallback(
    (tabId: string): EffectiveSnap => {
      if (tabId === activeTabId) {
        return { messages, activePlanSteps, tokenUsage };
      }
      const snap = tabSnapshots[tabId];
      return snap ?? { messages: [], activePlanSteps: [], tokenUsage: null };
    },
    [activeTabId, messages, activePlanSteps, tokenUsage, tabSnapshots],
  );

  // 今日统计
  const todaySessionCount = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return conversationHistory.filter((r) => r.lastMessageAt >= todayStart.getTime()).length;
  }, [conversationHistory]);

  const todayFileChanges = useMemo(() => {
    let count = 0;
    for (const tab of tabs) {
      const snap = getSnap(tab.id);
      for (const msg of snap.messages) {
        for (const tc of msg.toolCalls ?? []) {
          if (FILE_MODIFY_TOOLS.has(tc.name) && tc.status === 'success') count++;
        }
      }
    }
    return count;
  }, [tabs, getSnap]);

  // 所有 tab 合并成本（活跃 tab 用 live tokenUsage）
  const totalCostUsd = useMemo(() => {
    let total = 0;
    for (const tab of tabs) {
      const snap = getSnap(tab.id);
      total += snap.tokenUsage?.costUsd ?? 0;
    }
    return total;
  }, [tabs, getSnap]);

  // 按分组分类 tabs
  const grouped = useMemo(() => {
    const pinned: string[] = [];
    const needsInput: string[] = [];
    const pendingReview: string[] = [];
    const working: string[] = [];
    const done: string[] = [];

    for (const tab of tabs) {
      const snap = getSnap(tab.id);
      const isProcessing = !!processingTabs[tab.id];
      const group = classifyTab(tab.id, isProcessing, snap, pinnedTabIds);
      if (group === 'pinned') pinned.push(tab.id);
      else if (group === 'working') working.push(tab.id);
      else if (group === 'needsInput') needsInput.push(tab.id);
      else if (group === 'pendingReview') pendingReview.push(tab.id);
      else done.push(tab.id);
    }
    return { pinned, needsInput, pendingReview, working, done };
  }, [tabs, processingTabs, pinnedTabIds, getSnap]);

  const tabById = useMemo(() => new Map(tabs.map((t) => [t.id, t])), [tabs]);

  const handleGoToTab = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      // 直接读取最新 store 状态进行导航，避免 onNavClick 闭包捕获旧 activeNavSection
      // 导致 computeNavTransition 误认为已在 dispatch 而 toggle 回 command
      const store = useAppStore.getState();
      const sub = (DISPATCH_AUX_SUBS as readonly string[]).includes(store.activeAuxSubPanel)
        ? store.activeAuxSubPanel
        : DISPATCH_AUX_DEFAULT;
      store.setActiveNavSection('dispatch');
      store.setActiveAuxSubPanel(sub);
    },
    [setActiveTab],
  );

  const handleGoToSessions = useCallback(
    (sessionId?: string) => {
      if (sessionId) setPendingHighlightSessionId(sessionId);
      setPendingMonitorTab('sessions');
      onNavClick('monitor');
    },
    [setPendingHighlightSessionId, setPendingMonitorTab, onNavClick],
  );

  const handleNewTab = useCallback(() => {
    onStartSession();
    onNavClick('dispatch');
  }, [onStartSession, onNavClick]);

  const handleTogglePeek = useCallback((tabId: string) => {
    setExpandedTabId((prev) => (prev === tabId ? null : tabId));
  }, []);

  /** 渲染单个会话行 */
  const renderSessionRow = useCallback(
    (tabId: string, group: TabGroup) => {
      const tab = tabById.get(tabId);
      if (!tab) return null;
      const snap = getSnap(tabId);
      const isProcessing = !!processingTabs[tabId];
      const icon = getSessionIcon(isProcessing, snap);
      const isPinned = pinnedTabIds.includes(tabId);
      const isExpanded = expandedTabId === tabId;
      const isActive = tabId === activeTabId;

      // 会话副标题
      let subtitle = '';
      if (group === 'working') subtitle = getLastToolSummary(snap);
      else if (group === 'needsInput') subtitle = getLastAssistantPreview(snap);
      else if (group === 'pendingReview') {
        const files = getPendingFiles(snap);
        subtitle = files.length > 0 ? files.map((f) => f.split(/[\\/]/).pop()).join('、') : '有未审查变更';
      } else if (group === 'done') subtitle = getLastAssistantPreview(snap);
      else if (group === 'pinned') {
        const realGroup = classifyTab(tabId, isProcessing, snap, []);
        if (realGroup === 'working') subtitle = getLastToolSummary(snap);
        else subtitle = getLastAssistantPreview(snap);
      }

      return (
        <div key={tabId} className={`cc-session-row-wrap${isActive ? ' cc-session-row-wrap--active' : ''}`}>
          <div
            className="cc-session-row"
            onClick={() => handleTogglePeek(tabId)}
            title={`点击展开预览 · 双击进入对话`}
            onDoubleClick={() => handleGoToTab(tabId)}
          >
            {/* 状态图标 */}
            <span
              className={`cc-session-icon cc-session-icon--${
                isProcessing ? 'working' : isNeedsInput(snap, false) ? 'needs-input' : 'done'
              }`}
              title={isProcessing ? '执行中' : isNeedsInput(snap, false) ? '等待输入' : '已完成'}
            >
              {icon}
            </span>

            {/* 名称 + 副标题 */}
            <div className="cc-session-info">
              <span className="cc-session-name">{tab.label}</span>
              {subtitle && (
                <span className="cc-session-subtitle">{subtitle}</span>
              )}
            </div>

            {/* 右侧操作区 */}
            <div className="cc-session-actions" onClick={(e) => e.stopPropagation()}>
              <button
                className={`cc-action-btn${isPinned ? ' cc-action-btn--active' : ''}`}
                onClick={() => togglePinTab(tabId)}
                title={isPinned ? '取消置顶' : '置顶'}
              >
                {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
              </button>
              <button
                className="cc-action-btn"
                onClick={() => handleGoToTab(tabId)}
                title="进入对话"
              >
                <ExternalLink size={12} />
              </button>
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </div>
          </div>

          {/* Peek 面板 */}
          {isExpanded && (
            <div className="cc-peek">
              {(group === 'working' || (group === 'pinned' && isProcessing)) && (
                <>
                  <p className="cc-peek-text">{getLastToolSummary(snap)}</p>
                  <div className="cc-peek-btns">
                    <button className="btn-sm btn-primary" onClick={() => handleGoToTab(tabId)}>
                      查看完整日志
                    </button>
                    <button className="btn-sm btn-outline" style={{ color: 'var(--error, #ef4444)' }}>
                      <StopCircle size={11} /> 停止
                    </button>
                  </div>
                </>
              )}
              {(group === 'needsInput' || (group === 'pinned' && !isProcessing && isNeedsInput(snap, false))) && (
                <>
                  <p className="cc-peek-text">{getLastAssistantPreview(snap)}</p>
                  <div className="cc-peek-btns">
                    <button className="btn-sm btn-primary" onClick={() => handleGoToTab(tabId)}>
                      去回复
                    </button>
                  </div>
                </>
              )}
              {(group === 'pendingReview') && (
                <>
                  <div className="cc-peek-files">
                    {getPendingFiles(snap).map((f) => (
                      <span key={f} className="cc-peek-file-tag">
                        <FileEdit size={10} />
                        {f.split(/[\\/]/).pop()}
                      </span>
                    ))}
                  </div>
                  <div className="cc-peek-btns">
                    <button className="btn-sm btn-primary" onClick={() => onNavClick('review')}>
                      查看变更
                    </button>
                    <button className="btn-sm btn-outline" onClick={() => handleGoToTab(tabId)}>
                      进入对话
                    </button>
                  </div>
                </>
              )}
              {group === 'done' && (
                <>
                  <p className="cc-peek-text">{getLastAssistantPreview(snap)}</p>
                  <div className="cc-peek-btns">
                    <button className="btn-sm btn-primary" onClick={() => handleGoToTab(tabId)}>
                      继续对话
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      );
    },
    [
      tabById, getSnap, processingTabs, pinnedTabIds, expandedTabId, activeTabId,
      handleGoToTab, handleTogglePeek, togglePinTab, onNavClick,
    ],
  );

  /** 渲染分组 section */
  const renderGroup = useCallback(
    (
      label: string,
      emoji: string,
      tabIds: string[],
      group: TabGroup,
      accentColor?: string,
    ) => {
      if (tabIds.length === 0) return null;
      return (
        <section className="command-section" key={group}>
          <div className="command-section-title">
            <span>{emoji}</span>
            <span>{label}</span>
            <span className="badge badge-default">{tabIds.length}</span>
            {accentColor && <span style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor, marginLeft: 2 }} />}
          </div>
          <div className="cc-session-list">
            {tabIds.map((id) => renderSessionRow(id, group))}
          </div>
        </section>
      );
    },
    [renderSessionRow],
  );

  // 工作目录最后一段
  const projectName = session.workingDirectory
    ? session.workingDirectory.replace(/\\/g, '/').replace(/\/$/, '').split('/').pop() || '未知项目'
    : null;

  // 节省时间估算（每次文件变更约 2 分钟）
  const estimatedMinutesSaved = todayFileChanges * 2;

  const hasAnySessions = tabs.length > 0;

  return (
    <div className="command-center">
      {/* 页头 */}
      <div className="command-center-header">
        <div>
          <h1 className="command-center-title">指挥中心</h1>
          <p className="command-center-subtitle">
            {projectName ? `项目：${projectName}` : '就绪，等待新任务'}
            {session.isConnected && (
              <span className="status-dot connected" title="已连接" style={{ marginLeft: 6 }} />
            )}
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={handleNewTab}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={14} />
          新建任务
        </button>
      </div>

      {/* 空状态 */}
      {!hasAnySessions && (
        <div className="empty-state-card" style={{ marginTop: 8 }}>
          <Zap size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 8 }} />
          <p>还没有活跃会话</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            前往<strong>委派</strong>视图，设置工作目录并描述任务即可启动
          </p>
          <button className="btn-primary" onClick={handleNewTab} style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Play size={13} />
            开始第一个任务
          </button>
        </div>
      )}

      {/* 5 分组会话看板 */}
      {hasAnySessions && (
        <>
          {renderGroup('置顶', '📌', grouped.pinned, 'pinned')}
          {renderGroup('需要输入', '🟡', grouped.needsInput, 'needsInput', '#f59e0b')}
          {renderGroup('PR 待审查', '📋', grouped.pendingReview, 'pendingReview', '#3b82f6')}
          {renderGroup('工作中', '⚙', grouped.working, 'working', '#10b981')}
          {renderGroup('已完成', '✅', grouped.done, 'done')}
        </>
      )}

      {/* 今日统计栏 */}
      <div className="cc-stats-bar">
        <span>今日：</span>
        <strong>{todaySessionCount}</strong> 会话
        <span className="cc-stats-sep">·</span>
        <strong>{todayFileChanges}</strong> 变更
        <span className="cc-stats-sep">·</span>
        <strong>{formatCost(totalCostUsd)}</strong>
        {estimatedMinutesSaved > 0 && (
          <>
            <span className="cc-stats-sep">·</span>
            节省 ~<strong>{estimatedMinutesSaved}</strong> 分钟
          </>
        )}
      </div>

      {/* 最近会话历史 */}
      {conversationHistory.length > 0 && (
        <section className="command-section">
          <div className="command-section-title">
            <Clock size={14} />
            <span>最近会话</span>
            <button
              onClick={() => handleGoToSessions()}
              style={{
                marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: 'var(--accent, #6366f1)', padding: '0 4px',
              }}
            >
              查看全部 →
            </button>
          </div>
          <div className="recent-sessions-list">
            {conversationHistory.slice(0, 5).map((record) => (
              <div
                key={record.sessionId}
                className="recent-session-item"
                onClick={() => handleGoToSessions(record.sessionId)}
                style={{ cursor: 'pointer' }}
                title="点击查看历史会话"
              >
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
