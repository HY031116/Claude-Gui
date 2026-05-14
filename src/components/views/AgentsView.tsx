/**
 * AgentsView — Agents 舰队视图
 * 展示：Worktree 并行会话 + Subagent 定义管理
 */
import { useState } from 'react';
import { Bot, Layers, GitBranch } from 'lucide-react';
import { WorktreePanel } from '../WorktreePanel';
import { AgentPanel } from '../AgentPanel';

type AgentTab = 'worktrees' | 'agents';

export function AgentsView() {
  const [activeTab, setActiveTab] = useState<AgentTab>('worktrees');

  const tabs: { id: AgentTab; label: string; icon: React.ElementType }[] = [
    { id: 'worktrees', label: 'Worktrees（并行会话）', icon: Layers },
    { id: 'agents', label: 'Agent 定义', icon: Bot },
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
      </div>
    </div>
  );
}
