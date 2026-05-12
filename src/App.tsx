import { useEffect, useCallback, useState, useRef } from 'react';
import { useAppStore, persistTabState } from './stores/useAppStore';
import type { TerminalLine } from './types';
import { NavRail } from './components/layout/NavRail';
import { WorkspaceArea } from './components/layout/WorkspaceArea';
import { AuxPanel } from './components/layout/AuxPanel';

// NavSection：store 内使用的实际区域（维持不变）
type NavSection = 'chat' | 'project' | 'tools' | 'config';
// NavClick：NavRail 传出的点击 id（files/changes 作为 project 子面板的快捷入口）
type NavClick = 'chat' | 'files' | 'changes' | 'tools' | 'config';

// handleNavClick 需要的默认子标签（tools/config 展开时默认激活）
const SECTION_DEFAULTS: Record<'tools' | 'config', string> = {
  tools: 'mcp',
  config: 'settings',
};

// handleNavClick 合法子标签验证（切换 section 时避免残留旧 sub 值）
const SECTION_VALID_SUBS: Record<'tools' | 'config', string[]> = {
  tools: ['mcp', 'agents', 'plugins', 'hooks', 'skills', 'tasks'],
  config: ['settings', 'rules', 'claude-md', 'mem', 'cost'],
};

function App() {
  // 精确订阅：只订阅 App 层真正需要的字段（其余已移入各 layout 组件）
  const activeNavSection = useAppStore((s) => s.activeNavSection) as NavSection;
  const setActiveNavSection = useAppStore((s) => s.setActiveNavSection);
  const activeAuxSubPanel = useAppStore((s) => s.activeAuxSubPanel);
  const setActiveAuxSubPanel = useAppStore((s) => s.setActiveAuxSubPanel);
  const session = useAppStore((s) => s.session);
  const setSession = useAppStore((s) => s.setSession);
  const addTerminalLine = useAppStore((s) => s.addTerminalLine);
  const addTerminalLines = useAppStore((s) => s.addTerminalLines);
  const addMessage = useAppStore((s) => s.addMessage);
  const theme = useAppStore((s) => s.theme);
  const tokenUsage = useAppStore((s) => s.tokenUsage);
  const setCurrentStatus = useAppStore((s) => s.setCurrentStatus);

  // 可拖拽侧边栏宽度（240~480px，localStorage 持久化）
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    Math.min(480, Math.max(240, parseInt(localStorage.getItem('claude-gui-sidebar-width') || '280', 10)))
  );
  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = sidebarWidth;
    document.body.classList.add('is-resizing');
    e.preventDefault();
  }, [sidebarWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = e.clientX - resizeStartX.current;
      const next = Math.max(240, Math.min(480, resizeStartWidth.current + delta));
      setSidebarWidth(next);
      localStorage.setItem('claude-gui-sidebar-width', String(next));
    };
    const onMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.classList.remove('is-resizing');
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

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

  // RAF 批次写入终端行，避免高频输出时每行一次 setState
  const terminalLineBuffer = useRef<TerminalLine[]>([]);
  const terminalRafPending = useRef(false);

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



  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubscribe = window.electronAPI.onCliOutput((event) => {
      // message-* 类型属于非交互聊天通道，不加入 terminalLines
      if (event.type === 'stdout' || event.type === 'stderr' || event.type === 'exit') {
        // RAF 批次刷新：收集到 buffer，下一帧一次批量写入 store
        terminalLineBuffer.current.push({
          id: `${Date.now()}-${Math.random()}`,
          type: event.type,
          content: event.data,
          timestamp: Date.now(),
        });
        if (!terminalRafPending.current) {
          terminalRafPending.current = true;
          requestAnimationFrame(() => {
            if (terminalLineBuffer.current.length > 0) {
              addTerminalLines(terminalLineBuffer.current);
              terminalLineBuffer.current = [];
            }
            terminalRafPending.current = false;
          });
        }
      }

      // PTY 进程退出事件
      if (event.type === 'exit') {
        // 聊天频道走独立子进程，不依赖 PTY 状态
        // 只清除 pid，保持 isConnected 以允许继续发消息
        setSession({ pid: undefined });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [addTerminalLines, setSession]);

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
    if (id === 'files') {
      // files：直达 project section + files 子标签（再次点击收起）
      if (activeNavSection === 'project' && activeAuxSubPanel === 'files') {
        setActiveNavSection('chat');
      } else {
        setActiveNavSection('project');
        setActiveAuxSubPanel('files');
      }
    } else if (id === 'changes') {
      // changes：直达 project section + changes 子标签（再次点击收起）
      if (activeNavSection === 'project' && activeAuxSubPanel === 'changes') {
        setActiveNavSection('chat');
      } else {
        setActiveNavSection('project');
        setActiveAuxSubPanel('changes');
      }
    } else if (id === 'chat') {
      setActiveNavSection('chat');
    } else {
      // tools / config
      const navId = id as 'tools' | 'config';
      if (activeNavSection === navId) {
        setActiveNavSection('chat');
      } else {
        setActiveNavSection(navId);
        const validSubs = SECTION_VALID_SUBS[navId];
        if (!validSubs.includes(activeAuxSubPanel)) {
          setActiveAuxSubPanel(SECTION_DEFAULTS[navId]);
        }
      }
    }
  }, [activeNavSection, activeAuxSubPanel, setActiveNavSection, setActiveAuxSubPanel]);

  // project/tools/config 均展开辅助面板
  const auxPanelOpen = activeNavSection !== 'chat';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* 左侧导航栏 */}
      <NavRail onNavClick={handleNavClick as (id: NavClick) => void} />

      {/* 对话主区域（永置，不被辅助面板替换）*/}
      <WorkspaceArea onStartSession={handleStartSession} />


      {/* 辅助面板（右侧，按需展开） */}
      {auxPanelOpen && (
        <AuxPanel
          width={sidebarWidth}
          onResizeMouseDown={handleResizeMouseDown}
        />
      )}
      </div>{/* /inner flex-row */}

      {/* 底部状态栏 */}
      <div className="status-bar">
        <span className={`status-dot ${session.isConnected ? 'connected' : 'disconnected'}`} />
        <span className="status-item">
          {session.isConnected ? '已连接' : '未连接'}
        </span>
        {session.isConnected && tokenUsage && (
          <>
            <span className="status-sep">|</span>
            <span className="status-item status-tokens" title={`输入 ${tokenUsage.inputTokens.toLocaleString()} tokens，输出 ${tokenUsage.outputTokens.toLocaleString()} tokens${tokenUsage.costUsd != null ? `，费用 $${tokenUsage.costUsd.toFixed(4)}` : ''}`}>
              ↑{tokenUsage.inputTokens.toLocaleString()} ↓{tokenUsage.outputTokens.toLocaleString()} tokens
              {tokenUsage.costUsd != null && (
                <> · ${tokenUsage.costUsd.toFixed(4)}</>
              )}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
