/**
 * AgentTeamsPanel — Agent Teams 看板（实验性功能）
 * 需要 CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 才可完整使用。
 */
import { useEffect, useState, useCallback } from 'react';
import { Users, Crown, AlertTriangle, Settings, Plus, MessageSquare, X, ExternalLink } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';

// ── 数据类型 ──────────────────────────────────────────────────────────────

type TeammateStatus = 'active' | 'idle' | 'done' | 'error';
type TaskStatus = 'pending' | 'in_progress' | 'done' | 'rejected';

interface TeammateState {
  id: string;
  displayName: string;
  status: TeammateStatus;
  currentTask?: string;
  lastMessage?: string;
}

interface SharedTask {
  id: string;
  description: string;
  assignedTo?: string;
  status: TaskStatus;
}

interface AgentTeamState {
  teamName?: string;
  teammates: TeammateState[];
  tasks: SharedTask[];
  leadStatus: string;
}

const STATUS_ICON: Record<TeammateStatus, string> = {
  active: '🔵',
  idle: '🟢',
  done: '🟣',
  error: '🔴',
};

const STATUS_LABEL: Record<TeammateStatus, string> = {
  active: '活跃',
  idle: '等待任务',
  done: '完成',
  error: '错误',
};

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: '待领取',
  in_progress: '进行中',
  done: '✅',
  rejected: '拒绝',
};

// ── 主组件 ────────────────────────────────────────────────────────────────

export function AgentTeamsPanel() {
  const [enabled, setEnabled] = useState<boolean | null>(null); // null = loading
  const [team, setTeam] = useState<AgentTeamState | null>(null);
  const [inlineMsg, setInlineMsg] = useState<Record<string, string>>({});
  const setActiveNavSection = useAppStore((s) => s.setActiveNavSection);

  // 检查 env 变量是否启用
  useEffect(() => {
    window.electronAPI.loadSettings().then((res) => {
      if (res.success && res.settings) {
        const envVars: Record<string, string> = res.settings.env ?? {};
        setEnabled(envVars['CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS'] === '1');
      } else {
        setEnabled(false);
      }
    }).catch(() => setEnabled(false));
  }, []);

  const handleEnable = useCallback(async () => {
    const res = await window.electronAPI.loadSettings();
    if (!res.success) return;
    const current = res.settings ?? {};
    const newEnv = { ...(current.env ?? {}), CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' };
    await window.electronAPI.saveSettings({ ...current, env: newEnv });
    setEnabled(true);
  }, []);

  const handleGoToSettings = useCallback(() => {
    setActiveNavSection('settings');
  }, [setActiveNavSection]);

  const handleCreateTeam = useCallback(() => {
    // 跳转到 Dispatch 新建 Tab，发送创建团队的引导消息
    setActiveNavSection('dispatch');
  }, [setActiveNavSection]);

  const handleSendToTeammate = useCallback((id: string) => {
    const msg = inlineMsg[id]?.trim();
    if (!msg || !team) return;
    const formatted = `[Send to ${id}]: ${msg}`;
    // 向 Lead 发送转发消息（Lead 负责路由给 Teammate）
    const activeTabId = useAppStore.getState().activeTabId;
    const snap = useAppStore.getState().tabSnapshots[activeTabId];
    if (snap) {
      window.electronAPI.cliSendMessage(
        formatted,
        snap.session.workingDirectory || undefined,
        snap.session.conversationSessionId || undefined,
        undefined,
        undefined,
        activeTabId,
      ).catch(() => {});
    }
    setInlineMsg((prev) => ({ ...prev, [id]: '' }));
  }, [inlineMsg, team]);

  const handleCloseTeammate = useCallback((id: string) => {
    if (!team) return;
    const msg = `Please stop ${id} and clean up.`;
    const activeTabId = useAppStore.getState().activeTabId;
    const snap = useAppStore.getState().tabSnapshots[activeTabId];
    if (snap) {
      window.electronAPI.cliSendMessage(
        msg,
        snap.session.workingDirectory || undefined,
        snap.session.conversationSessionId || undefined,
        undefined,
        undefined,
        activeTabId,
      ).catch(() => {});
    }
    setTeam((prev) => prev ? { ...prev, teammates: prev.teammates.filter((t) => t.id !== id) } : null);
  }, [team]);

  // ── Loading ──

  if (enabled === null) {
    return <div className="agent-teams-loading">正在检查功能状态…</div>;
  }

  // ── 未启用 ──

  if (!enabled) {
    return (
      <div className="agent-teams-disabled">
        <div className="agent-teams-warning-banner">
          <AlertTriangle size={16} />
          <span>Agent Teams 处于实验阶段，需要先启用环境变量</span>
        </div>
        <div className="agent-teams-env-hint">
          <code>CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1</code>
        </div>
        <div className="agent-teams-actions">
          <button className="at-btn at-btn--primary" onClick={handleEnable}>
            <Settings size={13} />
            立即启用（写入 settings.json）
          </button>
          <button className="at-btn" onClick={handleGoToSettings}>
            <ExternalLink size={13} />
            前往设置面板
          </button>
        </div>
        <p className="agent-teams-note">
          启用后，下次发起新会话时生效。Lead 负责协调，Teammate 并行执行子任务。
        </p>
      </div>
    );
  }

  // ── 已启用但无活跃团队 ──

  if (!team) {
    return (
      <div className="agent-teams-empty">
        <Users size={32} className="agent-teams-empty-icon" />
        <h3 className="agent-teams-empty-title">暂无活跃的 Agent 团队</h3>
        <p className="agent-teams-empty-hint">
          你可以让 Claude 创建一个团队，Lead 会自动委派 Teammate 并行处理子任务。
        </p>
        <div className="agent-teams-actions">
          <button className="at-btn at-btn--primary" onClick={handleCreateTeam}>
            <Plus size={13} />
            让 Claude 创建团队…
          </button>
        </div>
        {/* 开发用：模拟一个示例团队 */}
        <button
          className="at-btn at-btn--ghost"
          style={{ marginTop: 16 }}
          onClick={() => setTeam({
            teamName: 'auth-refactor',
            leadStatus: '正在等待 Teammate 汇报',
            teammates: [
              { id: 'security-reviewer', displayName: 'security-reviewer', status: 'active', currentTask: '审查 src/auth/' },
              { id: 'test-writer', displayName: 'test-writer', status: 'idle', lastMessage: '8 个测试用例已完成' },
            ],
            tasks: [
              { id: 't1', description: '审查认证模块安全性', assignedTo: 'security-reviewer', status: 'in_progress' },
              { id: 't2', description: '编写测试用例', assignedTo: 'test-writer', status: 'done' },
              { id: 't3', description: '生成最终报告', status: 'pending' },
            ],
          })}
        >
          [开发模式] 加载示例团队
        </button>
      </div>
    );
  }

  // ── 活跃团队看板 ──

  return (
    <div className="agent-teams-board">
      {/* 团队标题 */}
      <div className="agent-teams-board-header">
        <Users size={14} />
        <span className="at-team-name">当前团队：{team.teamName ?? '未命名'}</span>
        <button className="at-btn at-btn--ghost at-btn--sm" onClick={() => setTeam(null)}>清理团队</button>
      </div>

      {/* Lead 状态 */}
      <div className="agent-teams-section">
        <div className="at-section-label">
          <Crown size={12} />
          Lead（主会话）
        </div>
        <div className="at-lead-card">
          <span className="at-lead-status">{team.leadStatus}</span>
        </div>
      </div>

      {/* Teammates */}
      <div className="agent-teams-section">
        <div className="at-section-label">
          <Users size={12} />
          Teammates（{team.teammates.length} 个）
        </div>
        <div className="at-teammates-list">
          {team.teammates.map((tm) => (
            <div key={tm.id} className={`at-teammate-card at-teammate--${tm.status}`}>
              <div className="at-teammate-header">
                <span className="at-teammate-icon">{STATUS_ICON[tm.status]}</span>
                <span className="at-teammate-name">{tm.displayName}</span>
                {tm.currentTask && (
                  <span className="at-teammate-task">— {tm.currentTask}</span>
                )}
                <span className={`at-teammate-badge at-badge--${tm.status}`}>
                  {STATUS_LABEL[tm.status]}
                </span>
                <button
                  className="at-teammate-close"
                  onClick={() => handleCloseTeammate(tm.id)}
                  title={`关闭 ${tm.displayName}`}
                >
                  <X size={11} />
                </button>
              </div>
              {tm.lastMessage && (
                <div className="at-teammate-last-msg">{tm.lastMessage}</div>
              )}
              {/* 发消息给 Teammate 内联输入框 */}
              <div className="at-teammate-msg-row">
                <input
                  className="at-teammate-input"
                  placeholder={`发消息给 ${tm.displayName}…`}
                  value={inlineMsg[tm.id] ?? ''}
                  onChange={(e) => setInlineMsg((prev) => ({ ...prev, [tm.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendToTeammate(tm.id); }}
                />
                <button
                  className="at-btn at-btn--sm"
                  disabled={!inlineMsg[tm.id]?.trim()}
                  onClick={() => handleSendToTeammate(tm.id)}
                >
                  <MessageSquare size={11} />
                </button>
              </div>
            </div>
          ))}
          <button className="at-btn at-btn--ghost at-btn--sm at-add-teammate" disabled>
            <Plus size={12} /> 添加 Teammate（通过 Lead 指令）
          </button>
        </div>
      </div>

      {/* 共享任务列表 */}
      <div className="agent-teams-section">
        <div className="at-section-label">📋 共享任务列表</div>
        <div className="at-tasks-list">
          {team.tasks.map((task) => (
            <div key={task.id} className={`at-task-row at-task--${task.status}`}>
              <span className="at-task-check">
                {task.status === 'done' ? '☑' : '○'}
              </span>
              <span className="at-task-desc">{task.description}</span>
              {task.assignedTo && (
                <span className="at-task-assignee">[{task.assignedTo}]</span>
              )}
              <span className={`at-task-status at-task-status--${task.status}`}>
                {TASK_STATUS_LABEL[task.status]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
