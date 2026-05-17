/**
 * CapabilitiesView — 能力配置视图
 * 聚合：MCP + Hooks + Skills + Plugins + Rules + Memory（CLAUDE.md）
 * 顶部汇总徽章 + 左侧菜单实时计数
 */
import { useState, useEffect, useCallback } from 'react';
import { Plug, Zap, Sparkles, Package, Shield, FileText, Search, RefreshCw } from 'lucide-react';
import { McpPanel } from '../McpPanel';
import { HooksPanel } from '../HooksPanel';
import { SkillsPanel } from '../SkillsPanel';
import PluginPanel from '../PluginPanel';
import { RulesPanel } from '../RulesPanel';
import { MemoryEditPanel } from '../MemoryEditPanel';
import { MemSearchPanel } from '../MemSearchPanel';

type CapabilitiesTab = 'mcp' | 'hooks' | 'skills' | 'plugins' | 'rules' | 'claude-md' | 'mem-search';

/** 从 CLI 配置计算各项数量 */
interface ConfigCounts {
  mcp: number;       // MCP 服务器数量
  hooks: number;     // 已配置的 Hook 事件数量
  rules: number;     // allow + deny + ask 规则总数
}

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
  const [counts, setCounts] = useState<ConfigCounts>({ mcp: 0, hooks: 0, rules: 0 });
  const [countsLoading, setCountsLoading] = useState(true);

  /** 从 CLI config 读取各项数量（只读，不影响子面板独立加载） */
  const refreshCounts = useCallback(async () => {
    setCountsLoading(true);
    try {
      const res = await window.electronAPI.loadCliConfig();
      if (res?.success && res.settings) {
        const s = res.settings as Record<string, unknown>;
        const mcpCount = s.mcpServers ? Object.keys(s.mcpServers as Record<string, unknown>).length : 0;
        const hooksObj = s.hooks as Record<string, unknown[]> | undefined;
        const hooksCount = hooksObj ? Object.keys(hooksObj).length : 0;
        const perms = s.permissions as Record<string, string[]> | undefined;
        const rulesCount = (perms?.allow?.length ?? 0) + (perms?.deny?.length ?? 0) + (perms?.ask?.length ?? 0);
        setCounts({ mcp: mcpCount, hooks: hooksCount, rules: rulesCount });
      }
    } catch {
      // 静默失败，counts 保持上次值
    } finally {
      setCountsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  /** 切换 tab 时刷新计数（子面板可能已修改配置） */
  const handleTabChange = useCallback((id: CapabilitiesTab) => {
    if (activeTab !== id) {
      // 延迟 300ms 等子面板保存完成再刷新
      setTimeout(() => void refreshCounts(), 300);
    }
    setActiveTab(id);
  }, [activeTab, refreshCounts]);

  const currentTab = TABS.find((t) => t.id === activeTab);

  /** 根据 tab id 返回数量（0 不显示） */
  const getCount = (id: CapabilitiesTab): number => {
    if (id === 'mcp') return counts.mcp;
    if (id === 'hooks') return counts.hooks;
    if (id === 'rules') return counts.rules;
    return 0;
  };

  return (
    <div className="full-view capabilities-view">
      {/* 顶部汇总配置状态行 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '8px 16px',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
        fontSize: 12,
        color: 'var(--text-secondary)',
      }}>
        <Plug size={12} style={{ color: 'var(--accent, #6366f1)' }} />
        <span><strong style={{ color: 'var(--text-primary)' }}>{counts.mcp}</strong> 个 MCP 服务</span>
        <span style={{ color: 'var(--border-color)' }}>·</span>
        <Zap size={12} />
        <span><strong style={{ color: 'var(--text-primary)' }}>{counts.hooks}</strong> 个 Hook 事件</span>
        <span style={{ color: 'var(--border-color)' }}>·</span>
        <Shield size={12} />
        <span><strong style={{ color: 'var(--text-primary)' }}>{counts.rules}</strong> 条权限规则</span>
        <button
          onClick={() => void refreshCounts()}
          className="tip-btn"
          data-tooltip="刷新配置统计"
          title="刷新配置统计"
          style={
            marginLeft: 'auto', background: 'none', border: 'none',
            cursor: 'pointer', padding: 2, color: 'var(--text-tertiary)',
            display: 'flex', alignItems: 'center',
          }}
        >
          <RefreshCw size={12} style={{ animation: countsLoading ? 'tab-spin 0.7s linear infinite' : undefined }} />
        </button>
      </div>

      {/* 左侧菜单 + 右侧内容（二栏布局） */}
      <div className="capabilities-layout">
        {/* 左侧垂直菜单 */}
        <div className="capabilities-menu">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const count = getCount(tab.id);
            return (
              <button
                key={tab.id}
                className={`capabilities-menu-item${active ? ' active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <Icon size={15} />
                <div className="capabilities-menu-text">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="capabilities-menu-label">{tab.label}</span>
                    {count > 0 && (
                      <span style={{
                        fontSize: 10, background: 'var(--accent, #6366f1)', color: '#fff',
                        borderRadius: 8, padding: '1px 5px', lineHeight: 1.4,
                      }}>
                        {count}
                      </span>
                    )}
                  </div>
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
