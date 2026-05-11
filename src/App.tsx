import { useEffect, useCallback, useState, useRef } from 'react';
import { useAppStore } from './stores/useAppStore';
import type { TerminalLine } from './types';
import { ChatPanel } from './components/ChatPanel';
import { FileExplorer } from './components/FileExplorer';
import { TerminalPanel } from './components/TerminalPanel';
import { ToolCallView } from './components/ToolCallView';
import { SettingsPanel } from './components/SettingsPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { SkillsPanel } from './components/SkillsPanel';
import { TaskPanel } from './components/TaskPanel';
import { MessageSquare, FolderOpen, Wrench, Settings, History, Sun, Moon, BookOpen, ClipboardList, GitBranch, FileDiff, Brain, FileEdit, RotateCcw, Server, Bot, Puzzle, GitFork, Zap, Shield, TrendingUp } from 'lucide-react';
import { GitPanel } from './components/GitPanel';
import { ChangeSummaryPanel } from './components/ChangeSummaryPanel';
import { SessionList } from './components/SessionList';
import { MemSearchPanel } from './components/MemSearchPanel';
import { MemoryEditPanel } from './components/MemoryEditPanel';
import { CheckpointPanel } from './components/CheckpointPanel';
import { McpPanel } from './components/McpPanel';
import { AgentPanel } from './components/AgentPanel';
import PluginPanel from './components/PluginPanel';
import { WorktreePanel } from './components/WorktreePanel';
import { HooksPanel } from './components/HooksPanel';
import { RulesPanel } from './components/RulesPanel';
import { CostPanel } from './components/CostPanel';
import type { CliPrompt } from './types';

// Strip ANSI escape codes from terminal output
function stripAnsi(str: string): string {
  return str.replace(/\[[0-9;]*[a-zA-Z]/g, '').replace(/\][^]*/g, '');
}

// Known interactive prompts with their options
function detectInteractivePrompt(text: string): CliPrompt | null {
  const clean = stripAnsi(text);

  // Check for key markers
  const hasChooseText = clean.includes('Choose the text style');
  const hasTextStyle = clean.includes('text style');
  const hasWelcome = clean.includes('Welcome to Claude Code');
  const hasDarkMode = clean.includes('Dark mode');
  const hasLightMode = clean.includes('Light mode');

  // Theme selection prompt - multiple detection patterns
  const hasThemePrompt = hasChooseText || hasTextStyle || (hasWelcome && hasDarkMode && hasLightMode);

  if (hasThemePrompt) {
    return {
      id: 'theme-selection',
      title: '选择终端主题',
      description: '选择最适合你终端的文本样式',
      options: [
        { value: '1', label: 'Dark mode' },
        { value: '2', label: 'Light mode' },
        { value: '3', label: 'Dark mode (colorblind-friendly)' },
        { value: '4', label: 'Light mode (colorblind-friendly)' },
        { value: '5', label: 'Dark mode (ANSI colors only)' },
        { value: '6', label: 'Light mode (ANSI colors only)' },
      ],
    };
  }

  // Syntax theme selection
  const hasSyntaxTheme = clean.includes('Syntax theme');
  const hasMonokai = clean.includes('Monokai');

  if (hasSyntaxTheme || hasMonokai) {
    return {
      id: 'syntax-theme',
      title: '选择语法主题',
      description: '选择代码高亮主题',
      options: [
        { value: '\n', label: '使用默认主题 (按回车跳过)' },
        { value: '1', label: 'Monokai Extended' },
      ],
    };
  }

  return null;
}

function App() {
  // 精确订阅各自所需字段，避免 messages/terminalLines 等高频更新触发 App 整体重渲
  const activePanel = useAppStore((s) => s.activePanel);
  const setActivePanel = useAppStore((s) => s.setActivePanel);
  const sidebarVisible = useAppStore((s) => s.sidebarVisible);
  const session = useAppStore((s) => s.session);
  const setSession = useAppStore((s) => s.setSession);
  const addTerminalLine = useAppStore((s) => s.addTerminalLine);
  const addTerminalLines = useAppStore((s) => s.addTerminalLines);
  const addMessage = useAppStore((s) => s.addMessage);
  const pendingPrompt = useAppStore((s) => s.pendingPrompt);
  const setPendingPrompt = useAppStore((s) => s.setPendingPrompt);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const tokenUsage = useAppStore((s) => s.tokenUsage);
  const setCurrentStatus = useAppStore((s) => s.setCurrentStatus);
  const todoItems = useAppStore((s) => s.todoItems);
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const addTab = useAppStore((s) => s.addTab);
  const closeTab = useAppStore((s) => s.closeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const renameTab = useAppStore((s) => s.renameTab);
  const isWindows = navigator.userAgent.includes('Windows');

  // 可拖拽侧边栏宽度（180~480px，localStorage 持久化）
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    Math.min(480, Math.max(180, parseInt(localStorage.getItem('claude-gui-sidebar-width') || '280', 10)))
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
      const next = Math.max(180, Math.min(480, resizeStartWidth.current + delta));
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

  // Buffer for accumulating terminal output to detect interactive prompts
  const outputBuffer = useRef('');
  const promptCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptResolved = useRef<Set<string>>(new Set());
  const compatibilityRestartPending = useRef(false);
  const compatibilityFallbackUsed = useRef(false);
  const skipNextExitCleanup = useRef(false);
  const autoConnectAttempted = useRef(false);

  // RAF 批次写入终端行，避免高频输出时每行一次 setState
  const terminalLineBuffer = useRef<TerminalLine[]>([]);
  const terminalRafPending = useRef(false);

  const [autofillStatus, setAutofillStatus] = useState<string | null>(null);
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

  const startCliSession = useCallback(async (overrides?: { forceBareMode?: boolean }) => {
    const cwd = session.workingDirectory || '~';
    const result = await window.electronAPI.cliStart({
      cwd,
      forceBareMode: overrides?.forceBareMode,
    });

    if (result.success) {
      compatibilityFallbackUsed.current = !!overrides?.forceBareMode;
      setSession({ isConnected: true, workingDirectory: cwd, pid: result.pid });
      return result;
    }

    const errorMessage = result.error || '启动 Claude CLI 失败。';
    appendSystemStatus(errorMessage);
    setSession({ isConnected: false, pid: undefined });
    return result;
  }, [appendSystemStatus, session.workingDirectory, setSession]);

  const restartInCompatibilityMode = useCallback(async (prompt: CliPrompt) => {
    if (compatibilityRestartPending.current || compatibilityFallbackUsed.current) {
      return;
    }

    compatibilityRestartPending.current = true;
    compatibilityFallbackUsed.current = true;
    skipNextExitCleanup.current = true;
    promptResolved.current.add(prompt.id);
    setPendingPrompt(null);
    outputBuffer.current = '';

    const fallbackMessage = `检测到 Claude CLI 首次交互提示“${prompt.title}”。Windows PTY 无法可靠驱动该交互，正在切换到兼容模式重新启动。`;
    appendSystemStatus(fallbackMessage);
    setAutofillStatus('已自动切换到兼容启动模式，正在重新连接 Claude CLI...');

    const result = await startCliSession({ forceBareMode: true });
    if (!result.success) {
      compatibilityFallbackUsed.current = false;
      setAutofillStatus('兼容模式重启失败，请检查 Claude CLI 配置后重试。');
    } else {
      setAutofillStatus('已切换到兼容启动模式，后续会话将跳过该首次交互提示。');
    }

    compatibilityRestartPending.current = false;
    setTimeout(() => setAutofillStatus(null), 5000);
  }, [appendSystemStatus, setPendingPrompt, startCliSession]);

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

      // Accumulate output for prompt detection
      if (event.type === 'stdout') {
        outputBuffer.current += event.data;

        // Debounce prompt detection
        if (promptCheckTimer.current) {
          clearTimeout(promptCheckTimer.current);
        }
        promptCheckTimer.current = setTimeout(() => {
          // Skip if a prompt is already showing
          if (pendingPrompt) {
            return;
          }
          const prompt = detectInteractivePrompt(outputBuffer.current);
          if (prompt && !promptResolved.current.has(prompt.id)) {
            if (isWindows && (prompt.id === 'theme-selection' || prompt.id === 'syntax-theme')) {
              void restartInCompatibilityMode(prompt);
            } else {
              setPendingPrompt(prompt);
            }
          }
        }, 1500);
      }

      // PTY 进程退出事件
      if (event.type === 'exit') {
        if (skipNextExitCleanup.current) {
          skipNextExitCleanup.current = false;
          return;
        }
        if (compatibilityRestartPending.current) {
          return;
        }
        // 聊天频道走独立子进程，不依赖 PTY 状态
        // 只清除 pid，保持 isConnected 以允许继续发消息
        setSession({ pid: undefined });
        // 取消 debounce 定时器，避免 PTY 退出后残留数据触发提示检测
        if (promptCheckTimer.current) {
          clearTimeout(promptCheckTimer.current);
          promptCheckTimer.current = null;
        }
        outputBuffer.current = '';
        // 不清除 promptResolved，避免重启后重新触发已处理的提示
        // 不重置 compatibilityFallbackUsed，避免无限循环
        setPendingPrompt(null);
      }
    });

    return () => {
      unsubscribe();
      if (promptCheckTimer.current) {
        clearTimeout(promptCheckTimer.current);
      }
    };
  }, [addTerminalLines, isWindows, pendingPrompt, restartInCompatibilityMode, setSession, setPendingPrompt]);

  const handlePromptSelect = useCallback(async (value: string) => {
    console.log('[App] handlePromptSelect CALLED, value:', JSON.stringify(value));

    const currentPrompt = pendingPrompt;
    if (currentPrompt) {
      promptResolved.current.add(currentPrompt.id);
    }

    setPendingPrompt(null);
    outputBuffer.current = '';

    try {
      await window.electronAPI.cliSend(value === '\n' ? '' : value);
      setAutofillStatus(`已发送选项“${value === '\n' ? '回车' : value}”到 Claude CLI`);
    } catch (error) {
      console.error('[App] Failed to send prompt option:', error);
      setAutofillStatus('发送提示选项失败，请重试。');
    }
    setTimeout(() => setAutofillStatus(null), 5000);
  }, [pendingPrompt, setPendingPrompt]);

  const handleStartSession = useCallback(async () => {
    compatibilityRestartPending.current = false;
    compatibilityFallbackUsed.current = false;
    skipNextExitCleanup.current = false;
    promptResolved.current.clear();
    outputBuffer.current = '';
    await startCliSession();
  }, [startCliSession]);

  const handleStopSession = useCallback(async () => {
    await window.electronAPI.cliStop();
    setSession({ isConnected: false, pid: undefined });
    compatibilityRestartPending.current = false;
    compatibilityFallbackUsed.current = false;
    skipNextExitCleanup.current = false;
    outputBuffer.current = '';
    promptResolved.current.clear();
    setPendingPrompt(null);
  }, [setPendingPrompt, setSession]);

  useEffect(() => {
    if (!startupSettingsLoaded || !autoConnectOnLaunch || autoConnectAttempted.current || session.isConnected) {
      return;
    }

    autoConnectAttempted.current = true;
    void handleStartSession();
  }, [autoConnectOnLaunch, handleStartSession, session.isConnected, startupSettingsLoaded]);

  const [showSettings, setShowSettings] = useState(false);
  // Tab 内联重命名状态
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const navItems = [
    { id: 'chat' as const, label: '对话', icon: MessageSquare },
    { id: 'files' as const, label: '文件', icon: FolderOpen },
    { id: 'tools' as const, label: '工具', icon: Wrench },
    { id: 'tasks' as const, label: '任务', icon: ClipboardList, badge: todoItems.filter((t) => t.status !== 'completed').length },
    { id: 'git' as const, label: 'Git', icon: GitBranch },
    { id: 'changes' as const, label: '变更', icon: FileDiff },
    { id: 'skills' as const, label: 'Skills', icon: BookOpen },
    { id: 'history' as const, label: '历史', icon: History },
    { id: 'mem' as const, label: '记忆搜索', icon: Brain },
    { id: 'claude-md' as const, label: 'CLAUDE.md', icon: FileEdit },
    { id: 'checkpoints' as const, label: '文件快照', icon: RotateCcw },
    { id: 'mcp' as const, label: 'MCP', icon: Server },
    { id: 'agents' as const, label: 'Agents', icon: Bot },
    { id: 'plugins' as const, label: 'Plugins', icon: Puzzle },
    { id: 'worktrees' as const, label: 'Worktree', icon: GitFork },
    { id: 'hooks' as const, label: 'Hooks', icon: Zap },
    { id: 'rules' as const, label: '权限规则', icon: Shield },
    { id: 'cost' as const, label: '成本', icon: TrendingUp },
  ];

  const isChatWorkspace = activePanel === 'chat' && !showSettings;
  const workspaceLabel = session.workingDirectory
    ? session.workingDirectory.replace(/\\/g, '/').replace(/\/$/, '').split('/').pop() || session.workingDirectory
    : '未选择项目';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left Sidebar Navigation */}
      <div
        style={{
          width: 56,
          background: 'rgba(7, 7, 20, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid var(--glass-border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 8,
          paddingBottom: 8,
          gap: 4,
          flexShrink: 0,
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          const badge = (item as { badge?: number }).badge;
          return (
            <button
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              title={item.label}
              className={`nav-button ${isActive ? 'active' : ''}`}
              style={{ position: 'relative' }}
            >
              <Icon size={20} />
              {badge != null && badge > 0 && (
                <span style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  minWidth: 14,
                  height: 14,
                  borderRadius: 7,
                  background: 'var(--accent-color)',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  padding: '0 2px',
                }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        {/* 主题切换 */}
        <button
          onClick={() => {
            const next = theme === 'dark' ? 'light' : 'dark';
            setTheme(next);
            // 同步 Windows 原生菜单栏/标题栏跟随应用主题
            window.electronAPI?.setNativeTheme?.(next);
          }}
          title={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
          className="nav-button"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          title="设置"
          className={`nav-button ${showSettings ? 'active' : ''}`}
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Sidebar Content — non-chat panels */}
      {sidebarVisible && !isChatWorkspace && (
        <>
        <div
          style={{
            width: sidebarWidth,
            background: 'rgba(10, 8, 28, 0.75)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            borderRight: '1px solid var(--glass-border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {showSettings ? '设置' : navItems.find((n) => n.id === activePanel)?.label}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {session.isConnected ? (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--success-text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--success-text)',
                      display: 'inline-block',
                    }}
                  />
                  已连接
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--text-muted)',
                      display: 'inline-block',
                    }}
                  />
                  未连接
                </span>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {showSettings ? (
              <SettingsPanel />
            ) : (
              <>
                {activePanel === 'chat' && (
                  <>
                    <div style={{ padding: 12, flexShrink: 0 }}>
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
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
                        <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleStopSession}>
                          断开连接
                        </button>
                      ) : (
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleStartSession}>
                          启动 Claude Code
                        </button>
                      )}
                    </div>
                    <SessionList />
                  </>
                )}
                {activePanel !== 'chat' && (
                  <div style={{ flex: 1, overflow: 'auto' }}>
                    {activePanel === 'files' && <FileExplorer />}
                    {activePanel === 'tools' && <ToolCallView />}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        {/* 拖拽调整宽度的把手 */}
        <div
          className="resize-handle"
          onMouseDown={handleResizeMouseDown}
        />
        </>
      )}

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {activePanel === 'history' ? (
          <HistoryPanel />
        ) : activePanel === 'skills' ? (
          <SkillsPanel />
        ) : activePanel === 'tasks' ? (
          <TaskPanel />
        ) : activePanel === 'git' ? (
          <GitPanel />
        ) : activePanel === 'changes' ? (
          <ChangeSummaryPanel />
        ) : activePanel === 'mem' ? (
          <MemSearchPanel />
        ) : activePanel === 'claude-md' ? (
          <MemoryEditPanel />
        ) : activePanel === 'checkpoints' ? (
          <CheckpointPanel />
        ) : activePanel === 'mcp' ? (
          <McpPanel />
        ) : activePanel === 'agents' ? (
          <AgentPanel />
        ) : activePanel === 'plugins' ? (
          <PluginPanel />
        ) : activePanel === 'worktrees' ? (
          <WorktreePanel />
        ) : activePanel === 'hooks' ? (
          <HooksPanel />
        ) : activePanel === 'rules' ? (
          <RulesPanel />
        ) : activePanel === 'cost' ? (
          <CostPanel />
        ) : (
          <>
            <div className="workspace-shell with-inspector">
              <div className="workspace-main-column">
                <div className="workspace-topbar">
                  <div>
                    <div className="workspace-topbar-eyebrow">对话工作区</div>
                    <div className="workspace-topbar-title-row">
                      <strong>{workspaceLabel}</strong>
                      {session.isConnected && (
                        <span className="workspace-topbar-pill connected">
                          Claude 已连接
                        </span>
                      )}
                      {session.conversationSessionId && (
                        <span className="workspace-topbar-pill">
                          会话 {session.conversationSessionId.slice(0, 8)}…
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="workspace-topbar-actions">
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
                        <span className="session-tab-label" title="双击重命名">{tab.label}</span>
                      )}
                      {tabs.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                          className="session-tab-close"
                          title="关闭标签"
                        >×</button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => addTab()}
                    className="session-tab-new"
                    title="新建会话标签 (Ctrl+T)"
                  >+</button>
                </div>
                <ChatPanel key={activeTabId} />
                <TerminalPanel />
              </div>

              <aside className="workspace-inspector">
                  <div className="workspace-inspector-card workspace-inspector-hero">
                    <div className="workspace-inspector-kicker">当前项目</div>
                    <div className="workspace-inspector-title">{workspaceLabel}</div>
                    <div className="workspace-inspector-path" title={session.workingDirectory || '未设置工作目录'}>
                      {session.workingDirectory || '尚未设置工作目录'}
                    </div>
                    <div className="workspace-inspector-stats">
                      <div className="workspace-stat-tile">
                        <span>连接状态</span>
                        <strong>{session.isConnected ? '在线' : '离线'}</strong>
                      </div>
                      <div className="workspace-stat-tile">
                        <span>标签页</span>
                        <strong>{tabs.length}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="workspace-inspector-card">
                    <div className="workspace-card-header">
                      <span>会话控制</span>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
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
                    <div className="workspace-inspector-actions">
                      {session.isConnected ? (
                        <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleStopSession}>
                          断开连接
                        </button>
                      ) : (
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleStartSession}>
                          启动 Claude Code
                        </button>
                      )}
                    </div>
                    <div className="workspace-inline-meta">
                      <span className="workspace-topbar-chip">
                        {session.conversationSessionId ? '续接旧会话' : '新对话模式'}
                      </span>
                    </div>
                  </div>

                  <div className="workspace-inspector-card workspace-inspector-list-card">
                    <div className="workspace-card-header">
                      <span>最近会话</span>
                      <span className="workspace-card-muted">按项目聚合</span>
                    </div>
                    <div className="workspace-session-list-wrap">
                      <SessionList />
                    </div>
                  </div>
                </aside>
            </div>
          </>
        )}
      </div>
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

      {/* CLI Interactive Prompt Modal */}
      {(pendingPrompt || autofillStatus) && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="modal-content"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: 24,
              maxWidth: 480,
              width: '90%',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {pendingPrompt ? (
              <>
                <h3 style={{ margin: '0 0 8px', fontSize: 16, color: 'var(--text-primary)' }}>
                  {pendingPrompt.title}
                </h3>
                {pendingPrompt.description && (
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {pendingPrompt.description}
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendingPrompt.options.map((option) => (
                    <button
                      key={option.value}
                      className="btn"
                      style={{
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        padding: '10px 14px',
                        fontSize: 13,
                      }}
                      onClick={() => handlePromptSelect(option.value)}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'var(--bg-tertiary)',
                          color: 'var(--accent-color)',
                          fontSize: 11,
                          fontWeight: 600,
                          marginRight: 10,
                          flexShrink: 0,
                        }}
                      >
                        {option.value === '\n' ? '↵' : option.value}
                      </span>
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            ) : autofillStatus ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>✓</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 16, color: 'var(--success-text)' }}>
                  Claude CLI 兼容处理
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {autofillStatus}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
