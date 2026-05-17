/**
 * ReviewView — 审查视图
 * 展示：Diff 变更审查 + Plan Mode 步骤审查 + Checkpoint 快照
 */
import { useState } from 'react';
import { GitCommit, Camera, FileText, ClipboardList } from 'lucide-react';
import { ChangeSummaryPanel } from '../ChangeSummaryPanel';
import { CheckpointPanel } from '../CheckpointPanel';
import { TaskTimeline } from '../task/TaskTimeline';
import { useAppStore } from '../../stores/useAppStore';

type ReviewTab = 'changes' | 'plan' | 'checkpoints';

export function ReviewView() {
  const [activeTab, setActiveTab] = useState<ReviewTab>('changes');
  const messages = useAppStore((s) => s.messages);
  const hasToolCalls = messages.some(
    (m) => m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0
  );

  const tabs: { id: ReviewTab; label: string; icon: React.ElementType }[] = [
    { id: 'changes', label: 'Diff 变更', icon: GitCommit },
    { id: 'plan', label: '计划审查', icon: FileText },
    { id: 'checkpoints', label: '检查点', icon: Camera },
  ];

  return (
    <div className="full-view">
      {/* 页面标题行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>审查</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>· 代码变更 / 执行计划 / 检查点快照</span>
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
        {activeTab === 'changes' && (
          <div style={{ padding: '0 16px' }}>
            <div className="view-section-header">
              <GitCommit size={16} />
              <span>代码变更审查</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                逐文件审查 Claude 的所有代码修改
              </span>
            </div>
            <ChangeSummaryPanel />
          </div>
        )}

        {activeTab === 'plan' && (
          <div style={{ padding: '0 16px' }}>
            <div className="view-section-header">
              <FileText size={16} />
              <span>计划步骤审查（Plan Mode）</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                在 Plan Mode 下审查并确认执行步骤
              </span>
            </div>
            {hasToolCalls ? (
              <TaskTimeline />
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <ClipboardList size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                <div>本次会话暂无执行计划</div>
                <div style={{ fontSize: 11, marginTop: 4, marginBottom: 12 }}>
                  启动 Plan Mode 会话后，步骤时序将在此展示
                </div>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 12, padding: '5px 14px' }}
                  onClick={() => useAppStore.getState().setActiveNavSection('dispatch')}
                >
                  前往委派，启动会话
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'checkpoints' && (
          <div style={{ padding: '0 16px' }}>
            <div className="view-section-header">
              <Camera size={16} />
              <span>文件快照回滚</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                回滚到任意历史状态，撤销 Claude 的修改
              </span>
            </div>
            <CheckpointPanel />
          </div>
        )}
      </div>
    </div>
  );
}
