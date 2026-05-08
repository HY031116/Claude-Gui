import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Send, User, Bot, Loader2, Copy, Check, ChevronDown, ChevronUp, Wrench, Square, FolderOpen, Pencil, X, Paperclip, FileCode } from 'lucide-react';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/common';
import 'highlight.js/styles/github-dark.css';
import type { Message, ToolCall } from '../types';

// 配置 marked：GFM + 换行符转 <br> + highlight.js 语法高亮
const renderer = new marked.Renderer();
renderer.code = function({ text, lang }: { text: string; lang?: string }) {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(text, { language }).value;
  return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
};
marked.use({ gfm: true, breaks: true, renderer });

/** 将 Markdown 文本渲染为 HTML 字符串 */
function renderMarkdown(text: string): string {
  if (!text) return '';
  return marked.parse(text) as string;
}

/** stream-json 解析结果类型 */
type ParsedStreamEvent =
  | { type: 'assistant'; text: string; thinking: string; toolUses: { id: string; name: string; input: Record<string, unknown> }[] }
  | { type: 'tool_result'; results: { tool_use_id: string; content: string }[] }
  | { type: 'session_end'; sessionId: string; subtype: string };

/** 解析 claude --output-format stream-json 输出的单行 */
function parseStreamJsonLine(line: string): ParsedStreamEvent | null {
  if (!line.trim()) return null;
  try {
    const obj = JSON.parse(line);

    if (obj.type === 'assistant' && obj.message?.content) {
      const textParts: string[] = [];
      const thinkingParts: string[] = [];
      const toolUses: { id: string; name: string; input: Record<string, unknown> }[] = [];
      for (const block of obj.message.content) {
        if (block.type === 'text') textParts.push(block.text as string);
        else if (block.type === 'thinking') thinkingParts.push(block.thinking as string);
        else if (block.type === 'tool_use') {
          toolUses.push({ id: block.id, name: block.name, input: (block.input as Record<string, unknown>) || {} });
        }
      }
      return { type: 'assistant', text: textParts.join(''), thinking: thinkingParts.join('\n\n'), toolUses };
    }

    if (obj.type === 'tool' && Array.isArray(obj.content)) {
      const results: { tool_use_id: string; content: string }[] = [];
      for (const block of obj.content) {
        if (block.type === 'tool_result') {
          const content = Array.isArray(block.content)
            ? (block.content as Array<{ type: string; text: string }>)
                .filter((b) => b.type === 'text')
                .map((b) => b.text)
                .join('')
            : String(block.content ?? '');
          results.push({ tool_use_id: block.tool_use_id as string, content });
        }
      }
      return { type: 'tool_result', results };
    }

    if (obj.type === 'result' && obj.session_id) {
      return { type: 'session_end', sessionId: obj.session_id as string, subtype: (obj.subtype as string) || 'success' };
    }
  } catch {
    // 非 JSON 行忽略
  }
  return null;
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return new Date(timestamp).toLocaleDateString();
}

export function ChatPanel() {
  const { messages, addMessage, updateMessage, session, setSession, addOrUpdateConversation, setTodoItems } = useAppStore();
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  // 工作目录编辑状态
  const [wdEditing, setWdEditing] = useState(false);
  const [wdDraft, setWdDraft] = useState('');
  // 上下文文件附件（每次对话完成后清空，或手动移除）
  const [contextFiles, setContextFiles] = useState<{ path: string; name: string; content: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const assistantIdRef = useRef<string | null>(null);
  // 打字机：已显示长度
  const displayedLengthRef = useRef(0);
  // 打字机：目标完整文本
  const targetContentRef = useRef('');
  // rAF 句柄
  const rafRef = useRef<number | null>(null);
  // stderr 错误是否已提示（避免重复）
  const stderrErrShownRef = useRef(false);
  // 当前消息正在执行的工具调用列表
  const pendingToolCallsRef = useRef<ToolCall[]>([]);
  // 当前对话的第一条用户消息（作为预览）
  const firstUserMessageRef = useRef<string>('');
  // 当前对话开始时间戳
  const conversationStartedAtRef = useRef<number>(Date.now());
  // 工作目录 ref（避免加入 useEffect 依赖）
  const workingDirectoryRef = useRef<string>(session.workingDirectory);
  workingDirectoryRef.current = session.workingDirectory;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  /** 打字机驱动：每帧追加 8 个字符，约 480字/秒 */
  const runTypewriter = useCallback(() => {
    const target = targetContentRef.current;
    const displayed = displayedLengthRef.current;
    if (displayed >= target.length) {
      rafRef.current = null;
      return;
    }
    const nextLen = Math.min(displayed + 8, target.length);
    displayedLengthRef.current = nextLen;
    if (assistantIdRef.current) {
      updateMessage(assistantIdRef.current, { content: target.slice(0, nextLen) });
    }
    rafRef.current = requestAnimationFrame(runTypewriter);
  }, [updateMessage]);

  /** 启动打字机（若未运行） */
  const kickTypewriter = useCallback(() => {
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(runTypewriter);
    }
  }, [runTypewriter]);

  /**
   * 确保当前已有助手消息气泡，返回其 id
   * 若不存在则创建新的（含空 toolCalls 数组）
   */
  const ensureAssistantMessage = useCallback((): string => {
    if (!assistantIdRef.current) {
      const id = `msg-${Date.now()}`;
      assistantIdRef.current = id;
      pendingToolCallsRef.current = [];
      addMessage({ id, role: 'assistant', content: '', timestamp: Date.now(), toolCalls: [] });
    }
    return assistantIdRef.current;
  }, [addMessage]);

  // 监听 cli:output 事件，完整处理 stream-json 所有类型
  useEffect(() => {
    const unsubscribe = window.electronAPI.onCliOutput((event) => {
      if (event.type === 'message-chunk') {
        const lines = event.data.split('\n');
        let hasNewText = false;

        for (const line of lines) {
          const parsed = parseStreamJsonLine(line);
          if (!parsed) continue;

          if (parsed.type === 'assistant') {
            // 提取思考链内容 → 注入消息
            if (parsed.thinking) {
              const msgId = ensureAssistantMessage();
              updateMessage(msgId, { thinking: parsed.thinking });
            }
            // 累积文本内容 → 打字机队列
            if (parsed.text) {
              targetContentRef.current += parsed.text;
              ensureAssistantMessage();
              hasNewText = true;
            }
            // 工具调用 → 立即加入 toolCalls 列表，并对 Write 工具捕获文件快照
            for (const toolUse of parsed.toolUses) {
              const msgId = ensureAssistantMessage();
              const newCall = { id: toolUse.id, name: toolUse.name, arguments: toolUse.input, status: 'pending' as const };
              pendingToolCallsRef.current = [...pendingToolCallsRef.current, newCall];
              updateMessage(msgId, { toolCalls: [...pendingToolCallsRef.current] });

              // Write 工具：异步读取执行前文件内容作为快照
              if (toolUse.name === 'Write' || toolUse.name === 'write_file') {
                const filePath = (toolUse.input?.file_path || toolUse.input?.path) as string | undefined;
                if (filePath) {
                  window.electronAPI.readFile(filePath.replace(/\\/g, '/')).then((res) => {
                    if (res.success && res.content) {
                      pendingToolCallsRef.current = pendingToolCallsRef.current.map((tc) =>
                        tc.id === toolUse.id ? { ...tc, originalContent: res.content } : tc,
                      );
                      if (assistantIdRef.current) {
                        updateMessage(assistantIdRef.current, { toolCalls: [...pendingToolCallsRef.current] });
                      }
                    }
                  }).catch(() => {/* 文件不存在时忽略 */});
                }
              }
            }
          }

          if (parsed.type === 'tool_result') {
            // 更新对应工具调用的结果
            for (const res of parsed.results) {
              const idx = pendingToolCallsRef.current.findIndex((tc) => tc.id === res.tool_use_id);
              if (idx >= 0 && assistantIdRef.current) {
                pendingToolCallsRef.current = pendingToolCallsRef.current.map((tc, i) =>
                  i === idx ? { ...tc, result: res.content, status: 'success' as const } : tc,
                );
                updateMessage(assistantIdRef.current, { toolCalls: [...pendingToolCallsRef.current] });

                // 解析 TodoWrite 的 input 参数（工具调用的 arguments.todos 字段）
                const tc = pendingToolCallsRef.current[idx];
                if ((tc.name === 'TodoWrite' || tc.name === 'mcp__ide__createTasks') && tc.arguments?.todos) {
                  try {
                    const todos = tc.arguments.todos as { id: string; content: string; status: string }[];
                    setTodoItems(todos.map((t) => ({
                      id: t.id,
                      content: t.content,
                      status: (['pending', 'in_progress', 'completed'].includes(t.status)
                        ? t.status : 'pending') as 'pending' | 'in_progress' | 'completed',
                    })));
                  } catch { /* 解析失败忽略 */ }
                }
              }
            }
          }

          // 解析最终 result 行，获取 session_id 用于多轮对话
          if (parsed.type === 'session_end' && parsed.sessionId) {
            setSession({ conversationSessionId: parsed.sessionId });
            // 将此次会话保存到历史记录
            addOrUpdateConversation({
              sessionId: parsed.sessionId,
              workingDirectory: workingDirectoryRef.current,
              preview: firstUserMessageRef.current,
              startedAt: conversationStartedAtRef.current,
              lastMessageAt: Date.now(),
            });
          }
        }

        if (hasNewText) kickTypewriter();

      } else if (event.type === 'message-done') {
        // Flush 打字机剩余内容
        if (assistantIdRef.current && targetContentRef.current) {
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
          updateMessage(assistantIdRef.current, { content: targetContentRef.current });
          displayedLengthRef.current = targetContentRef.current.length;
        }

        const exitCode = parseInt(event.data, 10);
        if (!targetContentRef.current && !pendingToolCallsRef.current.length && exitCode !== 0) {
          addMessage({
            id: `msg-${Date.now()}-err`,
            role: 'system',
            content: `Claude 进程异常退出（code: ${event.data}），请检查设置或重试。`,
            timestamp: Date.now(),
          });
        }

        setIsProcessing(false);
        assistantIdRef.current = null;
        targetContentRef.current = '';
        displayedLengthRef.current = 0;
        stderrErrShownRef.current = false;
        pendingToolCallsRef.current = [];

      } else if (event.type === 'message-stderr') {
        const stderrText = event.data;
        let friendlyError = '';

        if (stderrText.includes('401') || stderrText.toLowerCase().includes('unauthorized') || stderrText.toLowerCase().includes('api key')) {
          friendlyError = 'API Key 无效或未授权，请在设置中检查 API Key 配置。';
        } else if (stderrText.includes('403')) {
          friendlyError = '访问被拒绝（403），请确认 API Key 权限。';
        } else if (stderrText.includes('429') || stderrText.toLowerCase().includes('rate limit')) {
          friendlyError = '请求频率超限（429 Rate Limit），请稍后再试。';
        } else if (stderrText.includes('503') || stderrText.toLowerCase().includes('service unavailable')) {
          friendlyError = '服务暂时不可用（503），请稍后重试。';
        } else if (stderrText.toLowerCase().includes('econnrefused') || stderrText.toLowerCase().includes('network')) {
          friendlyError = '网络连接失败，请检查代理设置或网络状态。';
        } else if (stderrText.toLowerCase().includes('model') && stderrText.toLowerCase().includes('not found')) {
          friendlyError = '模型不存在或不可用，请在设置中更换模型。';
        } else if (stderrText.trim()) {
          friendlyError = `Claude 返回错误：${stderrText.trim().slice(0, 200)}`;
        }

        if (friendlyError && !stderrErrShownRef.current) {
          stderrErrShownRef.current = true;
          addMessage({ id: `msg-${Date.now()}-stderr`, role: 'system', content: friendlyError, timestamp: Date.now() });
        }

      } else if (event.type === 'message-error') {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        addMessage({ id: `msg-${Date.now()}-err`, role: 'system', content: `发送失败：${event.data}`, timestamp: Date.now() });
        setIsProcessing(false);
        assistantIdRef.current = null;
        targetContentRef.current = '';
        displayedLengthRef.current = 0;
        stderrErrShownRef.current = false;
        pendingToolCallsRef.current = [];
      }
    });
    return unsubscribe;
  }, [addMessage, updateMessage, kickTypewriter, ensureAssistantMessage, setSession, addOrUpdateConversation, setTodoItems]);

  // 组件卸载时清理 rAF
  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !session.isConnected || isProcessing) return;

    const userMsg = input.trim();
    const currentSessionId = session.conversationSessionId;

    // 构造最终消息：若有上下文文件，在消息前注入文件内容
    let finalMsg = userMsg;
    if (contextFiles.length > 0) {
      const fileBlocks = contextFiles.map((f) => `=== ${f.name} ===\n${f.content}\n=== END ===`).join('\n\n');
      finalMsg = `以下是附加的上下文文件，请结合文件内容回答：\n\n${fileBlocks}\n\n---\n${userMsg}`;
    }

    addMessage({ id: `msg-${Date.now()}`, role: 'user', content: userMsg, timestamp: Date.now() });
    setInput('');
    setContextFiles([]); // 发送后清空附件
    setIsProcessing(true);
    assistantIdRef.current = null;
    targetContentRef.current = '';
    displayedLengthRef.current = 0;
    stderrErrShownRef.current = false;
    pendingToolCallsRef.current = [];
    if (!currentSessionId) {
      firstUserMessageRef.current = userMsg.slice(0, 100);
      conversationStartedAtRef.current = Date.now();
    }

    try {
      const result = await window.electronAPI.cliSendMessage(
        finalMsg,
        session.workingDirectory || undefined,
        currentSessionId,
      );
      if (!result.success) {
        addMessage({ id: `msg-${Date.now()}-system`, role: 'system', content: result.error || '消息发送失败。', timestamp: Date.now() });
        setIsProcessing(false);
      }
    } catch {
      addMessage({ id: `msg-${Date.now()}-system`, role: 'system', content: '消息发送失败，请检查设置后重试。', timestamp: Date.now() });
      setIsProcessing(false);
    }
  }, [input, contextFiles, session.isConnected, session.conversationSessionId, session.workingDirectory, isProcessing, addMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /** 停止当前生成 */
  const handleStop = useCallback(async () => {
    try {
      await window.electronAPI.cliStopMessage();
    } catch { /* 忽略 */ }
    // 立即冲刷打字机剩余内容
    if (assistantIdRef.current && targetContentRef.current) {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      updateMessage(assistantIdRef.current, { content: targetContentRef.current });
      displayedLengthRef.current = targetContentRef.current.length;
    }
    addMessage({
      id: `msg-${Date.now()}-stop`,
      role: 'system',
      content: '已手动停止生成。',
      timestamp: Date.now(),
    });
    setIsProcessing(false);
    assistantIdRef.current = null;
    targetContentRef.current = '';
    displayedLengthRef.current = 0;
    stderrErrShownRef.current = false;
    pendingToolCallsRef.current = [];
  }, [updateMessage, addMessage]);

  /** 开始编辑工作目录 */
  const handleWdEdit = useCallback(() => {
    setWdDraft(session.workingDirectory || '');
    setWdEditing(true);
  }, [session.workingDirectory]);

  /** 确认工作目录更改 */
  const handleWdConfirm = useCallback(() => {
    if (wdDraft.trim()) setSession({ workingDirectory: wdDraft.trim() });
    setWdEditing(false);
  }, [wdDraft, setSession]);

  /** 浏览选择目录 */
  const handleWdBrowse = useCallback(async () => {
    const result = await window.electronAPI.selectDirectory(wdDraft || session.workingDirectory || undefined);
    if (result.success && result.path) setWdDraft(result.path);
  }, [wdDraft, session.workingDirectory]);

  /** 添加上下文附件文件 */
  const handleAttachFile = useCallback(async () => {
    const result = await window.electronAPI.selectFile({ defaultPath: session.workingDirectory || undefined });
    if (!result.success || !result.path) return;
    const filePath = result.path.replace(/\\/g, '/');
    if (contextFiles.some((f) => f.path === filePath)) return;
    const readResult = await window.electronAPI.readFile(filePath);
    if (!readResult.success) return;
    const name = filePath.split('/').pop() ?? filePath;
    setContextFiles((prev) => [...prev, { path: filePath, name, content: readResult.content ?? '' }]);
  }, [session.workingDirectory, contextFiles]);

  /** 路径显示：取最后两段 */
  const wdDisplayPath = useMemo(() => {
    const wd = session.workingDirectory;
    if (!wd) return '未设置工作目录';
    // 兼容 Windows 和 Unix 路径分隔符
    const parts = wd.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length <= 2) return wd;
    return `…/${parts.slice(-2).join('/')}`;
  }, [session.workingDirectory]);

  return (
    <div className="chat-container">
      <div className="message-list">
        <div className="message-list-inner">
        {/* 多轮对话状态徽章 */}
        {session.conversationSessionId && (
          <div className="session-badge">
            <span className="session-badge-dot" />
            <span>多轮对话已激活</span>
            <span className="session-badge-id">{session.conversationSessionId.slice(0, 8)}…</span>
          </div>
        )}

        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Bot size={48} strokeWidth={1} />
            </div>
            {session.conversationSessionId ? (
              <>
                <p className="empty-state-title">已恢复历史会话</p>
                <p className="empty-state-desc">
                  会话 ID: <code style={{ fontSize: '12px', opacity: 0.8 }}>{session.conversationSessionId}</code>
                </p>
                <p className="empty-state-desc" style={{ marginTop: 4, opacity: 0.7 }}>
                  发送消息将自动以 --resume 方式继续原对话上下文
                </p>
              </>
            ) : (
              <>
                <p className="empty-state-title">Claude Code GUI</p>
                <p className="empty-state-desc">
                  {session.isConnected
                    ? '在下方输入消息与 Claude Code 交互'
                    : '请先在左侧侧边栏启动 Claude Code 会话'}
                </p>
              </>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {isProcessing && (
          <div className="typing-indicator">
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Claude 正在思考...</span>
            <button className="typing-stop-btn" onClick={handleStop} title="停止生成">
              <Square size={11} />
              停止
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="chat-input-area">
        <div className="chat-input-area-inner">
        {/* 工作目录显示 / 编辑 Bar */}
        <div className="chat-wd-bar">
          {wdEditing ? (
            <div className="chat-wd-edit-row">
              <FolderOpen size={13} className="chat-wd-icon" />
              <input
                className="chat-wd-input"
                value={wdDraft}
                onChange={(e) => setWdDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleWdConfirm();
                  if (e.key === 'Escape') setWdEditing(false);
                }}
                autoFocus
                placeholder="输入路径..."
              />
              <button className="chat-wd-action-btn" onClick={handleWdBrowse} title="浏览目录">
                <FolderOpen size={13} />
              </button>
              <button className="chat-wd-action-btn confirm" onClick={handleWdConfirm} title="确认">
                <Check size={13} />
              </button>
              <button className="chat-wd-action-btn cancel" onClick={() => setWdEditing(false)} title="取消">
                <X size={13} />
              </button>
            </div>
          ) : (
            <button className="chat-wd-display" onClick={handleWdEdit} title={session.workingDirectory || '点击设置工作目录'}>
              <FolderOpen size={13} className="chat-wd-icon" />
              <span className="chat-wd-path">{wdDisplayPath}</span>
              <Pencil size={11} className="chat-wd-edit-icon" />
            </button>
          )}
        </div>
        {/* 附件文件 chips */}
        {contextFiles.length > 0 && (
          <div className="context-files-bar">
            {contextFiles.map((f) => (
              <div key={f.path} className="context-file-chip" title={f.path}>
                <FileCode size={11} />
                <span>{f.name}</span>
                <button onClick={() => setContextFiles((prev) => prev.filter((x) => x.path !== f.path))}>
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="chat-input-wrapper">
          {/* 附件按钮 */}
          <button
            className="chat-attach-btn"
            onClick={handleAttachFile}
            disabled={!session.isConnected}
            title="附加文件到上下文"
          >
            <Paperclip size={16} />
          </button>
          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={session.isConnected ? '输入消息... (Enter 发送，Shift+Enter 换行)' : '请先启动会话'}
            disabled={!session.isConnected}
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <button
            className={`chat-send-btn ${isProcessing ? 'stop' : ''}`}
            onClick={isProcessing ? handleStop : handleSend}
            disabled={!session.isConnected || (!isProcessing && !input.trim())}
            title={isProcessing ? '停止生成' : '发送'}
          >
            {isProcessing ? <Square size={16} /> : <Send size={16} />}
          </button>
        </div>
        {/* 新对话按钮：清除 session ID，下次发送开启全新对话 */}
        {session.conversationSessionId && (
          <button
            className="new-conversation-btn"
            onClick={() => setSession({ conversationSessionId: undefined })}
            title="开始新对话（不继承当前上下文）"
          >
            + 新对话
          </button>
        )}
        </div>
      </div>
    </div>
  );
}

/** 工具调用折叠卡片 */
function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const [approving, setApproving] = useState(false);

  const isBash = toolCall.name === 'Bash' || toolCall.name === 'bash';
  const bashCommand = isBash
    ? (toolCall.arguments?.command as string | undefined) ?? ''
    : '';

  // 常见工具图标映射
  const toolIcon = useMemo(() => {
    const icons: Record<string, string> = {
      Bash: '⚙️', bash: '⚙️', Edit: '✏️', MultiEdit: '✏️',
      Read: '📖', Write: '📝', LS: '📁',
      Glob: '🔎', Grep: '🔎',
      WebSearch: '🔍', WebFetch: '🌐',
      TodoRead: '📋', TodoWrite: '📋',
    };
    return icons[toolCall.name] ?? '🔧';
  }, [toolCall.name]);

  /** supervised 模式下审批回调 */
  const handleApprove = useCallback(async (allow: boolean) => {
    setApproving(true);
    try {
      await window.electronAPI.cliSendToStdin(allow ? 'y\n' : 'n\n');
    } finally {
      setApproving(false);
    }
  }, []);

  // Bash 工具的专属卡片
  if (isBash) {
    return (
      <div className={`tool-call-card tool-call-${toolCall.status} tool-call-bash`}>
        <div className="tool-call-header" onClick={() => setExpanded((v) => !v)}>
          <span style={{ fontSize: 13 }}>⚙️</span>
          <span className="tool-call-name">Shell 命令</span>
          <code style={{
            flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', color: 'var(--text-secondary)',
            marginLeft: 4, marginRight: 8,
          }}>
            {bashCommand.split('\n')[0].slice(0, 80)}
          </code>
          <span className={`tool-call-status tool-call-status-${toolCall.status}`}>
            {toolCall.status === 'pending' ? '执行中…' : toolCall.status === 'success' ? '✓ 完成' : '✗ 失败'}
          </span>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </div>
        {expanded && (
          <div className="tool-call-body">
            {/* 命令显示 */}
            <div className="tool-call-section">
              <div className="tool-call-section-label">命令</div>
              <pre className="tool-call-pre" style={{
                background: '#0d1117',
                color: '#e6edf3',
                borderLeft: '3px solid var(--accent-color)',
                fontSize: 12,
              }}>
                <span style={{ color: '#7ee787', userSelect: 'none' }}>$ </span>
                {bashCommand}
              </pre>
            </div>
            {/* 审批按钮（仅 pending 状态显示） */}
            {toolCall.status === 'pending' && (
              <div style={{ display: 'flex', gap: 8, padding: '4px 0 8px 0' }}>
                <button
                  className="btn-approve"
                  onClick={() => handleApprove(true)}
                  disabled={approving}
                  title="允许执行此命令"
                >
                  ✓ 允许
                </button>
                <button
                  className="btn-deny"
                  onClick={() => handleApprove(false)}
                  disabled={approving}
                  title="拒绝执行此命令"
                >
                  ✗ 拒绝
                </button>
              </div>
            )}
            {/* 执行结果 */}
            {toolCall.result !== undefined && (
              <div className="tool-call-section">
                <div className="tool-call-section-label">输出</div>
                <pre className="tool-call-pre" style={{
                  background: '#0d1117',
                  color: '#e6edf3',
                  maxHeight: 300,
                  fontSize: 12,
                }}>
                  {toolCall.result.length > 3000
                    ? toolCall.result.slice(0, 3000) + '\n…（已截断）'
                    : toolCall.result}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`tool-call-card tool-call-${toolCall.status}`}>
      <div className="tool-call-header" onClick={() => setExpanded((v) => !v)}>
        <Wrench size={11} className="tool-call-icon-svg" />
        <span className="tool-call-name">{toolIcon} {toolCall.name}</span>
        <span className={`tool-call-status tool-call-status-${toolCall.status}`}>
          {toolCall.status === 'pending' ? '执行中…' : toolCall.status === 'success' ? '✓ 完成' : '✗ 失败'}
        </span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </div>
      {expanded && (
        <div className="tool-call-body">
          {Object.keys(toolCall.arguments).length > 0 && (
            <div className="tool-call-section">
              <div className="tool-call-section-label">输入参数</div>
              <pre className="tool-call-pre">{JSON.stringify(toolCall.arguments, null, 2)}</pre>
            </div>
          )}
          {toolCall.result !== undefined && (
            <div className="tool-call-section">
              <div className="tool-call-section-label">执行结果</div>
              <pre className="tool-call-pre">
                {toolCall.result.length > 2000
                  ? toolCall.result.slice(0, 2000) + '\n…（已截断）'
                  : toolCall.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 消息气泡 */
function MessageBubble({ msg }: { msg: Message }) {
  const [copied, setCopied] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const isUser = msg.role === 'user';
  const isSystem = msg.role === 'system';

  // assistant 消息用 marked 渲染 Markdown
  const htmlContent = useMemo(() => {
    if (isUser || isSystem) return msg.content;
    return renderMarkdown(msg.content);
  }, [msg.content, isUser, isSystem]);

  // 代码块自动插入语言标签 + 复制按钮
  useEffect(() => {
    if (!contentRef.current || isUser || isSystem) return;

    // 过滤掉工具调用区域内的 pre
    const pres = contentRef.current.querySelectorAll<HTMLPreElement>('pre:not(.tool-call-pre)');
    pres.forEach((pre) => {
      if (pre.closest('.code-block-wrapper')) return; // 已包装
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      const header = document.createElement('div');
      header.className = 'code-block-header';
      const codeEl = pre.querySelector('code');
      const lang = codeEl?.className.match(/language-(\w+)/)?.[1] ?? '代码';
      const title = document.createElement('span');
      title.textContent = lang;
      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-copy-btn';
      copyBtn.textContent = '复制';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(pre.textContent ?? '').then(() => {
          copyBtn.textContent = '已复制';
          setTimeout(() => { copyBtn.textContent = '复制'; }, 2000);
        });
      });
      header.appendChild(title);
      header.appendChild(copyBtn);
      pre.parentNode?.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);
    });
  }, [htmlContent, isUser, isSystem]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [msg.content]);

  if (isSystem) {
    return (
      <div className="message-bubble message-bubble-system">
        <div className="message-content message-content-system">{msg.content}</div>
      </div>
    );
  }

  return (
    <div className={`message-bubble ${isUser ? 'message-bubble-user' : ''}`}>
      <div className={`message-avatar ${isUser ? 'message-avatar-user' : 'message-avatar-assistant'}`}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      <div className="message-body">
        <div className="message-header">
          <span className="message-sender">{isUser ? '你' : 'Claude'}</span>
          <span className="message-time">{formatTime(msg.timestamp)}</span>
        </div>

        {/* 工具调用列表（assistant 消息） */}
        {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="tool-calls-list">
            {msg.toolCalls.map((tc) => (
              <ToolCallCard key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        {/* 推理思考链（extended thinking 模式） */}
        {!isUser && msg.thinking && (
          <div className="thinking-block">
            <button
              className="thinking-toggle"
              onClick={() => setThinkingExpanded((v) => !v)}
            >
              <span className="thinking-icon">🤔</span>
              <span>推理过程</span>
              <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: 10 }}>
                {thinkingExpanded ? '收起' : '展开'}
              </span>
              {thinkingExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {thinkingExpanded && (
              <div className="thinking-content">
                {msg.thinking}
              </div>
            )}
          </div>
        )}

        {/* 消息正文 */}
        {isUser ? (
          <div className="message-content message-content-user">{msg.content}</div>
        ) : (
          <div
            ref={contentRef}
            className="message-content message-content-assistant markdown-body"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        )}
      </div>

      <div className="message-actions">
        <button
          className={`message-action-btn ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
          title={copied ? '已复制' : '复制消息'}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
}
