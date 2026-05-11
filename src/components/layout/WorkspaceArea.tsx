/**
 * WorkspaceArea — 主工作区（topbar + 标签条 + ChatPanel + TerminalPanel + 历史侧边栏）
 * 直接从 Zustand store 读取所需字段，减少 props 层数
 */
import { useState, useCallback } from 'react';
import { Cpu, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { ChatPanel } from '../ChatPanel';
import { TerminalPanel } from '../TerminalPanel';
import { SessionList } from '../SessionList';

interface WorkspaceAreaProps {
  onStartSession: () => void;
}

export function WorkspaceArea({ onStartSession }: WorkspaceAreaProps) {
  const session = useAppStore((s) => s.session);
  const setSession = useAppStore((s) => s.setSession);
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const addTab = useAppStore((s) => s.addTab);
  const closeTab = useAppStore((s) => s.closeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const renameTab = useAppStore((s) => s.renameTab);
  const currentModel = useAppStore((s) => s.currentModel);

  // 标签内联重命名本地状态（仅 WorkspaceArea 使用）
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  // 右侧历史侧边栏折叠状态
  const [showHistory, setShowHistory] = useState(false);

  // 断开连接（停止 Claude 会话）
  const handleDisconnect = useCallback(async () => {
    await window.electronAPI.cliStop();
    setSession({ isConnected: false, pid: undefined });
  }, [setSession]);

  // 提取目录最后一段作为工作区名称显示
  const workspaceLabel = session.workingDirectory
    ? session.workingDirectory
        .replace(/\\/g, '/')
        .replace(/\/$/, '')
        .split('/')
        .pop() || session.workingDirectory
    : '未选择项目';

  // 模型名称缩短显示（claude-3-5-sonnet-20241022 → claude-3.5-sonnet）
  const modelShort = currentModel
    ? currentModel.replace(/-\d{8}$/, '').replace('claude-', 'claude ')
    : '';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="workspace-shell">
        <div className="workspace-main-column">
          {/* 顶栏：项目名 + 状态标签 + 历史切换按钮 */}
          <div className="workspace-topbar">
            <div className="workspace-topbar-title-row">
              <strong className="workspace-topbar-project">{workspaceLabel}</strong>
              {session.isConnected && (
                <span className="workspace-topbar-pill connected">已连接</span>
              )}
              {modelShort && session.isConnected && (
                <span className="workspace-topbar-pill model-chip" title={currentModel}>
                  <Cpu size={10} />
                  {modelShort}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {session.isConnected ? (
                <button
                  className="history-toggle-btn"
                  onClick={handleDisconnect}
                  title="断开连接"
                  aria-label="断开连接"
                  style={{ fontSize: 11, width: 'auto', padding: '0 8px', color: 'var(--danger)' }}
                >
                  断开
                </button>
              ) : (
                <button
                  className="history-toggle-btn"
                  onClick={onStartSession}
                  title="启动 Claude Code 会话"
                  aria-label="启动会话"
                  style={{ fontSize: 11, width: 'auto', padding: '0 8px', color: 'var(--success)' }}
                >
                  启动
                </button>
              )}
              <button
                className="history-toggle-btn"
                onClick={() => setShowHistory((v) => !v)}
                title={showHistory ? '关闭历史面板' : '打开历史面板'}
                aria-label={showHistory ? '关闭历史面板' : '打开历史面板'}
              >
                {showHistory ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
              </button>
            </div>
          </div>

          {/* 多会话标签条 */}
          <div className="session-tab-bar">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setRenamingTabId(tab.id);
                  setRenameValue(tab.label);
                }}
                className={`session-tab${tab.id === activeTabId ? ' active' : ''}`}
              >
                {renamingTabId === tab.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => {
                      const trimmed = renameValue.trim();
                      if (trimmed) renameTab(tab.id, trimmed);
                      setRenamingTabId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const trimmed = renameValue.trim();
                        if (trimmed) renameTab(tab.id, trimmed);
                        setRenamingTabId(null);
                      } else if (e.key === 'Escape') {
                        setRenamingTabId(null);
                      }
                      e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="session-tab-rename-input"
                    style={{ width: Math.max(60, renameValue.length * 8) }}
                  />
                ) : (
                  <span className="session-tab-label" title="双击重命名">
                    {tab.label}
                  </span>
                )}
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                    className="session-tab-close"
                    title="关闭标签"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => addTab()}
              className="session-tab-new"
              title="新建会话标签 (Ctrl+T)"
            >
              +
            </button>
          </div>

          <ChatPanel key={activeTabId} />
          <TerminalPanel />
        </div>

        {/* 右侧可折叠历史侧边栏 */}
        <div className={`chat-history-sidebar${showHistory ? ' open' : ''}`}>
          <div className="chat-history-sidebar-inner">
            <SessionList />
          </div>
        </div>
      </div>
    </div>
  );
}
