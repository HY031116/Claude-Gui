/**
 * AuxPanel — 右侧辅助面板（子标签栏 + 内容区）
 * 直接从 store 读取 activeNavSection / activeAuxSubPanel；
 * onStartSession / onStopSession 需要 IPC，由 App.tsx 传入。
 */
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

const AUX_TABS: Record<Exclude<NavSection, 'chat'>, { id: string; label: string }[]> = {
  project: [
    { id: 'files', label: '文件' },
    { id: 'git', label: 'Git' },
    { id: 'changes', label: '变更' },
    { id: 'worktrees', label: 'Worktree' },
    { id: 'checkpoints', label: '快照' },
  ],
  tools: [
    { id: 'mcp', label: 'MCP' },
    { id: 'agents', label: 'Agents' },
    { id: 'plugins', label: 'Plugins' },
    { id: 'hooks', label: 'Hooks' },
    { id: 'skills', label: 'Skills' },
    { id: 'tasks', label: '任务' },
  ],
  config: [
    { id: 'settings', label: '设置' },
    { id: 'rules', label: '权限规则' },
    { id: 'claude-md', label: 'CLAUDE.md' },
  ],
  history: [
    { id: 'sessions', label: '历史' },
    { id: 'mem', label: '记忆搜索' },
    { id: 'cost', label: '成本' },
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
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
            overflowX: 'auto',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveAuxSubPanel(tab.id)}
              style={{
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: activeAuxSubPanel === tab.id ? 600 : 400,
                color:
                  activeAuxSubPanel === tab.id
                    ? 'var(--accent-color)'
                    : 'var(--text-secondary)',
                borderBottom:
                  activeAuxSubPanel === tab.id
                    ? '2px solid var(--accent-color)'
                    : '2px solid transparent',
                background: 'transparent',
                border: 'none',
                borderTopWidth: 0,
                borderLeftWidth: 0,
                borderRightWidth: 0,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'color var(--duration-normal), border-color var(--duration-normal)',
              }}
            >
              {tab.label}
            </button>
          ))}
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
