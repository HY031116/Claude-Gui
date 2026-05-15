import { useEffect, useCallback, useState, useRef } from 'react';
import { useAppStore, persistTabState } from './stores/useAppStore';
import { NavRail } from './components/layout/NavRail';
import { WorkspaceArea } from './components/layout/WorkspaceArea';
import { AuxPanel } from './components/layout/AuxPanel';
import { StatusBar } from './components/layout/StatusBar';
import { ShortcutsModal } from './components/layout/ShortcutsModal';
import { CommandPalette } from './components/layout/CommandPalette';
import { UpdateBanner } from './components/UpdateBanner';
import { WebModeBanner } from './components/WebModeBanner';
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
  const accentColor = useAppStore((s) => s.accentColor);
  const fontSize = useAppStore((s) => s.fontSize);
  const setCurrentStatus = useAppStore((s) => s.setCurrentStatus);
  const triggerHistorySearch = useAppStore((s) => s.triggerHistorySearch);
  const setPendingMonitorTab = useAppStore((s) => s.setPendingMonitorTab);

  // 可拖拽侧边栏
  const { sidebarWidth, handleResizeMouseDown } = useResizableSidebar();
  // CLI 输出监听（RAF 批次写入）
  useCliOutput();

  // 主题/强调色/字体大小：同步到 document 根元素属性
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-accent', accentColor);
    if (fontSize === 'normal') {
      document.documentElement.removeAttribute('data-fontsize');
    } else {
      document.documentElement.setAttribute('data-fontsize', fontSize);
    }
  }, [theme, accentColor, fontSize]);

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

  // 命令面板（Ctrl+K）
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const handleCloseCommandPalette = useCallback(() => setShowCommandPalette(false), []);
  const handleShowShortcutsFromPalette = useCallback(() => setShowShortcuts(true), []);

  // 3.3.7：监听后台 tab 的 permission-request 事件，触发系统通知
  useEffect(() => {
    if (!window.electronAPI?.onCliOutput) return;
    const unsubscribe = window.electronAPI.onCliOutput((event) => {
      if (event.type !== 'permission-request') return;
      if (!event.tabId) return;
      const { activeTabId: curActive, tabs } = useAppStore.getState();
      if (event.tabId === curActive) return; // 当前 tab 已可见，无需通知
      try {
        const req = JSON.parse(event.data) as { toolName?: string };
        const tabLabel = tabs.find((t) => t.id === event.tabId)?.label ?? event.tabId;
        const toolName = req.toolName ?? '工具调用';
        window.electronAPI.notifySend(
          'Claude 需要你的输入',
          `${tabLabel} — ${toolName} 请求审批`,
          event.tabId,
        ).catch(() => {});
      } catch { /* 忽略解析失败 */ }
    });
    return () => unsubscribe();
  }, []);

  // 3.3.7：点击系统通知 → 切换到对应 tab 并跳到 dispatch 视图
  useEffect(() => {
    if (!window.electronAPI?.onNotificationClick) return;
    const unsubscribe = window.electronAPI.onNotificationClick((tabId) => {
      const store = useAppStore.getState();
      store.setActiveTab(tabId);
      store.setActiveNavSection('dispatch');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Ctrl+K：打开命令面板（优先于输入框的 Ctrl+K 行为）
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
        return;
      }

      // Ctrl+Shift+F：全局快速搜索历史会话
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        handleNavClick('monitor' as NavClick);
        setPendingMonitorTab('sessions');
        triggerHistorySearch();
        return;
      }

      // Ctrl+1~7：NavRail 快速跳转
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        const NAV_KEYS: Record<string, NavSection> = {
          '1': 'command', '2': 'dispatch', '3': 'agents',
          '4': 'review',  '5': 'artifacts', '6': 'capabilities', '7': 'monitor',
        };
        const target = NAV_KEYS[e.key];
        if (target) {
          e.preventDefault();
          handleNavClick(target as NavClick);
          return;
        }
      }

      if (e.key === '?' && !inInput && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleNavClick, triggerHistorySearch, setPendingMonitorTab]);

  return (
    <>
    <UpdateBanner />
    <WebModeBanner />
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

      {/* 命令面板（Ctrl+K，fixed 浮层） */}
      {showCommandPalette && (
        <CommandPalette
          onClose={handleCloseCommandPalette}
          onNavClick={handleNavClick as (id: NavClick) => void}
          onStartSession={handleStartSession}
          onShowShortcuts={handleShowShortcutsFromPalette}
        />
      )}
    </>
  );
}

export default App;
