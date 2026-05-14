/**
 * WorkspaceArea — 主工作区（Agent 中心路由 v3.0）
 * 根据 activeNavSection 路由到对应视图：
 *   command       → CommandCenter（指挥中心）
 *   dispatch      → 原有 Chat + Terminal 界面
 *   agents        → AgentsView
 *   review        → ReviewView
 *   artifacts     → ArtifactsView
 *   capabilities  → CapabilitiesView
 *   monitor       → MonitorView
 *   settings      → SettingsPanel
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Cpu, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { TerminalPanel } from '../TerminalPanel';
import { SessionList } from '../SessionList';
import { TaskView } from '../task/TaskView';
import { SettingsPanel } from '../SettingsPanel';
import { CommandCenter } from '../views/CommandCenter';
import { AgentsView } from '../views/AgentsView';
import { ReviewView } from '../views/ReviewView';
import { ArtifactsView } from '../views/ArtifactsView';
import { CapabilitiesView } from '../views/CapabilitiesView';
import { MonitorView } from '../views/MonitorView';
import type { NavSection, NavClick } from '../../utils/nav';

interface WorkspaceAreaProps {
  onStartSession: () => void;
  onNavClick: (id: NavClick) => void;
}

export function WorkspaceArea({ onStartSession, onNavClick }: WorkspaceAreaProps) {
  const activeNavSection = useAppStore((s) => s.activeNavSection) as NavSection;
  const session = useAppStore((s) => s.session);
  const setSession = useAppStore((s) => s.setSession);
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const addTab = useAppStore((s) => s.addTab);
  const closeTab = useAppStore((s) => s.closeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const renameTab = useAppStore((s) => s.renameTab);
  const reorderTab = useAppStore((s) => s.reorderTab);
  const currentModel = useAppStore((s) => s.currentModel);
  const processingTabs = useAppStore((s) => s.processingTabs);

  // 标签内联重命名本地状态（仅 WorkspaceArea 使用）
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // 拖拽排序状态
  const dragFromIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [contextMenu]);
  // 右侧历史侧边栏折叠状态
  const [showHistory, setShowHistory] = useState(false);

  // 全局快捷键：Ctrl+T 新建标签、Ctrl+W 关闭当前标签
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 't') {
        e.preventDefault();
        addTab();
      } else if (e.key === 'w' && activeTabId && tabs.length > 1) {
        e.preventDefault();
        closeTab(activeTabId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [addTab, closeTab, activeTabId, tabs.length]);

  // 全局进度条：当前活跃 tab 是否处理中
  const isProcessing = !!(activeTabId && processingTabs[activeTabId]);
  const [progress, setProgress] = useState(0);
  const [progressVisible, setProgressVisible] = useState(false);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isProcessing) {
      setProgress(0);
      setProgressVisible(true);
      // 短暂延迟后快速推进到 30%，让动画可见
      const t = setTimeout(() => setProgress(30), 40);
      progressTimer.current = setInterval(() => {
        setProgress((p) => (p < 88 ? p + 2 : p));
      }, 900);
      return () => { clearTimeout(t); clearInterval(progressTimer.current!); };
    } else {
      clearInterval(progressTimer.current!);
      setProgress(100);
      const t = setTimeout(() => {
        setProgressVisible(false);
        setProgress(0);
      }, 450);
      return () => clearTimeout(t);
    }
  }, [isProcessing]);

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
      {/* ── 非 dispatch 路由：全宽视图 ── */}
      {activeNavSection === 'command' && (
        <CommandCenter onNavClick={onNavClick} onStartSession={onStartSession} />
      )}
      {activeNavSection === 'agents' && <AgentsView />}
      {activeNavSection === 'review' && <ReviewView />}
      {activeNavSection === 'artifacts' && <ArtifactsView />}
      {activeNavSection === 'capabilities' && <CapabilitiesView />}
      {activeNavSection === 'monitor' && <MonitorView />}
      {activeNavSection === 'settings' && (
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          <SettingsPanel />
        </div>
      )}

      {/* ── dispatch 路由：原有 Chat + Terminal 界面 ── */}
      {activeNavSection === 'dispatch' && (
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

          {/* 全局进度条：streaming 时显示 */}
          {progressVisible && (
            <div className="global-progress-bar" aria-hidden="true">
              <div
                className="global-progress-fill"
                style={{
                  width: `${progress}%`,
                  transition: progress === 0 ? 'none' : 'width 0.85s cubic-bezier(0.1, 0.4, 0.3, 1)',
                }}
              />
            </div>
          )}

          {/* 多会话标签条 */}
          <div className="session-tab-bar">
            {tabs.map((tab, index) => (
              <div
                key={tab.id}
                draggable={renamingTabId !== tab.id}
                onDragStart={(e) => {
                  dragFromIndex.current = index;
                  e.dataTransfer.effectAllowed = 'move';
                  // 延迟让浏览器截图有机会生成
                  setTimeout(() => setDragOverIndex(index), 0);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverIndex(index);
                }}
                onDragLeave={() => {
                  // 仅在离开到非 tab 区域时清除
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFromIndex.current !== null && dragFromIndex.current !== index) {
                    reorderTab(dragFromIndex.current, index);
                  }
                  dragFromIndex.current = null;
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  dragFromIndex.current = null;
                  setDragOverIndex(null);
                }}
                onClick={() => { if (renamingTabId !== tab.id) setActiveTab(tab.id); }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setRenamingTabId(tab.id);
                  setRenameValue(tab.label);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ tabId: tab.id, x: e.clientX, y: e.clientY });
                }}
                className={[
                  'session-tab',
                  tab.id === activeTabId ? 'active' : '',
                  dragOverIndex === index && dragFromIndex.current !== index ? 'drag-over' : '',
                ].filter(Boolean).join(' ')}
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
                    {processingTabs[tab.id] && (
                      <span className="session-tab-spinner" title="处理中…" />
                    )}
                    {tab.label}
                  </span>
                )}
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // 关闭时先停止该 tab 的 CLI 进程，释放资源
                      window.electronAPI.cliStopMessage(tab.id).catch(() => {});
                      closeTab(tab.id);
                    }}
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

          {/* 右键菜单 */}
          {contextMenu && (() => {
            const tab = tabs.find((t) => t.id === contextMenu.tabId);
            if (!tab) return null;
            return (
              <div
                ref={contextMenuRef}
                className="tab-context-menu"
                style={{ top: contextMenu.y, left: contextMenu.x }}
              >
                <button
                  className="tab-context-item"
                  onClick={() => {
                    setRenamingTabId(tab.id);
                    setRenameValue(tab.label);
                    setContextMenu(null);
                  }}
                >
                  ✏️ 重命名
                </button>
                <button
                  className="tab-context-item"
                  onClick={() => {
                    // 从 store 的 snapshot 中读取工作目录
                    const snap = useAppStore.getState().tabSnapshots[tab.id];
                    const path = snap?.session?.workingDirectory ?? '';
                    if (path) void navigator.clipboard.writeText(path);
                    setContextMenu(null);
                  }}
                >
                  📋 复制路径
                </button>
                {tabs.length > 1 && (
                  <button
                    className="tab-context-item danger"
                    onClick={() => {
                      window.electronAPI.cliStopMessage(tab.id).catch(() => {});
                      closeTab(tab.id);
                      setContextMenu(null);
                    }}
                  >
                    ✕ 关闭标签
                  </button>
                )}
              </div>
            );
          })()}

          {/* dispatch 内始终显示 TaskView（无连接时显示欢迎态已移至 CommandCenter） */}
          <TaskView activeTabId={activeTabId} />
          <TerminalPanel />
        </div>

        {/* 右侧可折叠历史侧边栏 */}
        <div className={`chat-history-sidebar${showHistory ? ' open' : ''}`}>
          <div className="chat-history-sidebar-inner">
            <SessionList />
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
