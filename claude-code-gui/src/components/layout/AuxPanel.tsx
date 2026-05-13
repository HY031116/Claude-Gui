/**
 * AuxPanel — 右侧辅助面板（子标签栏 + 内容区）
 * 直接从 store 读取 activeNavSection / activeAuxSubPanel；
 * onStartSession / onStopSession 需要 IPC，由 App.tsx 传入。
 */
import {
  FolderOpen,
  GitBranch,
  GitCommit,
  Layers,
  Camera,
  Plug,
  Bot,
  Package,
  Zap,
  Sparkles,
  CheckSquare,
  Settings,
  Shield,
  FileText,
  Brain,
  DollarSign,
  Info,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { FileExplorer } from '../FileExplorer';
import { GitPanel } from '../GitPanel';
import { ChangeSummaryPanel } from '../ChangeSummaryPanel';
import { WorktreePanel } from '../WorktreePanel';
import { CheckpointPanel } from '../CheckpointPanel';
import { McpPanel } from '../McpPanel';
import { AgentPanel } from '../AgentPanel';
import PluginPanel from '../PluginPanel';
import { HooksPanel } from '../HooksPanel';
import { SkillsPanel } from '../SkillsPanel';
import { TaskPanel } from '../TaskPanel';
import { SettingsPanel } from '../SettingsPanel';
import { RulesPanel } from '../RulesPanel';
import { MemoryEditPanel } from '../MemoryEditPanel';
import { MemSearchPanel } from '../MemSearchPanel';
import { CostPanel } from '../CostPanel';
import { ContextPanel } from '../ContextPanel';

type NavSection = 'chat' | 'project' | 'tools' | 'config';

const AUX_TABS: Record<
  Exclude<NavSection, 'chat'>,
  { id: string; label: string; icon: React.ElementType }[]
> = {
  project: [
    { id: 'files', label: '文件', icon: FolderOpen },
    { id: 'git', label: 'Git', icon: GitBranch },
    { id: 'changes', label: '变更', icon: GitCommit },
    { id: 'context', label: '上下文', icon: Info },
    { id: 'worktrees', label: 'Worktree', icon: Layers },
    { id: 'checkpoints', label: '快照', icon: Camera },
  ],
  tools: [
    { id: 'mcp', label: 'MCP', icon: Plug },
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'plugins', label: 'Plugins', icon: Package },
    { id: 'hooks', label: 'Hooks', icon: Zap },
    { id: 'skills', label: 'Skills', icon: Sparkles },
    { id: 'tasks', label: '任务', icon: CheckSquare },
  ],
  config: [
    { id: 'settings', label: '设置', icon: Settings },
    { id: 'rules', label: '权限规则', icon: Shield },
    { id: 'claude-md', label: 'CLAUDE.md', icon: FileText },
    { id: 'mem', label: '记忆', icon: Brain },
    { id: 'cost', label: '成本', icon: DollarSign },
  ],
};

interface AuxPanelProps {
  width: number;
  onResizeMouseDown: (e: React.MouseEvent) => void;
}

export function AuxPanel({
  width,
  onResizeMouseDown,
}: AuxPanelProps) {
  const activeNavSection = useAppStore((s) => s.activeNavSection) as NavSection;
  const activeAuxSubPanel = useAppStore((s) => s.activeAuxSubPanel);
  const setActiveAuxSubPanel = useAppStore((s) => s.setActiveAuxSubPanel);

  if (activeNavSection === 'chat') return null;

  const tabs = AUX_TABS[activeNavSection as Exclude<NavSection, 'chat'>] ?? [];

  // 防御：section 不在 AUX_TABS 里（旧存储值或 HMR 状态残留）→ 不渲染
  if (tabs.length === 0) return null;

  return (
    <>
      <div className="resize-handle" onMouseDown={onResizeMouseDown} />
      <div
        style={{
          width,
          borderLeft: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flexShrink: 0,
          background: 'var(--bg-primary)',
        }}
      >
        {/* 子标签栏 */}
        <div className="aux-tab-bar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeAuxSubPanel === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveAuxSubPanel(tab.id)}
                className={`aux-tab-btn${isActive ? ' active' : ''}`}
                title={tab.label}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* project section */}
          {activeNavSection === 'project' && activeAuxSubPanel === 'files' && <FileExplorer />}
          {activeNavSection === 'project' && activeAuxSubPanel === 'git' && <GitPanel />}
          {activeNavSection === 'project' && activeAuxSubPanel === 'changes' && <ChangeSummaryPanel />}
          {activeNavSection === 'project' && activeAuxSubPanel === 'context' && <ContextPanel />}
          {activeNavSection === 'project' && activeAuxSubPanel === 'worktrees' && <WorktreePanel />}
          {activeNavSection === 'project' && activeAuxSubPanel === 'checkpoints' && <CheckpointPanel />}
          {/* tools section */}
          {activeNavSection === 'tools' && activeAuxSubPanel === 'mcp' && <McpPanel />}
          {activeNavSection === 'tools' && activeAuxSubPanel === 'agents' && <AgentPanel />}
          {activeNavSection === 'tools' && activeAuxSubPanel === 'plugins' && <PluginPanel />}
          {activeNavSection === 'tools' && activeAuxSubPanel === 'hooks' && <HooksPanel />}
          {activeNavSection === 'tools' && activeAuxSubPanel === 'skills' && <SkillsPanel />}
          {activeNavSection === 'tools' && activeAuxSubPanel === 'tasks' && <TaskPanel />}
          {/* config section */}
          {activeNavSection === 'config' && activeAuxSubPanel === 'settings' && <SettingsPanel />}
          {activeNavSection === 'config' && activeAuxSubPanel === 'rules' && <RulesPanel />}
          {activeNavSection === 'config' && activeAuxSubPanel === 'claude-md' && <MemoryEditPanel />}
          {activeNavSection === 'config' && activeAuxSubPanel === 'mem' && <MemSearchPanel />}
          {activeNavSection === 'config' && activeAuxSubPanel === 'cost' && <CostPanel />}
        </div>
      </div>
    </>
  );
}
