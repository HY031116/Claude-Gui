/**
 * AgentsView — Agents 舰队视图
 * 展示：Worktree 并行会话 + Subagent 定义管理 + Agent Teams（实验性）
 */
import { useState } from 'react';
import { Bot, Layers, GitBranch, Users } from 'lucide-react';
import { WorktreePanel } from '../WorktreePanel';
import { AgentPanel } from '../AgentPanel';
import { AgentTeamsPanel } from '../AgentTeamsPanel';

type AgentTab = 'worktrees' | 'agents' | 'teams';

export function AgentsView() {
  const [activeTab, setActiveTab] = useState<AgentTab>('worktrees');

  const tabs: { id: AgentTab; label: string; icon: React.ElementType }[] = [
    { id: 'worktrees', label: 'Worktrees（并行会话）', icon: Layers },
    { id: 'agents', label: 'Agent 定义', icon: Bot },
    { id: 'teams', label: '🧪 Agent Teams', icon: Users },
  ];

  return (
    <div className="full-view">
      {/* 视图内 Tab 切换 */}
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
        {activeTab === 'worktrees' && (
          <div style={{ padding: '0 16px' }}>
            <div className="view-section-header">
              <GitBranch size={16} />
              <span>并行 Worktree 会话</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                多个独立分支并行工作，互不干扰
              </span>
            </div>
            <WorktreePanel />
          </div>
        )}

        {activeTab === 'agents' && (
          <div style={{ padding: '0 16px' }}>
            <div className="view-section-header">
              <Bot size={16} />
              <span>Subagent 定义</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                自定义 Agent 角色、预加载 Skills、模型配置
              </span>
            </div>
            <AgentPanel />
          </div>
        )}

        {activeTab === 'teams' && (
          <div style={{ padding: '0 16px' }}>
            <div className="view-section-header">
              <Users size={16} />
              <span>Agent Teams</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                实验性 · Lead + Teammates 协作架构
              </span>
            </div>
            <AgentTeamsPanel />
          </div>
        )}
      </div>
    </div>
  );
}
