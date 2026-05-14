import { useEffect, useCallback, useState, useRef } from 'react';
import { useAppStore, persistTabState } from './stores/useAppStore';
import { NavRail } from './components/layout/NavRail';
import { WorkspaceArea } from './components/layout/WorkspaceArea';
import { AuxPanel } from './components/layout/AuxPanel';
import { StatusBar } from './components/layout/StatusBar';
import { ShortcutsModal } from './components/layout/ShortcutsModal';
import { UpdateBanner } from './components/UpdateBanner';
import { useResizableSidebar } from './hooks/useResizableSidebar';
import { useCliOutput } from './hooks/useCliOutput';
import { computeNavTransition } from './utils/nav';
import type { NavSection, NavClick } from './utils/nav';

function App() {
  // 精确订阅：只订阅 App 层真正需要的字段
  const activeNavSection = useAppStore((s) => s.activeNavSection) as NavSection;
  const setActiveNavSection = useAppStore((s) => s.setActiveNavSection);
  const activeAuxSubPanel = useAppStore((s) => s.activeAuxSubPanel);
  const setActiveAuxSubPanel = useAppStore((s) => s.setActiveAuxSubPanel);
  const session = useAppStore((s) => s.session);
  const setSession = useAppStore((s) => s.setSession);
  const addMessage = useAppStore((s) => s.addMessage);
  const addTerminalLine = useAppStore((s) => s.addTerminalLine);
  const theme = useAppStore((s) => s.theme);
  const setCurrentStatus = useAppStore((s) => s.setCurrentStatus);

  // 可拖拽侧边栏
  const { sidebarWidth, handleResizeMouseDown } = useResizableSidebar();
  // CLI 输出监听（RAF 批次写入）
  useCliOutput();

  // 主题切换：更新 document 根元素的 data-theme 属性
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // 应用关闭前将所有 tab 状态持久化到 localStorage（下次启动时恢复）
  useEffect(() => {
    const handleBeforeUnload = () => persistTabState();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // 启动时加载设置到 store，供状态栏展示
  useEffect(() => {
    window.electronAPI.loadSettings()
      .then((res) => {
        if (res.success && res.settings) {
          setCurrentStatus(res.settings.model ?? '', res.settings.authMode ?? '');
          setAutoConnectOnLaunch(res.settings.autoConnectOnLaunch ?? true);
        }
      })
      .catch((error) => {
        console.error('Failed to load startup settings:', error);
      })
      .finally(() => {
        setStartupSettingsLoaded(true);
      });
  }, [setCurrentStatus]);

  const autoConnectAttempted = useRef(false);

  // RAF 批次写入终端行已移至 useCliOutput hook

  const [autoConnectOnLaunch, setAutoConnectOnLaunch] = useState(true);
  const [startupSettingsLoaded, setStartupSettingsLoaded] = useState(false);

  const appendSystemStatus = useCallback((content: string) => {
    addMessage({
      id: `msg-${Date.now()}`,
      role: 'system',
      content,
      timestamp: Date.now(),
    });
    addTerminalLine({
      id: `term-${Date.now()}`,
      type: 'system',
      content: `${content}\n`,
      timestamp: Date.now(),
    });
  }, [addMessage, addTerminalLine]);

  const startCliSession = useCallback(async () => {
    const cwd = session.workingDirectory || '~';
    const result = await window.electronAPI.cliStart({ cwd });

    if (result.success) {
      setSession({ isConnected: true, workingDirectory: cwd, pid: result.pid });
      return result;
    }

    const errorMessage = result.error || '启动 Claude CLI 失败。';
    appendSystemStatus(errorMessage);
    setSession({ isConnected: false, pid: undefined });
    return result;
  }, [appendSystemStatus, session.workingDirectory, setSession]);



  const handleStartSession = useCallback(async () => {
    await startCliSession();
  }, [startCliSession]);

  useEffect(() => {
    if (!startupSettingsLoaded || !autoConnectOnLaunch || autoConnectAttempted.current || session.isConnected) {
      return;
    }

    autoConnectAttempted.current = true;
    void handleStartSession();
  }, [autoConnectOnLaunch, handleStartSession, session.isConnected, startupSettingsLoaded]);

  // Tab 内联重命名状态已移至 WorkspaceArea

  // 点击导航：files/changes 直达 project 子面板；再次点击同一入口则收起
  const handleNavClick = useCallback((id: NavClick) => {
    const { section, subPanel } = computeNavTransition(activeNavSection, activeAuxSubPanel, id);
    setActiveNavSection(section);
    if (subPanel !== undefined) {
      setActiveAuxSubPanel(subPanel);
    }
  }, [activeNavSection, activeAuxSubPanel, setActiveNavSection, setActiveAuxSubPanel]);

  // project/tools/config 均展开辅助面板
  // v3.0 Agent 中心：只有 dispatch 视图才展开右侧辅助面板
  const auxPanelOpen = activeNavSection === 'dispatch';

  // 快捷键面板
  const [showShortcuts, setShowShortcuts] = useState(false);
  const handleCloseShortcuts = useCallback(() => setShowShortcuts(false), []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (e.key === '?' && !inInput && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
    <UpdateBanner />
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }} data-aux-panel={auxPanelOpen ? 'open' : 'closed'}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* 左侧导航栏 */}
      <NavRail onNavClick={handleNavClick as (id: NavClick) => void} />

      {/* 对话主区域（永置，不被辅助面板替换）*/}
      <WorkspaceArea onStartSession={handleStartSession} onNavClick={handleNavClick as (id: NavClick) => void} />


      {/* 辅助面板（右侧，按需展开） */}
      {auxPanelOpen && (
        <AuxPanel
          width={sidebarWidth}
          onResizeMouseDown={handleResizeMouseDown}
        />
      )}
      </div>{/* /inner flex-row */}

      {/* 底部状态栏 */}
      <StatusBar />
    </div>

      {/* 快捷键一览 Modal（fixed 浮层，挂在 body 级别） */}
      {showShortcuts && <ShortcutsModal onClose={handleCloseShortcuts} />}
    </>
  );
}

export default App;
