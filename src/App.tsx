import { useEffect, useCallback, useState, useRef } from 'react';
import { useAppStore } from './stores/useAppStore';
import type { TerminalLine } from './types';
import type { CliPrompt } from './types';
import { NavRail } from './components/layout/NavRail';
import { WorkspaceArea } from './components/layout/WorkspaceArea';
import { AuxPanel } from './components/layout/AuxPanel';

type NavSection = 'chat' | 'project' | 'tools' | 'config' | 'history';

// handleNavClick 需要的默认子标签（决定首次展开 section 时聚焦哪个 tab）
const SECTION_DEFAULTS: Record<Exclude<NavSection, 'chat'>, string> = {
  project: 'files',
  tools: 'mcp',
  config: 'settings',
  history: 'sessions',
};

// handleNavClick 合法子标签验证（避免切换 section 时残留旧 sub 值）
const SECTION_VALID_SUBS: Record<Exclude<NavSection, 'chat'>, string[]> = {
  project: ['files', 'git', 'changes', 'worktrees', 'checkpoints'],
  tools: ['mcp', 'agents', 'plugins', 'hooks', 'skills', 'tasks'],
  config: ['settings', 'rules', 'claude-md'],
  history: ['sessions', 'mem', 'cost', 'history-list'],
};

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
  const pendingPrompt = useAppStore((s) => s.pendingPrompt);
  const setPendingPrompt = useAppStore((s) => s.setPendingPrompt);
  const theme = useAppStore((s) => s.theme);
  const tokenUsage = useAppStore((s) => s.tokenUsage);
  const setCurrentStatus = useAppStore((s) => s.setCurrentStatus);
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

  // Tab 内联重命名状态已移至 WorkspaceArea

  // 点击一级导航：同一非 chat 入口再次点击则收起辅助面板
  const handleNavClick = useCallback((section: NavSection) => {
    if (section === activeNavSection && section !== 'chat') {
      setActiveNavSection('chat');
    } else {
      setActiveNavSection(section);
      if (section !== 'chat') {
        const validSubs = SECTION_VALID_SUBS[section];
        if (!validSubs.includes(activeAuxSubPanel)) {
          setActiveAuxSubPanel(SECTION_DEFAULTS[section]);
        }
      }
    }
  }, [activeNavSection, activeAuxSubPanel, setActiveNavSection, setActiveAuxSubPanel]);

  const auxPanelOpen = activeNavSection !== 'chat';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* 左侧导航栏 */}
      <NavRail onNavClick={handleNavClick} />

      {/* 对话主区域（永置，不被辅助面板替换）*/}
      <WorkspaceArea />


      {/* 辅助面板（右侧，按需展开） */}
      {auxPanelOpen && (
        <AuxPanel
          width={sidebarWidth}
          onResizeMouseDown={handleResizeMouseDown}
          onStartSession={handleStartSession}
          onStopSession={handleStopSession}
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
