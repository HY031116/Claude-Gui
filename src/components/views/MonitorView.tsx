/**
 * MonitorView — 监控视图
 * 展示：上下文用量 + Token/成本统计 + 历史会话
 */
import { useState } from 'react';
import { Info, DollarSign, Clock } from 'lucide-react';
import { ContextPanel } from '../ContextPanel';
import { CostPanel } from '../CostPanel';
import { HistoryPanel } from '../HistoryPanel';

type MonitorTab = 'context' | 'cost' | 'sessions';

export function MonitorView() {
  const [activeTab, setActiveTab] = useState<MonitorTab>('context');

  const tabs: { id: MonitorTab; label: string; icon: React.ElementType }[] = [
    { id: 'context', label: '上下文', icon: Info },
    { id: 'cost', label: '成本统计', icon: DollarSign },
    { id: 'sessions', label: '历史会话', icon: Clock },
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
        {activeTab === 'context' && <ContextPanel />}
        {activeTab === 'cost' && <CostPanel />}
        {activeTab === 'sessions' && <HistoryPanel />}
      </div>
    </div>
  );
}
