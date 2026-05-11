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
  Clock,
  Brain,
  DollarSign,
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
import { SessionList } from '../SessionList';
import { MemSearchPanel } from '../MemSearchPanel';
import { CostPanel } from '../CostPanel';
import { HistoryPanel } from '../HistoryPanel';

type NavSection = 'chat' | 'project' | 'tools' | 'config' | 'history';

const AUX_TABS: Record<
  Exclude<NavSection, 'chat'>,
  { id: string; label: string; icon: React.ElementType }[]
> = {
  project: [
    { id: 'files', label: '文件', icon: FolderOpen },
    { id: 'git', label: 'Git', icon: GitBranch },
    { id: 'changes', label: '变更', icon: GitCommit },
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
  ],
  history: [
    { id: 'sessions', label: '历史', icon: Clock },
    { id: 'mem', label: '记忆', icon: Brain },
    { id: 'cost', label: '成本', icon: DollarSign },
  ],
};

interface AuxPanelProps {
  width: number;
  onResizeMouseDown: (e: React.MouseEvent) => void;
  onStartSession: () => void;
  onStopSession: () => void;
}

export function AuxPanel({
  width,
  onResizeMouseDown,
  onStartSession,
  onStopSession,
}: AuxPanelProps) {
  const activeNavSection = useAppStore((s) => s.activeNavSection) as NavSection;
  const activeAuxSubPanel = useAppStore((s) => s.activeAuxSubPanel);
  const setActiveAuxSubPanel = useAppStore((s) => s.setActiveAuxSubPanel);
  const session = useAppStore((s) => s.session);
  const setSession = useAppStore((s) => s.setSession);

  if (activeNavSection === 'chat') return null;

  const tabs = AUX_TABS[activeNavSection as Exclude<NavSection, 'chat'>] ?? [];

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
          {/* history section */}
          {activeNavSection === 'history' && activeAuxSubPanel === 'sessions' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div
                style={{
                  padding: 12,
                  flexShrink: 0,
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div style={{ marginBottom: 10 }}>
                  <label
                    style={{
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      marginBottom: 4,
                      display: 'block',
                    }}
                  >
                    工作目录
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={session.workingDirectory}
                    onChange={(e) => setSession({ workingDirectory: e.target.value })}
                    placeholder="选择工作目录..."
                    style={{ fontSize: 12 }}
                  />
                </div>
                {session.isConnected ? (
                  <button
                    className="btn btn-danger"
                    style={{ width: '100%' }}
                    onClick={onStopSession}
                  >
                    断开连接
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={onStartSession}
                  >
                    启动 Claude Code
                  </button>
                )}
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                <SessionList />
              </div>
            </div>
          )}
          {activeNavSection === 'history' && activeAuxSubPanel === 'mem' && <MemSearchPanel />}
          {activeNavSection === 'history' && activeAuxSubPanel === 'cost' && <CostPanel />}
          {activeNavSection === 'history' && activeAuxSubPanel === 'history-list' && <HistoryPanel />}
        </div>
      </div>
    </>
  );
}
