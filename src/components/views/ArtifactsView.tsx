/**
 * ArtifactsView — 产物视图
 * 展示：Git 操作 + 文件浏览 + 历史会话 + 成本统计
 */
import { useState } from 'react';
import { GitBranch, FolderOpen, Clock, DollarSign } from 'lucide-react';
import { GitPanel } from '../GitPanel';
import { FileExplorer } from '../FileExplorer';
import { HistoryPanel } from '../HistoryPanel';
import { CostPanel } from '../CostPanel';

type ArtifactsTab = 'git' | 'files' | 'history' | 'cost';

export function ArtifactsView() {
  const [activeTab, setActiveTab] = useState<ArtifactsTab>('git');

  const tabs: { id: ArtifactsTab; label: string; icon: React.ElementType }[] = [
    { id: 'git', label: 'Git', icon: GitBranch },
    { id: 'files', label: '文件', icon: FolderOpen },
    { id: 'history', label: '历史会话', icon: Clock },
    { id: 'cost', label: '成本', icon: DollarSign },
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
        {activeTab === 'git' && <GitPanel />}
        {activeTab === 'files' && <FileExplorer />}
        {activeTab === 'history' && <HistoryPanel />}
        {activeTab === 'cost' && <CostPanel />}
      </div>
    </div>
  );
}
