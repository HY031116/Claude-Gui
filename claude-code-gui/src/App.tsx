import { useEffect, useCallback, useState, useRef } from 'react';
import { useAppStore } from './stores/useAppStore';
import { ChatPanel } from './components/ChatPanel';
import { FileExplorer } from './components/FileExplorer';
import { TerminalPanel } from './components/TerminalPanel';
import { ToolCallView } from './components/ToolCallView';
import { SettingsPanel } from './components/SettingsPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { SkillsPanel } from './components/SkillsPanel';
import { MessageSquare, FolderOpen, Wrench, PanelLeft, PanelRight, Settings, History, Sun, Moon, BookOpen } from 'lucide-react';
import type { CliPrompt } from './types';

// Strip ANSI escape codes from terminal output
function stripAnsi(str: string): string {
  return str.replace(/\[[0-9;]*[a-zA-Z]/g, '').replace(/\][^]*/g, '');
}

// Known interactive prompts with their options
function detectInteractivePrompt(text: string): CliPrompt | null {
  const clean = stripAnsi(text);

  // Debug: log what we're checking
  console.log('[App] =============================');
  console.log('[App] Checking for prompts in output:');
  console.log('[App] Raw length:', text.length);
  console.log('[App] Clean length:', clean.length);
  console.log('[App] Clean preview (first 500 chars):');
  console.log(clean.slice(0, 500));
  console.log('[App] --- end preview ---');

  // Check for key markers
  const hasChooseText = clean.includes('Choose the text style');
  const hasTextStyle = clean.includes('text style');
  const hasWelcome = clean.includes('Welcome to Claude Code');
  const hasDarkMode = clean.includes('Dark mode');
  const hasLightMode = clean.includes('Light mode');

  console.log('[App] Markers - chooseText:', hasChooseText, 'textStyle:', hasTextStyle, 'welcome:', hasWelcome, 'darkMode:', hasDarkMode, 'lightMode:', hasLightMode);

  // Theme selection prompt - multiple detection patterns
  const hasThemePrompt = hasChooseText || hasTextStyle || (hasWelcome && hasDarkMode && hasLightMode);

  console.log('[App] hasThemePrompt:', hasThemePrompt);

  if (hasThemePrompt) {
    console.log('[App] >>> MATCHED theme-selection prompt!');
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
  console.log('[App] Markers - syntaxTheme:', hasSyntaxTheme, 'monokai:', hasMonokai);

  if (hasSyntaxTheme || hasMonokai) {
    console.log('[App] >>> MATCHED syntax-theme prompt!');
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

  console.log('[App] No prompt matched');
  console.log('[App] =============================');
  return null;
}

function App() {
  const {
    activePanel,
    setActivePanel,
    sidebarVisible,
    setSidebarVisible,
    session,
    setSession,
    addTerminalLine,
    addMessage,
    pendingPrompt,
    setPendingPrompt,
    theme,
    setTheme,
    currentModel,
    currentAuthMode,
    setCurrentStatus,
  } = useAppStore();
  const isWindows = navigator.userAgent.includes('Windows');

  // 主题切换：更新 document 根元素的 data-theme 属性
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // 启动时加载设置到 store，供状态栏展示
  useEffect(() => {
    window.electronAPI.loadSettings().then((res) => {
      if (res.success && res.settings) {
        setCurrentStatus(res.settings.model ?? '', res.settings.authMode ?? '');
      }
    });
  }, [setCurrentStatus]);

  // Buffer for accumulating terminal output to detect interactive prompts
  const outputBuffer = useRef('');
  const promptCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptResolved = useRef<Set<string>>(new Set());
  const compatibilityRestartPending = useRef(false);
  const compatibilityFallbackUsed = useRef(false);
  const skipNextExitCleanup = useRef(false);

  const [autofillStatus, setAutofillStatus] = useState<string | null>(null);

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
    const cwd = session.workingDirectory || 'D:\\My Project\\claude';
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
        addTerminalLine({
          id: `${Date.now()}-${Math.random()}`,
          type: event.type,
          content: event.data,
          timestamp: Date.now(),
        });
      }

      // Accumulate output for prompt detection
      if (event.type === 'stdout') {
        outputBuffer.current += event.data;
        console.log('[App] Output buffer now length:', outputBuffer.current.length);

        // Debounce prompt detection
        if (promptCheckTimer.current) {
          clearTimeout(promptCheckTimer.current);
        }
        promptCheckTimer.current = setTimeout(() => {
          console.log('[App] === DEBOUNCE FIRE ===');
          console.log('[App] pendingPrompt:', pendingPrompt ? pendingPrompt.id : 'null');
          console.log('[App] resolved prompts:', Array.from(promptResolved.current));

          // Skip if a prompt is already showing
          if (pendingPrompt) {
            console.log('[App] Prompt already showing, skipping detection');
            return;
          }
          const prompt = detectInteractivePrompt(outputBuffer.current);
          if (prompt && !promptResolved.current.has(prompt.id)) {
            console.log('[App] >>> MATCHED interactive prompt:', prompt.id);
            if (isWindows && (prompt.id === 'theme-selection' || prompt.id === 'syntax-theme')) {
              void restartInCompatibilityMode(prompt);
            } else {
              setPendingPrompt(prompt);
            }
          }
          console.log('[App] === END DEBOUNCE ===');
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
  }, [addTerminalLine, isWindows, pendingPrompt, restartInCompatibilityMode, setSession, setPendingPrompt]);

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

  const [showSettings, setShowSettings] = useState(false);

  const navItems = [
    { id: 'chat' as const, label: '对话', icon: MessageSquare },
    { id: 'files' as const, label: '文件', icon: FolderOpen },
    { id: 'tools' as const, label: '工具', icon: Wrench },
    { id: 'skills' as const, label: 'Skills', icon: BookOpen },
    { id: 'history' as const, label: '历史', icon: History },
  ];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 24px)', width: '100vw', overflow: 'hidden' }}>
      {/* Left Sidebar Navigation */}
      <div
        style={{
          width: 48,
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 8,
          gap: 4,
          flexShrink: 0,
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              title={item.label}
              className={`nav-button ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        {/* 主题切换 */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
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
        <button
          onClick={() => setSidebarVisible(!sidebarVisible)}
          title="切换侧边栏"
          className="nav-button"
        >
          {sidebarVisible ? <PanelLeft size={18} /> : <PanelRight size={18} />}
        </button>
      </div>

      {/* Sidebar Content */}
      {sidebarVisible && (
        <div
          style={{
            width: 280,
            background: 'var(--bg-primary)',
            borderRight: '1px solid var(--border-color)',
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

          <div style={{ flex: 1, overflow: 'auto' }}>
            {showSettings ? (
              <SettingsPanel />
            ) : (
              <>
                {activePanel === 'chat' && (
                  <div style={{ padding: 12 }}>
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
                )}
                {activePanel === 'files' && <FileExplorer />}
                {activePanel === 'tools' && <ToolCallView />}
              </>
            )}
          </div>
        </div>
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
        ) : (
          <>
            <ChatPanel />
            <TerminalPanel />
          </>
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="status-bar">
        <span className={`status-dot ${session.isConnected ? 'connected' : 'disconnected'}`} />
        <span className="status-item">
          {session.isConnected ? '已连接' : '未连接'}
        </span>
        {currentModel && (
          <>
            <span className="status-sep">|</span>
            <span className="status-item">{currentModel}</span>
          </>
        )}
        {currentAuthMode && (
          <>
            <span className="status-sep">|</span>
            <span className="status-item">
              {currentAuthMode === 'api-key' ? 'API Key' : 'Claude 账户'}
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
