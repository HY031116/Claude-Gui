/**
 * CapabilitiesView — 能力配置视图
 * 聚合：MCP + Hooks + Skills + Plugins + Rules + Memory（CLAUDE.md）
 */
import { useState } from 'react';
import { Plug, Zap, Sparkles, Package, Shield, FileText, Search } from 'lucide-react';
import { McpPanel } from '../McpPanel';
import { HooksPanel } from '../HooksPanel';
import { SkillsPanel } from '../SkillsPanel';
import PluginPanel from '../PluginPanel';
import { RulesPanel } from '../RulesPanel';
import { MemoryEditPanel } from '../MemoryEditPanel';
import { MemSearchPanel } from '../MemSearchPanel';

type CapabilitiesTab = 'mcp' | 'hooks' | 'skills' | 'plugins' | 'rules' | 'claude-md' | 'mem-search';

const TABS: { id: CapabilitiesTab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'mcp', label: 'MCP 服务', icon: Plug, desc: '连接外部工具和数据源' },
  { id: 'hooks', label: 'Hooks', icon: Zap, desc: '生命周期自动化钩子' },
  { id: 'skills', label: 'Skills', icon: Sparkles, desc: '可复用指令和工作流' },
  { id: 'plugins', label: 'Plugins', icon: Package, desc: '插件市场和本地插件' },
  { id: 'rules', label: '权限规则', icon: Shield, desc: '路径级别的精细权限' },
  { id: 'claude-md', label: 'CLAUDE.md', icon: FileText, desc: '持久上下文和项目规范' },
  { id: 'mem-search', label: '记忆搜索', icon: Search, desc: '搜索 Claude 的记忆文件' },
];

export function CapabilitiesView() {
  const [activeTab, setActiveTab] = useState<CapabilitiesTab>('mcp');

  const currentTab = TABS.find((t) => t.id === activeTab);

  return (
    <div className="full-view capabilities-view">
      {/* 左侧菜单 + 右侧内容（二栏布局） */}
      <div className="capabilities-layout">
        {/* 左侧垂直菜单 */}
        <div className="capabilities-menu">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`capabilities-menu-item${active ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={15} />
                <div className="capabilities-menu-text">
                  <span className="capabilities-menu-label">{tab.label}</span>
                  <span className="capabilities-menu-desc">{tab.desc}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* 右侧内容区 */}
        <div className="capabilities-content">
          {currentTab && (
            <div className="view-section-header" style={{ marginBottom: 16 }}>
              <currentTab.icon size={16} />
              <span>{currentTab.label}</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{currentTab.desc}</span>
            </div>
          )}

          {activeTab === 'mcp' && <McpPanel />}
          {activeTab === 'hooks' && <HooksPanel />}
          {activeTab === 'skills' && <SkillsPanel />}
          {activeTab === 'plugins' && <PluginPanel />}
          {activeTab === 'rules' && <RulesPanel />}
          {activeTab === 'claude-md' && <MemoryEditPanel />}
          {activeTab === 'mem-search' && <MemSearchPanel />}
        </div>
      </div>
    </div>
  );
}
