/**
 * WorkspaceArea — 主工作区（topbar + 标签条 + ChatPanel + TerminalPanel）
 * 直接从 Zustand store 读取所需字段，减少 props 层数
 */
import { useState } from 'react';
import { Cpu } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { ChatPanel } from '../ChatPanel';
import { TerminalPanel } from '../TerminalPanel';

export function WorkspaceArea() {
  const session = useAppStore((s) => s.session);
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
          {/* 顶栏：项目名 + 状态标签 */}
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
      </div>
    </div>
  );
}
