/**
 * ReviewView — 审查视图
 * 展示：Diff 变更审查 + Plan Mode 步骤审查 + Checkpoint 快照
 */
import { useState } from 'react';
import { GitCommit, Camera, FileText } from 'lucide-react';
import { ChangeSummaryPanel } from '../ChangeSummaryPanel';
import { CheckpointPanel } from '../CheckpointPanel';
import { TaskTimeline } from '../task/TaskTimeline';

type ReviewTab = 'changes' | 'plan' | 'checkpoints';

export function ReviewView() {
  const [activeTab, setActiveTab] = useState<ReviewTab>('changes');

  const tabs: { id: ReviewTab; label: string; icon: React.ElementType }[] = [
    { id: 'changes', label: 'Diff 变更', icon: GitCommit },
    { id: 'plan', label: '计划审查', icon: FileText },
    { id: 'checkpoints', label: '检查点', icon: Camera },
  ];

  return (
    <div className="full-view">
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
            <TaskTimeline />
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
