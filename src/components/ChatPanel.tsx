import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Send, User, Bot, Loader2, Copy, Check, CheckCircle2, ChevronDown, ChevronUp, Wrench, Square, FolderOpen, Pencil, X, AlertCircle, Paperclip, FileCode, FileDiff, Search, Download, Activity, ListChecks, CircleDollarSign, Shield, RotateCcw } from 'lucide-react';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/common';
import 'highlight.js/styles/github-dark.css';
import type { Message, PlanStep, ToolCall } from '../types';
import type { PermissionRequestEvent } from '../types/electron';
import { InlineDiff, WritePreview, WriteDiff, computeLineDiff } from './DiffView';

// 配置 marked：GFM + 换行符转 <br> + highlight.js 语法高亮
const renderer = new marked.Renderer();
renderer.code = function({ text, lang }: { text: string; lang?: string }) {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(text, { language }).value;
  return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
};
marked.use({ gfm: true, breaks: true, renderer });

/** 模块级 LRU 缓存：同一内容不重复调用 marked.parse（容量 30 条）*/
const markdownCache = new Map<string, string>();
const MARKDOWN_CACHE_LIMIT = 30;

/** 将 Markdown 文本渲染为 HTML 字符串（带 LRU 缓存） */
function renderMarkdown(text: string): string {
  if (!text) return '';
  if (markdownCache.has(text)) {
    // 访问时移至末尾（LRU 最近使用）
    const cached = markdownCache.get(text)!;
    markdownCache.delete(text);
    markdownCache.set(text, cached);
    return cached;
  }
  const html = marked.parse(text) as string;
  if (markdownCache.size >= MARKDOWN_CACHE_LIMIT) {
    // 淘汰最久未使用的第一个键
    markdownCache.delete(markdownCache.keys().next().value!);
  }
  markdownCache.set(text, html);
  return html;
}

/** stream-json 解析结果类型 */
type ParsedStreamEvent =
  | { type: 'assistant'; text: string; thinking: string; toolUses: { id: string; name: string; input: Record<string, unknown> }[] }
  | { type: 'tool_result'; results: { tool_use_id: string; content: string }[] }
  | { type: 'session_end'; sessionId: string; subtype: string; usage?: { input_tokens: number; output_tokens: number }; costUsd?: number; model?: string };

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

    // 旧格式：type = "tool"（向后兼容）
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
      if (results.length > 0) return { type: 'tool_result', results };
    }

    // 新格式（CLI 2.x）：type = "user"，工具结果在 message.content 中
    if (obj.type === 'user' && obj.message?.role === 'user' && Array.isArray(obj.message?.content)) {
      const results: { tool_use_id: string; content: string }[] = [];
      for (const block of obj.message.content as Array<Record<string, unknown>>) {
        if (block['type'] === 'tool_result' && block['tool_use_id']) {
          const rawContent = block['content'];
          const content = Array.isArray(rawContent)
            ? (rawContent as Array<{ type: string; text: string }>)
                .filter((b) => b.type === 'text')
                .map((b) => b.text)
                .join('')
            : String(rawContent ?? '');
          results.push({ tool_use_id: block['tool_use_id'] as string, content });
        }
      }
      if (results.length > 0) return { type: 'tool_result', results };
    }

    if (obj.type === 'result' && obj.session_id) {
      const usage = obj.usage as { input_tokens?: number; output_tokens?: number } | undefined;
      const costUsd = typeof obj.total_cost_usd === 'number' ? obj.total_cost_usd : undefined;
      const model = typeof obj.model === 'string' ? obj.model : undefined;
      return { type: 'session_end', sessionId: obj.session_id as string, subtype: (obj.subtype as string) || 'success', usage: usage ? { input_tokens: usage.input_tokens ?? 0, output_tokens: usage.output_tokens ?? 0 } : undefined, costUsd, model };
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

/** 将工具调用映射为人类可读标签 + 描述（对标 Codex plan item） */
function formatPlanStep(name: string, input: Record<string, unknown>): { label: string; description: string } {
  const n = name.toLowerCase();
  if (n === 'bash' || n === 'shell') {
    const cmd = (input.command as string | undefined) ?? '';
    return { label: '执行命令', description: cmd.slice(0, 80) };
  }
  if (n === 'task') {
    const desc = (input.description ?? input.prompt ?? input.task) as string | undefined;
    const agent = input.agent as string | undefined;
    return { label: '子代理任务', description: agent ? `[${agent}] ${(desc ?? '').slice(0, 50)}` : (desc ?? '').slice(0, 60) };
  }
  if (n === 'write' || n === 'write_file' || n === 'str_replace_based_edit_tool') {
    const p = (input.file_path || input.path || input.filename) as string | undefined;
    return { label: '写入文件', description: p ?? '' };
  }
  if (n === 'read' || n === 'read_file') {
    const p = (input.file_path || input.path) as string | undefined;
    return { label: '读取文件', description: p ?? '' };
  }
  if (n === 'edit' || n === 'edit_file' || n === 'str_replace_editor' || n === 'multiedit') {
    const p = (input.file_path || input.path) as string | undefined;
    return { label: '编辑文件', description: p ?? '' };
  }
  if (n === 'todowrite' || n === 'mcp__ide__createtasks') {
    return { label: '更新任务清单', description: '' };
  }
  if (n === 'glob' || n === 'find_files') {
    const pat = (input.pattern || input.glob) as string | undefined;
    return { label: '查找文件', description: pat ?? '' };
  }
  if (n === 'grep' || n === 'search' || n === 'search_files') {
    const pat = (input.pattern || input.query) as string | undefined;
    return { label: '搜索内容', description: pat ?? '' };
  }
  if (n === 'ls' || n === 'list_directory') {
    const p = (input.path || input.dir) as string | undefined;
    return { label: '列出目录', description: p ?? '' };
  }
  if (n.startsWith('mcp__')) {
    return { label: 'MCP 工具', description: name.replace(/^mcp__/, '').replace(/__/g, '/') };
  }
  if (n === 'websearch' || n === 'web_search') {
    const q = (input.query) as string | undefined;
    return { label: '搜索网页', description: q ?? '' };
  }
  return { label: '工具调用', description: name };
}

function formatCompactTokens(inputTokens: number, outputTokens: number): string {
  const total = inputTokens + outputTokens;
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M`;
  if (total >= 1_000) return `${(total / 1_000).toFixed(1)}K`;
  return String(total);
}

function formatCompactCost(costUsd?: number): string {
  if (costUsd == null) return '—';
  if (costUsd < 0.0001) return '<$0.0001';
  return `$${costUsd.toFixed(4)}`;
}

/** Slash 命令列表 */
const SLASH_COMMANDS: { cmd: string; desc: string }[] = [
  { cmd: '/clear',       desc: '清空当前对话' },
  { cmd: '/compact',     desc: '压缩上下文，保留摘要' },
  { cmd: '/help',        desc: '显示帮助信息' },
  { cmd: '/status',      desc: '显示会话状态和 token 用量' },
  { cmd: '/cost',        desc: '显示本次会话费用' },
  { cmd: '/model',       desc: '切换模型（后接模型名）' },
  { cmd: '/memory',      desc: '查看 / 编辑 CLAUDE.md 记忆' },
  { cmd: '/permissions', desc: '显示当前权限设置' },
  { cmd: '/init',        desc: '初始化项目 CLAUDE.md' },
  { cmd: '/review',      desc: '代码审查' },
  { cmd: '/exit',        desc: '退出 Claude Code' },
];

const PERMISSION_MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'plan', label: 'Plan' },
  { value: 'acceptEdits', label: 'Accept Edits' },
  { value: 'dontAsk', label: 'Don\'t Ask' },
  { value: 'bypassPermissions', label: 'Bypass' },
];

export function ChatPanel() {
  // 精确订阅各自所需字段，避免无关 store 更新触发 ChatPanel 整体重渲
  const messages = useAppStore((s) => s.messages);
  const session = useAppStore((s) => s.session);
  const scrollBottomSeq = useAppStore((s) => s.scrollBottomSeq);
  const addMessage = useAppStore((s) => s.addMessage);
  const updateMessage = useAppStore((s) => s.updateMessage);
  const setSession = useAppStore((s) => s.setSession);
  const addOrUpdateConversation = useAppStore((s) => s.addOrUpdateConversation);
  const setTodoItems = useAppStore((s) => s.setTodoItems);
  const setCurrentStatus = useAppStore((s) => s.setCurrentStatus);
  const setTokenUsage = useAppStore((s) => s.setTokenUsage);
  const tokenUsage = useAppStore((s) => s.tokenUsage);
  const addTokenRecord = useAppStore((s) => s.addTokenRecord);
  const currentModel = useAppStore((s) => s.currentModel);
  const todoItems = useAppStore((s) => s.todoItems);
  // 当前活跃 tab ID，用于事件路由过滤
  const activeTabId = useAppStore((s) => s.activeTabId);
  const activeTabIdRef = useRef<string>(activeTabId);
  useEffect(() => { activeTabIdRef.current = activeTabId; }, [activeTabId]);
  const activePlanSteps = useAppStore((s) => s.activePlanSteps);
  const setActivePanel = useAppStore((s) => s.setActivePanel);
  const addPlanStep = useAppStore((s) => s.addPlanStep);
  const updatePlanStep = useAppStore((s) => s.updatePlanStep);
  const clearPlanSteps = useAppStore((s) => s.clearPlanSteps);
  const setActiveNavSection = useAppStore((s) => s.setActiveNavSection);
  const setActiveAuxSubPanel = useAppStore((s) => s.setActiveAuxSubPanel);
  const appendRawJson = useAppStore((s) => s.appendRawJson);
  const setTabProcessing = useAppStore((s) => s.setTabProcessing);
  const tabs = useAppStore((s) => s.tabs);
  const renameTab = useAppStore((s) => s.renameTab);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  // isProcessing 变化时同步到 store（供 TabBar 显示旋转指示器）
  useEffect(() => {
    setTabProcessing(activeTabId, isProcessing);
  }, [isProcessing, activeTabId, setTabProcessing]);
  // 工作目录编辑状态
  const [wdEditing, setWdEditing] = useState(false);
  const [wdDraft, setWdDraft] = useState('');
  // 上下文文件附件（每次对话完成后清空，或手动移除）
  const [contextFiles, setContextFiles] = useState<{ path: string; name: string; content: string }[]>([]);
  // 粘贴图片附件（Ctrl+V 截图直发）
  const [pastedImages, setPastedImages] = useState<{ preview: string; path: string; name: string }[]>([]);
  // @ 文件提及状态
  const [atMenuOpen, setAtMenuOpen] = useState(false);
  const [atQuery, setAtQuery] = useState('');
  // 当前列出目录的条目（根据 atQuery 目录部分动态加载）
  const [atCurrentDirEntries, setAtCurrentDirEntries] = useState<{ name: string; type: string }[]>([]);
  // 目录内容缓存（key: 绝对路径, value: 条目列表）
  const atDirCacheRef = useRef<Map<string, { name: string; type: string }[]>>(new Map());
  const [atMenuIndex, setAtMenuIndex] = useState(0);
  // 消息搜索
  const [showSearch, setShowSearch] = useState(false);
  // null = 各自独立控制；true = 全局展开；false = 全局折叠
  const [allThinkingExpanded, setAllThinkingExpanded] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  // 导出会话加载中
  const [exporting, setExporting] = useState(false);
  // 模型快切（从 settings 读取当前值）
  const [localModel, setLocalModel] = useState('');
  // 权限/执行模式快切（Claude Code 原生 permission-mode）
  const [localPermissionMode, setLocalPermissionMode] = useState('auto');
  const [autoConnectOnLaunch, setAutoConnectOnLaunch] = useState(true);
  // 首次启动引导：读取 localStorage 标志，未设置则显示引导卡片
  const [onboardingDone, setOnboardingDone] = useState(
    () => !!localStorage.getItem('claude-gui-onboarding-v1')
  );
  const handleOnboardingDone = useCallback(() => {
    localStorage.setItem('claude-gui-onboarding-v1', '1');
    setOnboardingDone(true);
  }, []);
  const handleGoToSettings = useCallback(() => {
    localStorage.setItem('claude-gui-onboarding-v1', '1');
    setOnboardingDone(true);
    setActiveNavSection('config');
    setActiveAuxSubPanel('settings');
  }, [setActiveNavSection, setActiveAuxSubPanel]);
  // Agent 快切
  const [localAgent, setLocalAgent] = useState('');
  const [customAgentNames, setCustomAgentNames] = useState<string[]>([]);
  // 拖拽上传
  const [isDragging, setIsDragging] = useState(false);
  // Claude Code PermissionRequest hook 触发的真实工具审批请求
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequestEvent[]>([]);
  const [permissionRespondingId, setPermissionRespondingId] = useState<string | null>(null);

  /** 是否处于"继续上次会话"模式（下次发消息时用 --continue） */
  const [continueMode, setContinueMode] = useState(false);
  // Slash 命令补全
  const [slashMenuIndex, setSlashMenuIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
  // 当前 assistant 消息对应的步骤快照，保留到消息历史中
  const currentPlanStepsRef = useRef<PlanStep[]>([]);
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

  // 历史消息批量加载时，立即滚到底部（instant 避免 smooth 的渲染时序问题）
  useEffect(() => {
    if (scrollBottomSeq > 0) {
      // 延迟一帧，确保 React 已完成渲染
      const id = requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      });
      return () => cancelAnimationFrame(id);
    }
  }, [scrollBottomSeq]);

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

  const updateCurrentAssistantMessage = useCallback((updates: Partial<Message>) => {
    if (assistantIdRef.current) {
      updateMessage(assistantIdRef.current, updates);
    }
  }, [updateMessage]);

  const syncCurrentPlanSteps = useCallback((planSteps: PlanStep[]) => {
    currentPlanStepsRef.current = planSteps;
    updateCurrentAssistantMessage({ planSteps: [...planSteps] });
  }, [updateCurrentAssistantMessage]);

  /**
   * 确保当前已有助手消息气泡，返回其 id
   * 若不存在则创建新的（含空 toolCalls 数组）
   */
  const ensureAssistantMessage = useCallback((): string => {
    if (!assistantIdRef.current) {
      const id = `msg-${Date.now()}`;
      assistantIdRef.current = id;
      pendingToolCallsRef.current = [];
      currentPlanStepsRef.current = [];
      addMessage({ id, role: 'assistant', content: '', timestamp: Date.now(), toolCalls: [], planSteps: [] });
    }
    return assistantIdRef.current;
  }, [addMessage]);

  // 监听 cli:output 事件，完整处理 stream-json 所有类型
  useEffect(() => {
    const unsubscribe = window.electronAPI.onCliOutput((event) => {
      // message-* 事件按 tabId 路由，只处理当前 tab 的输出
      if (event.type === 'message-chunk' || event.type === 'message-done' ||
          event.type === 'message-stderr' || event.type === 'message-error') {
        if (event.tabId && event.tabId !== activeTabIdRef.current) return;
      }
      if (event.type === 'permission-request') {
        try {
          const request = JSON.parse(event.data) as PermissionRequestEvent;
          setPermissionRequests((prev) => (
            prev.some((item) => item.id === request.id) ? prev : [...prev, request]
          ));
        } catch {
          addMessage({ id: `msg-${Date.now()}-permission`, role: 'system', content: '权限审批请求解析失败。', timestamp: Date.now() });
        }
        return;
      }

      if (event.type === 'permission-resolved') {
        try {
          const resolved = JSON.parse(event.data) as { id?: string };
          if (resolved.id) {
            setPermissionRequests((prev) => prev.filter((item) => item.id !== resolved.id));
            setPermissionRespondingId((current) => current === resolved.id ? null : current);
          }
        } catch { /* 忽略解析失败 */ }
        return;
      }

      if (event.type === 'message-chunk') {
        const lines = event.data.split('\n');
        let hasNewText = false;

        for (const line of lines) {
          // 记录原始 JSON 行（调试用）
          if (line.trim()) appendRawJson(line.trim());

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

              // 实时计划步骤：添加 running 状态
              const { label, description } = formatPlanStep(toolUse.name, toolUse.input);
              const nextPlanSteps = [...currentPlanStepsRef.current, { id: toolUse.id, toolName: toolUse.name, label, description, status: 'running' as const }];
              addPlanStep({ id: toolUse.id, toolName: toolUse.name, label, description, status: 'running' });
              syncCurrentPlanSteps(nextPlanSteps);

              // 文件写入/编辑工具：异步读取执行前文件内容作为快照（用于 Checkpointing 回滚）
              const FILE_MODIFY_TOOLS = ['Write', 'write_file', 'Edit', 'edit_file', 'str_replace_editor', 'MultiEdit', 'multiedit', 'str_replace_based_edit_tool'];
              if (FILE_MODIFY_TOOLS.includes(toolUse.name)) {
                const filePath = (toolUse.input?.file_path || toolUse.input?.path) as string | undefined;
                if (filePath) {
                  window.electronAPI.readFile(filePath.replace(/\\/g, '/')).then((res) => {
                    if (res.success) {
                      // 即使文件为空（res.content === ''）也保存快照，表示文件原先存在且为空
                      const originalContent = res.content ?? '';
                      pendingToolCallsRef.current = pendingToolCallsRef.current.map((tc) =>
                        tc.id === toolUse.id ? { ...tc, originalContent } : tc,
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
                // 正常路径：ref 有效，直接更新
                pendingToolCallsRef.current = pendingToolCallsRef.current.map((tc, i) =>
                  i === idx ? { ...tc, result: res.content, status: 'success' as const } : tc,
                );
                updateMessage(assistantIdRef.current, { toolCalls: [...pendingToolCallsRef.current] });

                // 实时计划步骤：标记为 done
                updatePlanStep(res.tool_use_id, 'done');
                syncCurrentPlanSteps(
                  currentPlanStepsRef.current.map((step) =>
                    step.id === res.tool_use_id ? { ...step, status: 'done' } : step,
                  ),
                );

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
              } else {
                // 兜底路径：ref 被清空（HMR 热重载或组件重挂载），从 store 消息中逆向查找
                const storeMessages = useAppStore.getState().messages;
                for (let mi = storeMessages.length - 1; mi >= 0; mi--) {
                  const msg = storeMessages[mi];
                  if (msg.role !== 'assistant') continue;
                  const tcIdx = msg.toolCalls?.findIndex((tc) => tc.id === res.tool_use_id) ?? -1;
                  if (tcIdx >= 0) {
                    const updatedCalls = msg.toolCalls!.map((tc, i) =>
                      i === tcIdx ? { ...tc, result: res.content, status: 'success' as const } : tc,
                    );
                    const updatedPlanSteps = (msg.planSteps ?? []).map((step) =>
                      step.id === res.tool_use_id ? { ...step, status: 'done' as const } : step,
                    );
                    updateMessage(msg.id, { toolCalls: updatedCalls, planSteps: updatedPlanSteps });
                    updatePlanStep(res.tool_use_id, 'done');
                    // 重建 refs，确保同批次后续工具也能正确更新
                    assistantIdRef.current = msg.id;
                    pendingToolCallsRef.current = updatedCalls;
                    currentPlanStepsRef.current = updatedPlanSteps;
                    break;
                  }
                }
              }
            }
          }

          // 解析最终 result 行，获取 session_id 用于多轮对话
          if (parsed.type === 'session_end' && parsed.sessionId) {
            setSession({ conversationSessionId: parsed.sessionId });
            // 更新 Token 用量 + 写入历史
            if (parsed.usage) {
              setTokenUsage({ inputTokens: parsed.usage.input_tokens, outputTokens: parsed.usage.output_tokens, costUsd: parsed.costUsd });
              addTokenRecord({
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                timestamp: Date.now(),
                sessionId: parsed.sessionId,
                inputTokens: parsed.usage.input_tokens,
                outputTokens: parsed.usage.output_tokens,
                costUsd: parsed.costUsd,
                model: parsed.model ?? currentModel ?? undefined,
                workingDirectory: workingDirectoryRef.current,
              });
            }
            // 将此次会话保存到历史记录
            addOrUpdateConversation({
              sessionId: parsed.sessionId,
              workingDirectory: workingDirectoryRef.current,
              preview: firstUserMessageRef.current,
              startedAt: conversationStartedAtRef.current,
              lastMessageAt: Date.now(),
            });
            // 任务完成系统通知
            const preview = firstUserMessageRef.current ?? '任务已完成';
            window.electronAPI.notifySend?.('Claude Code GUI', preview.slice(0, 80)).catch(() => {});
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
        currentPlanStepsRef.current = [];
        setPermissionRequests([]);
        setPermissionRespondingId(null);

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
        currentPlanStepsRef.current = [];
        setPermissionRequests([]);
        setPermissionRespondingId(null);
      }
    });
    return unsubscribe;
  }, [addMessage, updateMessage, kickTypewriter, ensureAssistantMessage, setSession, addOrUpdateConversation, setTodoItems, setTokenUsage, addTokenRecord, currentModel, addPlanStep, updatePlanStep, syncCurrentPlanSteps]);

  // 工作目录变更时清空 @ 目录缓存
  useEffect(() => {
    atDirCacheRef.current.clear();
    setAtCurrentDirEntries([]);
    setAtMenuOpen(false);
    setAtQuery('');
  }, [session.workingDirectory]);

  // 组件卸载时清理 rAF
  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !session.isConnected || isProcessing) return;

    const userMsg = input.trim();
    const currentSessionId = session.conversationSessionId;

    // 决定 sessionId：有进行中会话优先 --resume；continueMode 时用 --continue
    const effectiveSessionId: string | undefined =
      currentSessionId ?? (continueMode ? 'CONTINUE_LAST' : undefined);

    // 构造最终消息：若有上下文文件，在消息前注入文件内容
    let finalMsg = userMsg;
    if (contextFiles.length > 0) {
      const fileBlocks = contextFiles.map((f) => `=== ${f.name} ===\n${f.content}\n=== END ===`).join('\n\n');
      finalMsg = `以下是附加的上下文文件，请结合文件内容回答：\n\n${fileBlocks}\n\n---\n${userMsg}`;
    }

    addMessage({ id: `msg-${Date.now()}`, role: 'user', content: userMsg, timestamp: Date.now() });
    setInput('');
    setContextFiles([]); // 发送后清空附件
    setPastedImages([]); // 发送后清空图片
    setAtMenuOpen(false); // 发送后关闭 @ 菜单
    setAtQuery('');
    if (continueMode) setContinueMode(false); // 发送后清除 continue 模式
    setTokenUsage(null); // 新对话开始时重置 token 用量
    clearPlanSteps();    // 新消息时清空上一轮步骤
    setIsProcessing(true);
    assistantIdRef.current = null;
    targetContentRef.current = '';
    displayedLengthRef.current = 0;
    stderrErrShownRef.current = false;
    pendingToolCallsRef.current = [];
    currentPlanStepsRef.current = [];
    if (!currentSessionId) {
      firstUserMessageRef.current = userMsg.slice(0, 100);
      conversationStartedAtRef.current = Date.now();
      // 若当前 tab 仍是默认命名（"会话 N"），用消息前 20 字自动命名
      const currentTab = tabs.find((t) => t.id === activeTabId);
      if (currentTab && /^会话\s+\d+$/.test(currentTab.label)) {
        const autoName = userMsg.trim().slice(0, 20) || currentTab.label;
        renameTab(activeTabId, autoName);
      }
    }

    try {
      const result = await window.electronAPI.cliSendMessage(
        finalMsg,
        session.workingDirectory || undefined,
        effectiveSessionId,
        pastedImages.length > 0 ? pastedImages.map((img) => img.path) : undefined,
        localAgent && localAgent !== 'default' ? localAgent : undefined,
        activeTabId,
      );
      if (!result.success) {
        addMessage({ id: `msg-${Date.now()}-system`, role: 'system', content: result.error || '消息发送失败。', timestamp: Date.now() });
        setIsProcessing(false);
      }
    } catch {
      addMessage({ id: `msg-${Date.now()}-system`, role: 'system', content: '消息发送失败，请检查设置后重试。', timestamp: Date.now() });
      setIsProcessing(false);
    }
  }, [input, contextFiles, pastedImages, session.isConnected, session.conversationSessionId, session.workingDirectory, isProcessing, localAgent, continueMode, addMessage, setTokenUsage, clearPlanSteps]);

  /** 将 atQuery 的目录部分解析出绝对路径，优先读缓存，缓存未命中则请求 API */
  const loadAtDir = useCallback(async (query: string) => {
    const lastSlash = query.lastIndexOf('/');
    const subDir = lastSlash >= 0 ? query.slice(0, lastSlash) : '';
    const wd = (session.workingDirectory || '').replace(/\\/g, '/').replace(/\/$/, '');
    const targetDir = subDir ? `${wd}/${subDir}` : wd;

    const cached = atDirCacheRef.current.get(targetDir);
    if (cached) {
      setAtCurrentDirEntries(cached);
      return;
    }
    const res = await window.electronAPI.listDirectory(targetDir);
    if (res.success && res.entries) {
      const entries = res.entries as { name: string; type: string }[];
      atDirCacheRef.current.set(targetDir, entries);
      setAtCurrentDirEntries(entries);
    }
  }, [session.workingDirectory]);

  // @ 查询变化时自动加载对应目录（放在 loadAtDir 定义之后）
  useEffect(() => {
    if (!atMenuOpen) return;
    loadAtDir(atQuery);
  }, [atMenuOpen, atQuery, loadAtDir]);

  /** 选中 @ 文件提及结果：替换输入中的 @查询 并将文件加入上下文 */
  const handleAtSelect = useCallback(async (entry: { name: string; type: string }) => {
    const lastSlash = atQuery.lastIndexOf('/');
    const prefix = lastSlash >= 0 ? atQuery.slice(0, lastSlash + 1) : '';
    const wd = (session.workingDirectory || '').replace(/\\/g, '/').replace(/\/$/, '');

    if (entry.type === 'directory') {
      // 导航进入子目录：更新 query 并重新加载
      const newQuery = `${prefix}${entry.name}/`;
      const atPart = '@' + atQuery;
      setInput((prev) => {
        const idx = prev.lastIndexOf(atPart);
        if (idx === -1) return prev;
        return prev.slice(0, idx) + `@${newQuery}` + prev.slice(idx + atPart.length);
      });
      setAtQuery(newQuery);
      setAtMenuIndex(0);
      // loadAtDir 会通过 useEffect 自动触发
      return;
    }

    // 文件：关闭菜单并加入上下文
    const filePath = `${wd}/${prefix}${entry.name}`;
    const atPart = '@' + atQuery;
    setInput((prev) => {
      const idx = prev.lastIndexOf(atPart);
      if (idx === -1) return prev;
      return prev.slice(0, idx) + `@${prefix}${entry.name} ` + prev.slice(idx + atPart.length);
    });
    setAtMenuOpen(false);
    setAtQuery('');
    setAtMenuIndex(0);
    const readResult = await window.electronAPI.readFile(filePath);
    if (readResult.success) {
      setContextFiles((prev) => {
        if (prev.some((f) => f.path === filePath)) return prev;
        return [...prev, { path: filePath, name: `${prefix}${entry.name}`, content: readResult.content ?? '' }];
      });
    }
    textareaRef.current?.focus();
  }, [atQuery, session.workingDirectory]);

  /** 拦截 textarea 粘贴事件，若剪贴板有图片则保存到临时目录并添加为附件 */
  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;

    e.preventDefault();
    const blob = imageItem.getAsFile();
    if (!blob) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      const ext = imageItem.type.split('/')[1] || 'png';
      try {
        const result = await window.electronAPI.saveTempImage(base64, ext);
        if (result.success && result.path) {
          const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, '-');
          const name = `粘贴图片_${timeStr}.${ext}`;
          setPastedImages((prev) => [...prev, { preview: dataUrl, path: result.path!, name }]);
        }
      } catch {
        // 保存失败时忽略
      }
    };
    reader.readAsDataURL(blob);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // @ 菜单键盘导航
    if (atSuggestions.length > 0 && atMenuOpen) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAtMenuIndex((i) => (i <= 0 ? atSuggestions.length - 1 : i - 1));
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAtMenuIndex((i) => (i >= atSuggestions.length - 1 ? 0 : i + 1));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleAtSelect(atSuggestions[atMenuIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setAtMenuOpen(false);
        setAtQuery('');
        return;
      }
    }
    // Slash 菜单键盘导航
    if (slashSuggestions.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashMenuIndex((i) => (i <= 0 ? slashSuggestions.length - 1 : i - 1));
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashMenuIndex((i) => (i >= slashSuggestions.length - 1 ? 0 : i + 1));
        return;
      }
      if (e.key === 'Enter' && slashMenuIndex >= 0) {
        e.preventDefault();
        setInput(slashSuggestions[slashMenuIndex].cmd + ' ');
        setSlashMenuIndex(-1);
        return;
      }
      if (e.key === 'Escape') {
        setSlashMenuIndex(-1);
        return;
      }
    }
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
    currentPlanStepsRef.current = [];
    setPermissionRequests([]);
    setPermissionRespondingId(null);
  }, [updateMessage, addMessage]);

  /** 输入框上方横幅的真实 PermissionRequest 审批操作 */
  const handleApprovalAction = useCallback(async (request: PermissionRequestEvent, allow: boolean) => {
    setPermissionRespondingId(request.id);
    const result = await window.electronAPI.cliRespondPermission(request.id, allow);
    if (!result.success) {
      addMessage({
        id: `msg-${Date.now()}-permission`,
        role: 'system',
        content: result.error || '权限审批响应失败。',
        timestamp: Date.now(),
      });
      setPermissionRespondingId(null);
      return;
    }
    setPermissionRequests((prev) => prev.filter((item) => item.id !== request.id));
    setPermissionRespondingId(null);
  }, [addMessage]);

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

  const runOverview = useMemo(() => {
    const toolCalls = messages.flatMap((msg) => msg.toolCalls ?? []);
    const runningTools = toolCalls.filter((call) => call.status === 'pending').length;
    const failedTools = toolCalls.filter((call) => call.status === 'error').length;
    const doneTodos = todoItems.filter((item) => item.status === 'completed').length;
    const runningStep = activePlanSteps.find((step) => step.status === 'running');
    const latestStep = runningStep ?? activePlanSteps.at(-1);
    const stateLabel = isProcessing ? '运行中' : session.isConnected ? '待命' : '未连接';
    const stateTone = isProcessing ? 'running' : session.isConnected ? 'ready' : 'offline';
    return {
      stateLabel,
      stateTone,
      latestStep,
      toolSummary: toolCalls.length === 0
        ? '0'
        : `${toolCalls.length}${runningTools ? ` · ${runningTools} 执行中` : ''}${failedTools ? ` · ${failedTools} 失败` : ''}`,
      todoSummary: todoItems.length === 0 ? '0' : `${doneTodos}/${todoItems.length}`,
      tokenSummary: tokenUsage
        ? `${formatCompactTokens(tokenUsage.inputTokens, tokenUsage.outputTokens)} · ${formatCompactCost(tokenUsage.costUsd)}`
        : '—',
    };
  }, [messages, todoItems, activePlanSteps, isProcessing, session.isConnected, tokenUsage]);

  // 搜索匹配的消息 ID 列表
  const matchingMsgIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase();
    return new Set(messages.filter((m) => m.content.toLowerCase().includes(q)).map((m) => m.id));
  }, [searchQuery, messages]);

  // Slash 命令匹配列表
  const slashSuggestions = useMemo(() => {
    if (!input.startsWith('/') || input.includes(' ')) return [];
    const q = input.toLowerCase();
    return SLASH_COMMANDS.filter((c) => c.cmd.startsWith(q));
  }, [input]);

  // @ 文件提及过滤：根据 query 的最后一段过滤当前目录条目
  const atSuggestions = useMemo(() => {
    if (!atMenuOpen) return [];
    const lastSlash = atQuery.lastIndexOf('/');
    const filter = lastSlash >= 0 ? atQuery.slice(lastSlash + 1) : atQuery;
    if (!filter) return atCurrentDirEntries.slice(0, 12);
    return atCurrentDirEntries.filter((e) => e.name.toLowerCase().includes(filter.toLowerCase())).slice(0, 12);
  }, [atMenuOpen, atQuery, atCurrentDirEntries]);

  const pendingApproval = permissionRequests[0] ?? null;

  // Ctrl+F 打开搜索 / Ctrl+O 全局展开折叠 thinking
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        // null → true（展开）→ false（折叠）→ true 循环
        setAllThinkingExpanded((prev) => (prev === null || prev === false) ? true : false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showSearch]);

  // 模型快切：加载当前设置
  useEffect(() => {
    window.electronAPI.loadSettings().then((res) => {
      if (res.success && res.settings?.model) {
        setLocalModel(res.settings.model);
      }
      if (res.success && res.settings?.permissionMode) {
        setLocalPermissionMode(res.settings.permissionMode);
      }
      if (res.success && typeof res.settings?.autoConnectOnLaunch === 'boolean') {
        setAutoConnectOnLaunch(res.settings.autoConnectOnLaunch);
      }
    });
    window.electronAPI.loadCliConfig().then((res) => {
      const mode = res.settings?.permissions?.mode;
      if (res.success && typeof mode === 'string') {
        setLocalPermissionMode(mode);
      }
    }).catch(() => { /* 原生配置不可用时沿用 GUI 设置 */ });
    // 加载自定义 Agent 列表
    window.electronAPI.agentList().then((res) => {
      if (res.success && res.agents) {
        setCustomAgentNames(res.agents.map((a) => a.name || a.filename.replace('.md', '')));
      }
    });
  }, []);

  const handleModelChange = useCallback(async (model: string) => {
    setLocalModel(model);
    const res = await window.electronAPI.loadSettings();
    if (res.success && res.settings) {
      const newSettings = { ...res.settings, model };
      await window.electronAPI.saveSettings(newSettings);
      setCurrentStatus(model, res.settings.authMode ?? '');
    }
  }, [setCurrentStatus]);

  const handlePermissionModeChange = useCallback(async (permissionMode: string) => {
    setLocalPermissionMode(permissionMode);
    const guiResult = await window.electronAPI.loadSettings();
    if (guiResult.success && guiResult.settings) {
      await window.electronAPI.saveSettings({ ...guiResult.settings, permissionMode });
    }

    const cliResult = await window.electronAPI.loadCliConfig();
    if (cliResult.success) {
      const currentSettings = cliResult.settings ?? {};
      await window.electronAPI.saveCliConfig({
        ...currentSettings,
        permissions: {
          ...(currentSettings.permissions ?? {}),
          mode: permissionMode,
        },
      });
    }
  }, []);

  /** 导出会话为 Markdown */
  const handleExport = useCallback(async () => {
    if (messages.length === 0 || exporting) return;
    setExporting(true);
    try {
      const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
      const defaultPath = `claude-conversation-${ts}.md`;
      const res = await window.electronAPI.saveFileDialog({ defaultPath, filters: [{ name: 'Markdown', extensions: ['md'] }, { name: 'Text', extensions: ['txt'] }] });
      if (!res.success || !res.path) return;
      const lines: string[] = [`# Claude 对话导出\n`, `**时间**: ${new Date().toLocaleString()}`];
      if (session.conversationSessionId) lines.push(`**会话 ID**: ${session.conversationSessionId}`);
      lines.push(`\n---\n`);
      for (const msg of messages) {
        if (msg.role === 'system') { lines.push(`> *${msg.content}*\n`); continue; }
        lines.push(`## ${msg.role === 'user' ? '用户' : 'Claude'}\n`);
        lines.push(msg.content + '\n');
      }
      await window.electronAPI.writeFile(res.path, lines.join('\n'));
    } finally {
      setExporting(false);
    }
  }, [messages, exporting, session.conversationSessionId]);

  /** 处理拖拽文件 */
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      // Electron 中 File.path 包含完整路径
      const filePath = (file as File & { path?: string }).path;
      if (!filePath) continue;
      const normalizedPath = filePath.replace(/\\/g, '/');
      if (contextFiles.some((f) => f.path === normalizedPath)) continue;
      // 只支持文本文件（< 500KB）
      if (file.size > 500 * 1024) {
        addMessage({ id: `msg-${Date.now()}`, role: 'system', content: `文件 ${file.name} 超过 500KB，跳过`, timestamp: Date.now() });
        continue;
      }
      const readResult = await window.electronAPI.readFile(normalizedPath);
      if (!readResult.success) {
        addMessage({ id: `msg-${Date.now()}`, role: 'system', content: `无法读取文件: ${file.name}`, timestamp: Date.now() });
        continue;
      }
      setContextFiles((prev) => [...prev, { path: normalizedPath, name: file.name, content: readResult.content ?? '' }]);
    }
  }, [contextFiles, addMessage]);

  return (
    <div
      className="chat-container"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
      onDrop={handleDrop}
    >
      {/* 拖拽遮罩 */}
      {isDragging && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100,
          background: 'rgba(var(--accent-rgb),0.12)',
          border: '2px dashed var(--accent-color)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 15, color: 'var(--accent-color)', fontWeight: 600 }}>
            拖放文件以附加到对话
          </div>
        </div>
      )}
      {/* 搜索栏 */}
      {showSearch && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Search size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索消息内容…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', color: 'var(--text-primary)', fontSize: 13,
            }}
          />
          {searchQuery && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {matchingMsgIds.size} 条匹配
            </span>
          )}
          <button className="btn" style={{ padding: '2px 6px' }} onClick={() => { setShowSearch(false); setSearchQuery(''); }}>
            <X size={13} />
          </button>
        </div>
      )}
      <div className="message-list" style={{ paddingTop: showSearch ? 48 : undefined }}>
        <div className="message-list-inner">
        {/* 多轮对话状态徽章 */}
        {session.conversationSessionId && (
          <div className="session-badge">
            <span className="session-badge-dot" />
            <span>多轮对话已激活</span>
            <span className="session-badge-id">{session.conversationSessionId.slice(0, 8)}…</span>
          </div>
        )}

        <div className="run-overview-strip">
          <div className={`run-overview-status ${runOverview.stateTone}`}>
            <span className="run-overview-dot" />
            <span>{runOverview.stateLabel}</span>
          </div>
          <div className="run-overview-main" title={runOverview.latestStep?.description || wdDisplayPath}>
            <Activity size={13} />
            <span className="run-overview-label">当前</span>
            <span className="run-overview-value">
              {runOverview.latestStep
                ? `${runOverview.latestStep.label}${runOverview.latestStep.description ? ` · ${runOverview.latestStep.description}` : ''}`
                : wdDisplayPath}
            </span>
          </div>
          <button className="run-overview-metric" onClick={() => setActivePanel('tasks')} title="打开任务面板">
            <ListChecks size={12} />
            <span>任务</span>
            <strong>{runOverview.todoSummary}</strong>
          </button>
          <button className="run-overview-metric" onClick={() => setActivePanel('tools')} title="打开工具调用">
            <Wrench size={12} />
            <span>工具</span>
            <strong>{runOverview.toolSummary}</strong>
          </button>
          <button className="run-overview-metric" onClick={() => setActivePanel('cost')} title="打开成本面板">
            <CircleDollarSign size={12} />
            <span>成本</span>
            <strong>{runOverview.tokenSummary}</strong>
          </button>
        </div>

        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Bot size={44} strokeWidth={1} />
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
                {session.isConnected ? (
                  <>
                    <p className="empty-state-desc">有什么可以帮你的？</p>
                    <div className="empty-state-suggestions">
                      {[
                        { icon: <Search size={14} />, text: '审查当前项目代码' },
                        { icon: <Wrench size={14} />, text: '帮我修复 Bug' },
                        { icon: <FileCode size={14} />, text: '创建一个新文件' },
                        { icon: <Activity size={14} />, text: '分析性能瓶颈' },
                      ].map((s) => (
                        <button
                          key={s.text}
                          className="suggestion-chip"
                          onClick={() => setInput(s.text)}
                        >
                          {s.icon}
                          {s.text}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    {/* 首次启动引导：功能简介 + 快速操作 */}
                    {!onboardingDone && (
                      <div style={{ marginTop: 12, width: '100%', maxWidth: 400 }}>
                        <p className="empty-state-desc" style={{ marginBottom: 12, opacity: 0.9 }}>
                          欢迎使用 Claude Code GUI —— Claude Code CLI 的桌面客户端
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', marginBottom: 16 }}>
                          {[
                            { icon: '💬', label: '对话', desc: '与 Claude 实时聊天，支持代码审查、文件编写' },
                            { icon: '📁', label: '文件', desc: '浏览项目文件，点击左侧文件图标一键直达' },
                            { icon: '🔄', label: '变更', desc: '审查 Claude 的文件修改，支持应用全部/撤销全部' },
                            { icon: '🔧', label: '工具', desc: '配置 MCP 服务器、Agents、Hooks 等扩展能力' },
                            { icon: '⚙️', label: '配置', desc: '设置 API Key、模型选择、API 配置文件切换' },
                          ].map((item) => (
                            <div key={item.label} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 10px', borderRadius: 6, background: 'var(--bg-secondary)' }}>
                              <span style={{ fontSize: 16, lineHeight: 1.4 }}>{item.icon}</span>
                              <div>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</span>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 6 }}>{item.desc}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="suggestion-chip" style={{ flex: 1, justifyContent: 'center' }} onClick={handleGoToSettings}>
                            ⚙️ 去配置 API Key
                          </button>
                          <button className="suggestion-chip" style={{ flex: 1, justifyContent: 'center' }} onClick={handleOnboardingDone}>
                            ✓ 直接开始
                          </button>
                        </div>
                      </div>
                    )}
                    {onboardingDone && (
                      <>
                        <p className="empty-state-desc">
                          {autoConnectOnLaunch ? '请点击右上角「启动」按钮开始 Claude Code 会话' : '自动连接已关闭，请手动启动 Claude Code'}
                        </p>
                        {!autoConnectOnLaunch && (
                          <p className="empty-state-desc" style={{ marginTop: 4, opacity: 0.76 }}>
                            可在设置的“会话”标签里重新开启自动连接
                          </p>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {messages.map((msg, idx) => (
          <span key={msg.id} style={{ display: 'contents' }}>
            {msg.role === 'assistant' && msg.planSteps && msg.planSteps.length > 0 && (
              <TurnCard planSteps={msg.planSteps} toolCallsCount={msg.toolCalls?.length ?? 0} />
            )}
            {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
              <ChangeSummaryCard toolCalls={msg.toolCalls} msgId={msg.id} />
            )}
            <MessageBubble
              msg={msg}
              searchQuery={searchQuery}
              isMatch={matchingMsgIds.has(msg.id)}
              isStreaming={isProcessing && idx === messages.length - 1 && msg.role === 'assistant'}
              thinkingOverride={allThinkingExpanded}
            />
          </span>
        ))}

        {isProcessing && (() => {
          // 获取最后一条 assistant 消息，用于显示实时 thinking 摘要
          const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
          const liveThinking = (lastAssistant as { thinking?: string } | undefined)?.thinking ?? '';
          const thinkingLine = liveThinking
            ? (liveThinking.split('\n').filter((l) => l.trim()).slice(-1)[0] ?? '')
            : '';
          return (
            <div className="typing-indicator">
              <div className="typing-dots">
                <span /><span /><span />
              </div>
              {thinkingLine ? (
                <span className="typing-thinking-preview" title={thinkingLine}>
                  {thinkingLine.length > 60 ? thinkingLine.slice(0, 60) + '…' : thinkingLine}
                </span>
              ) : (
                <span>Claude 正在生成</span>
              )}
              <button className="typing-stop-btn" onClick={handleStop} title="停止生成">
                <Square size={11} />
                停止
              </button>
            </div>
          );
        })()}

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
          {/* 继续上次会话按钮（只在无当前会话时显示） */}
          {!session.conversationSessionId && (
            <button
              onClick={() => setContinueMode((v) => !v)}
              title="继续上次 CLI 会话（--continue）"
              style={{
                marginLeft: 6,
                padding: '2px 8px',
                fontSize: 11,
                borderRadius: 4,
                border: `1px solid ${continueMode ? 'var(--accent-color)' : 'var(--border-color)'}`,
                background: continueMode ? 'var(--accent-color)' : 'transparent',
                color: continueMode ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {continueMode ? '✓ --continue 已启用' : '继续上次会话'}
            </button>
          )}
          {/* Context window 使用量指示器 */}
          {tokenUsage && tokenUsage.inputTokens > 0 && (() => {
            const CONTEXT_LIMIT = 200000;
            const pct = Math.min(100, Math.round(tokenUsage.inputTokens / CONTEXT_LIMIT * 100));
            const color = pct >= 90 ? 'var(--error-color, #f85149)' : pct >= 70 ? '#e3b341' : 'var(--accent-color)';
            return (
              <div className="context-usage-indicator" title={`Context 使用量：${tokenUsage.inputTokens.toLocaleString()} / ${CONTEXT_LIMIT.toLocaleString()} tokens`}>
                <div className="context-usage-bar" style={{ '--pct': `${pct}%`, '--bar-color': color } as React.CSSProperties} />
                <span className="context-usage-label" style={{ color }}>{pct}%</span>
              </div>
            );
          })()}
        </div>
        {/* 附件文件 chips + 粘贴图片 chips */}
        {(contextFiles.length > 0 || pastedImages.length > 0) && (
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
            {pastedImages.map((img) => (
              <div key={img.path} className="context-file-chip image-chip" title={img.name}>
                <img src={img.preview} alt={img.name} className="paste-img-thumb" />
                <span>{img.name}</span>
                <button onClick={() => setPastedImages((prev) => prev.filter((x) => x.path !== img.path))}>
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        {/* 命令审批横幅（真实 PermissionRequest hook 请求时显示于输入框上方） */}
        {pendingApproval && (
          <div className="approval-banner">
            <div className="approval-banner-cmd">
              <span style={{ color: '#7ee787', userSelect: 'none', marginRight: 6, fontSize: 13 }}>$</span>
              <code>
                {(pendingApproval.inputPreview || JSON.stringify(pendingApproval.toolInput)).slice(0, 120)}
              </code>
            </div>
            <div className="approval-banner-actions">
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>
                等待审批 · {pendingApproval.toolName}{permissionRequests.length > 1 ? ` +${permissionRequests.length - 1}` : ''}
              </span>
              <button
                className="btn-approve"
                disabled={permissionRespondingId === pendingApproval.id}
                onClick={() => handleApprovalAction(pendingApproval, true)}
              >✓ 允许</button>
              <button
                className="btn-deny"
                disabled={permissionRespondingId === pendingApproval.id}
                onClick={() => handleApprovalAction(pendingApproval, false)}
              >✗ 拒绝</button>
            </div>
          </div>
        )}
        {/* @ 文件提及下拉菜单 */}
        {atMenuOpen && atSuggestions.length > 0 && (
          <div className="at-menu">
            <div className="at-menu-header">
              📂 {(() => {
                const lastSlash = atQuery.lastIndexOf('/');
                const subDir = lastSlash >= 0 ? atQuery.slice(0, lastSlash) : '';
                const wd = session.workingDirectory?.split(/[\\/]/).pop() ?? '工作目录';
                return subDir ? `${wd}/${subDir}` : wd;
              })()}
            </div>
            {atSuggestions.map((entry, i) => (
              <button
                key={entry.name}
                className={`at-menu-item ${i === atMenuIndex ? 'active' : ''}`}
                onClick={() => handleAtSelect(entry)}
                onMouseEnter={() => setAtMenuIndex(i)}
              >
                <span className="at-menu-icon">{entry.type === 'directory' ? '📁' : '📄'}</span>
                <span className="at-menu-name">{entry.name}</span>
                {entry.type === 'directory' && <span className="at-menu-badge">目录</span>}
              </button>
            ))}
          </div>
        )}
        {/* Slash 命令补全菜单 */}
        {slashSuggestions.length > 0 && (
          <div className="slash-menu">
            {slashSuggestions.map((c, i) => (
              <button
                key={c.cmd}
                className={`slash-menu-item ${i === slashMenuIndex ? 'active' : ''}`}
                onClick={() => { setInput(c.cmd + ' '); setSlashMenuIndex(-1); textareaRef.current?.focus(); }}
                onMouseEnter={() => setSlashMenuIndex(i)}
              >
                <code className="slash-menu-cmd">{c.cmd}</code>
                <span className="slash-menu-desc">{c.desc}</span>
              </button>
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
            ref={textareaRef}
            className="chat-input"
            value={input}
            onChange={(e) => {
              const val = e.target.value;
              setInput(val);
              setSlashMenuIndex(-1);
              // 检测 @ 文件提及：光标前最后一个 @ 及其后的非空格字符
              const cursor = e.target.selectionStart ?? val.length;
              const textBefore = val.slice(0, cursor);
              const atMatch = textBefore.match(/@(\S*)$/);
              if (atMatch) {
                const newQuery = atMatch[1];
                setAtQuery(newQuery);
                if (!atMenuOpen) {
                  setAtMenuOpen(true);
                  setAtMenuIndex(0);
                }
              } else if (atMenuOpen) {
                setAtMenuOpen(false);
                setAtQuery('');
              }
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
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
        {/* 输入框快捷键提示 */}
        <div className="input-shortcuts-hint">
          <kbd>Enter</kbd>
          <span>发送</span>
          <span className="hint-sep">·</span>
          <kbd>Shift+Enter</kbd>
          <span>换行</span>
          <span className="hint-sep">·</span>
          <kbd>Ctrl+F</kbd>
          <span>搜索</span>
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

        {/* 底部工具栏：模型快切 + 搜索 + 导出 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 4 }}>
          {/* 模型快切 */}
          <select
            value={localModel}
            onChange={(e) => handleModelChange(e.target.value)}
            title="快速切换模型（立即保存）"
            style={{
              flex: 1,
              fontSize: 11,
              padding: '3px 6px',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              maxWidth: 200,
            }}
          >
            <option value="default">模型: 默认</option>
            <option value="sonnet">Sonnet</option>
            <option value="opus">Opus</option>
            <option value="haiku">Haiku</option>
            <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
            <option value="claude-opus-4-7">Claude Opus 4.7</option>
            <option value="ark-code-latest">Ark Code Latest</option>
          </select>
          <div className="chat-mode-select-wrap" title="切换 Claude Code 执行模式">
            <Shield size={12} />
            <select
              value={localPermissionMode}
              onChange={(e) => handlePermissionModeChange(e.target.value)}
              disabled={!!session.conversationSessionId || isProcessing}
              className="chat-mode-select"
            >
              {PERMISSION_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>模式: {option.label}</option>
              ))}
            </select>
          </div>
          {/* Agent 快切 */}
          {customAgentNames.length > 0 && (
            <select
              value={localAgent}
              onChange={(e) => setLocalAgent(e.target.value)}
              title="快速切换 Agent"
              disabled={!!session.conversationSessionId}
              style={{
                flex: 1,
                fontSize: 11,
                padding: '3px 6px',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                cursor: session.conversationSessionId ? 'not-allowed' : 'pointer',
                maxWidth: 160,
                opacity: session.conversationSessionId ? 0.5 : 1,
              }}
            >
              <option value="">Agent: 默认</option>
              {customAgentNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
          <div style={{ flex: 1 }} />
          {/* 消息搜索 */}
          <button
            className="btn"
            title="搜索消息 (Ctrl+F)"
            onClick={() => { setShowSearch(!showSearch); setTimeout(() => searchInputRef.current?.focus(), 50); }}
            style={{ padding: '3px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Search size={13} />
          </button>
          {/* 导出会话 */}
          <button
            className="btn"
            title="导出会话为 Markdown"
            onClick={handleExport}
            disabled={messages.length === 0 || exporting}
            style={{ padding: '3px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {exporting ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

/** 工具调用折叠卡片 — memo 防止父消息文本更新时未变工具卡片重渲 */
const ToolCallCard = memo(function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  // 文件修改类工具默认展开（Diff 直接可见，无需用户主动点击）
  const isFileModifyToolName = ['Write', 'write_file', 'Edit', 'edit_file', 'str_replace_editor', 'MultiEdit', 'multiedit', 'str_replace_based_edit_tool'].includes(toolCall.name);
  const [expanded, setExpanded] = useState(isFileModifyToolName);
  const [reviewBusy, setReviewBusy] = useState(false);
  const messages = useAppStore((s) => s.messages);
  const updateMessage = useAppStore((s) => s.updateMessage);

  const isBash = toolCall.name === 'Bash' || toolCall.name === 'bash';
  const bashCommand = isBash
    ? (toolCall.arguments?.command as string | undefined) ?? ''
    : '';

  const filePath = useMemo(() => {
    return String(toolCall.arguments?.file_path ?? toolCall.arguments?.path ?? toolCall.arguments?.filename ?? '');
  }, [toolCall.arguments]);

  const isFileModifyTool = useMemo(() => {
    return ['Write', 'write_file', 'Edit', 'edit_file', 'str_replace_editor', 'MultiEdit', 'multiedit', 'str_replace_based_edit_tool'].includes(toolCall.name);
  }, [toolCall.name]);

  const canReviewDiff = isFileModifyTool && toolCall.status === 'success' && !!filePath && toolCall.originalContent !== undefined;

  const isLatestFileChange = useMemo(() => {
    if (!canReviewDiff) return false;
    let latestId = '';
    for (const msg of messages) {
      for (const call of msg.toolCalls ?? []) {
        const callPath = String(call.arguments?.file_path ?? call.arguments?.path ?? call.arguments?.filename ?? '');
        const isFileTool = ['Write', 'write_file', 'Edit', 'edit_file', 'str_replace_editor', 'MultiEdit', 'multiedit', 'str_replace_based_edit_tool'].includes(call.name);
        if (isFileTool && call.status === 'success' && callPath === filePath) {
          latestId = call.id;
        }
      }
    }
    return latestId === toolCall.id;
  }, [canReviewDiff, filePath, messages, toolCall.id]);

  const patchToolCall = useCallback((updates: Partial<ToolCall>) => {
    for (let mi = messages.length - 1; mi >= 0; mi--) {
      const msg = messages[mi];
      const idx = msg.toolCalls?.findIndex((call) => call.id === toolCall.id) ?? -1;
      if (idx >= 0) {
        const nextToolCalls = msg.toolCalls!.map((call, i) => i === idx ? { ...call, ...updates } : call);
        updateMessage(msg.id, { toolCalls: nextToolCalls });
        return;
      }
    }
  }, [messages, toolCall.id, updateMessage]);

  const handleAcceptDiff = useCallback(() => {
    patchToolCall({ diffReviewStatus: 'accepted' });
  }, [patchToolCall]);

  const handleOpenInEditor = useCallback(() => {
    if (!filePath) return;
    void window.electronAPI.openInEditor(filePath);
  }, [filePath]);

  const handleRejectDiff = useCallback(async () => {
    if (!canReviewDiff || !isLatestFileChange || reviewBusy) return;
    setReviewBusy(true);
    try {
      const result = await window.electronAPI.writeFile(filePath, toolCall.originalContent ?? '');
      if (result.success) {
        patchToolCall({ diffReviewStatus: 'reverted' });
      }
    } finally {
      setReviewBusy(false);
    }
  }, [canReviewDiff, filePath, isLatestFileChange, patchToolCall, reviewBusy, toolCall.originalContent]);

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
  // 已移至 ChatPanel 输入框横幅，这里不再需要

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
            {/* 待审批状态提示（操作入口在输入框上方横幅） */}
            {toolCall.status === 'pending' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 0 8px 0', fontSize: 11, color: 'var(--text-muted)',
              }}>
                <span style={{ opacity: 0.6 }}>⏳</span>
                <span>命令已提交，等待 Claude 返回执行结果</span>
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
        {/* 文件路径摘要（Read/Edit/Write/LS 等有 path 参数时直接显示） */}
        {!!(toolCall.arguments?.file_path || toolCall.arguments?.path) && (
          <code style={{
            flex: 1, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', color: 'var(--text-muted)', marginLeft: 4, marginRight: 8,
          }}>
            {String(toolCall.arguments.file_path ?? toolCall.arguments.path)}
          </code>
        )}
        {/* Grep/Glob 的 pattern 摘要 */}
        {!!(toolCall.arguments?.pattern) && !toolCall.arguments?.file_path && !toolCall.arguments?.path && (
          <code style={{
            flex: 1, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', color: 'var(--text-muted)', marginLeft: 4, marginRight: 8,
          }}>
            {String(toolCall.arguments.pattern)}
          </code>
        )}
        <span className={`tool-call-status tool-call-status-${toolCall.status}`}>
          {toolCall.status === 'pending' ? '执行中…' : toolCall.status === 'success' ? '✓ 完成' : '✗ 失败'}
        </span>
        {/* 变更确认按钮：始终在头部可见，无需展开 */}
        {canReviewDiff && toolCall.diffReviewStatus !== 'accepted' && toolCall.diffReviewStatus !== 'reverted' && (
          <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
            <button
              className="btn"
              onClick={handleAcceptDiff}
              disabled={reviewBusy}
              style={{ fontSize: 10, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3, color: 'var(--success-text)' }}
            >
              <Check size={10} /> 接受
            </button>
            <button
              className="btn"
              onClick={() => void handleRejectDiff()}
              disabled={reviewBusy || !isLatestFileChange}
              title={isLatestFileChange ? '回滚到修改前' : '仅允许回滚最新一次修改'}
              style={{ fontSize: 10, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3 }}
            >
              <RotateCcw size={10} /> 拒绝
            </button>
          </div>
        )}
        {canReviewDiff && toolCall.diffReviewStatus === 'accepted' && (
          <span style={{ fontSize: 10, color: 'var(--success-text)', marginRight: 4 }}>✓ 已接受</span>
        )}
        {canReviewDiff && toolCall.diffReviewStatus === 'reverted' && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 4 }}>↩ 已回滚</span>
        )}
        {/* 编辑按钮：有文件路径且工具成功时可用，用系统默认编辑器打开文件 */}
        {!!filePath && !isBash && toolCall.status === 'success' && (
          <button
            className="btn"
            onClick={(e) => { e.stopPropagation(); handleOpenInEditor(); }}
            title={`用系统编辑器打开 ${filePath}`}
            style={{ fontSize: 10, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3, marginRight: 2 }}
          >
            <Pencil size={10} /> 编辑
          </button>
        )}
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </div>
      {expanded && (
        <div className="tool-call-body">
          {/* Edit 工具：行级 Diff 可视化 */}
          {toolCall.name === 'Edit' &&
           toolCall.arguments?.old_string !== undefined &&
           toolCall.arguments?.new_string !== undefined && (
            <div className="tool-call-section">
              <div className="tool-call-section-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <FileDiff size={11} /> 文件变更
              </div>
              <InlineDiff
                oldStr={String(toolCall.arguments.old_string)}
                newStr={String(toolCall.arguments.new_string)}
              />
            </div>
          )}
          {/* MultiEdit 工具：多段 Diff */}
          {toolCall.name === 'MultiEdit' && Array.isArray(toolCall.arguments?.edits) && (
            <div className="tool-call-section">
              <div className="tool-call-section-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <FileDiff size={11} /> 多段变更
              </div>
              {(toolCall.arguments.edits as Array<{ old_string: string; new_string: string }>).map((edit, idx) => (
                <div key={idx} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>变更 {idx + 1}</div>
                  <InlineDiff oldStr={edit.old_string ?? ''} newStr={edit.new_string ?? ''} />
                </div>
              ))}
            </div>
          )}
          {/* Write 工具：有原内容时展示 diff，否则展示新内容预览 */}
          {toolCall.name === 'Write' && toolCall.arguments?.content !== undefined && (
            <div className="tool-call-section">
              <div className="tool-call-section-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <FileDiff size={11} /> {toolCall.originalContent !== undefined ? '文件变更' : '写入内容'}
              </div>
              {toolCall.originalContent !== undefined
                ? <WriteDiff originalContent={toolCall.originalContent} newContent={String(toolCall.arguments.content)} />
                : <WritePreview content={String(toolCall.arguments.content)} />
              }
            </div>
          )}
          {canReviewDiff && (
            <div className="tool-call-section">
              <div className="tool-call-section-label">变更确认</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn"
                  onClick={handleAcceptDiff}
                  disabled={reviewBusy || toolCall.diffReviewStatus === 'accepted'}
                  style={{ fontSize: 11, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Check size={11} />
                  {toolCall.diffReviewStatus === 'accepted' ? '已接受' : '接受'}
                </button>
                <button
                  className="btn"
                  onClick={() => void handleRejectDiff()}
                  disabled={reviewBusy || !isLatestFileChange || toolCall.diffReviewStatus === 'reverted'}
                  style={{ fontSize: 11, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                  title={isLatestFileChange ? '将文件回滚到本次修改前的内容' : '仅允许回滚该文件最新一次修改，避免覆盖后续变更'}
                >
                  <RotateCcw size={11} />
                  {toolCall.diffReviewStatus === 'reverted' ? '已拒绝并回滚' : '拒绝'}
                </button>
                {reviewBusy && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>处理中…</span>
                )}
                {!isLatestFileChange && toolCall.diffReviewStatus !== 'reverted' && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>仅最新一次文件修改可直接回滚</span>
                )}
                <button
                  className="btn"
                  onClick={handleOpenInEditor}
                  style={{ fontSize: 11, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}
                  title="用系统默认编辑器打开文件进行手动编辑"
                >
                  <Pencil size={11} /> 编辑
                </button>
              </div>
            </div>
          )}
          {/* Read 工具结果：显示文件内容而非 JSON */}
          {toolCall.name === 'Read' && toolCall.result !== undefined && (
            <div className="tool-call-section">
              <div className="tool-call-section-label">文件内容</div>
              <pre className="tool-call-pre" style={{ maxHeight: 300 }}>
                {toolCall.result.length > 3000
                  ? toolCall.result.slice(0, 3000) + '\n…（已截断）'
                  : toolCall.result}
              </pre>
            </div>
          )}
          {/* 非 Read/Edit/Write/MultiEdit 的通用参数展示 */}
          {!['Edit', 'MultiEdit', 'Write', 'Read'].includes(toolCall.name) &&
           Object.keys(toolCall.arguments).length > 0 && (
            <div className="tool-call-section">
              <div className="tool-call-section-label">输入参数</div>
              <pre className="tool-call-pre">{JSON.stringify(toolCall.arguments, null, 2)}</pre>
            </div>
          )}
          {/* Read 不重复显示结果 */}
          {toolCall.name !== 'Read' && toolCall.result !== undefined && (
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
});

/** ChangeSummaryCard — 本轮变更总览卡片（Phase 3：统一变更确认）*/
const FILE_MODIFY_NAMES = ['Write', 'write_file', 'Edit', 'edit_file', 'str_replace_editor', 'MultiEdit', 'multiedit', 'str_replace_based_edit_tool'];

const ChangeSummaryCard = memo(function ChangeSummaryCard({ toolCalls, msgId }: { toolCalls: ToolCall[]; msgId: string }) {
  const messages = useAppStore((s) => s.messages);
  const updateMessage = useAppStore((s) => s.updateMessage);
  const [busy, setBusy] = useState(false);

  // 已成功且有 originalContent 的文件修改工具调用（可回滚）
  const reviewable = useMemo(() =>
    toolCalls.filter(c =>
      FILE_MODIFY_NAMES.includes(c.name) &&
      c.status === 'success' &&
      c.originalContent !== undefined,
    ), [toolCalls]);

  // Turn 完成前（仍有 pending）不展示
  const isComplete = toolCalls.every(c => c.status !== 'pending');
  if (!isComplete || reviewable.length === 0) return null;

  const allReviewed = reviewable.every(c => c.diffReviewStatus === 'accepted' || c.diffReviewStatus === 'reverted');

  // 用 computeLineDiff 统计每个文件的行增删
  const fileStats = useMemo(() => {
    const map = new Map<string, { added: number; removed: number }>();
    for (const c of reviewable) {
      const path = String(c.arguments?.file_path ?? c.arguments?.path ?? '');
      if (!path) continue;
      let added = 0, removed = 0;
      if ((c.name === 'Write' || c.name === 'write_file') && c.arguments?.content !== undefined) {
        const diff = computeLineDiff(c.originalContent ?? '', String(c.arguments.content));
        added += diff.filter(l => l.type === 'add').length;
        removed += diff.filter(l => l.type === 'del').length;
      } else if (['Edit', 'edit_file', 'str_replace_editor', 'str_replace_based_edit_tool'].includes(c.name) &&
                 c.arguments?.old_string !== undefined && c.arguments?.new_string !== undefined) {
        const diff = computeLineDiff(String(c.arguments.old_string), String(c.arguments.new_string));
        added += diff.filter(l => l.type === 'add').length;
        removed += diff.filter(l => l.type === 'del').length;
      } else if ((c.name === 'MultiEdit' || c.name === 'multiedit') && Array.isArray(c.arguments?.edits)) {
        for (const edit of c.arguments.edits as Array<{ old_string: string; new_string: string }>) {
          const diff = computeLineDiff(edit.old_string ?? '', edit.new_string ?? '');
          added += diff.filter(l => l.type === 'add').length;
          removed += diff.filter(l => l.type === 'del').length;
        }
      }
      const prev = map.get(path) ?? { added: 0, removed: 0 };
      map.set(path, { added: prev.added + added, removed: prev.removed + removed });
    }
    return map;
  }, [reviewable]);

  const totalAdded = useMemo(() => Array.from(fileStats.values()).reduce((s, v) => s + v.added, 0), [fileStats]);
  const totalRemoved = useMemo(() => Array.from(fileStats.values()).reduce((s, v) => s + v.removed, 0), [fileStats]);

  // 将所有 reviewable 工具调用标记为指定状态
  const patchAll = useCallback((status: 'accepted' | 'reverted') => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const reviewableIds = new Set(reviewable.map(r => r.id));
    const nextToolCalls = msg.toolCalls?.map(c =>
      reviewableIds.has(c.id) ? { ...c, diffReviewStatus: status } : c,
    ) ?? [];
    updateMessage(msgId, { toolCalls: nextToolCalls });
  }, [messages, msgId, reviewable, updateMessage]);

  const handleAcceptAll = useCallback(() => patchAll('accepted'), [patchAll]);

  const handleRevertAll = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      // 每个文件路径只用最早一次修改的 originalContent（保证回滚到本 Turn 开始前状态）
      const earliestByPath = new Map<string, ToolCall>();
      for (const c of reviewable) {
        const path = String(c.arguments?.file_path ?? c.arguments?.path ?? '');
        if (path && !earliestByPath.has(path)) earliestByPath.set(path, c);
      }
      await Promise.allSettled(
        Array.from(earliestByPath.values()).map(c =>
          window.electronAPI.writeFile(
            String(c.arguments?.file_path ?? c.arguments?.path ?? ''),
            c.originalContent ?? '',
          ),
        ),
      );
      patchAll('reverted');
    } finally {
      setBusy(false);
    }
  }, [busy, patchAll, reviewable]);

  return (
    <div style={{ margin: '2px 16px 6px 40px', border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
      {/* 卡片头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: fileStats.size > 0 ? '1px solid var(--border-color)' : 'none' }}>
        <FileDiff size={13} color="var(--accent-color)" />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          本轮变更 — {fileStats.size} 个文件
        </span>
        <span style={{ fontSize: 11, color: 'var(--success-text)', marginRight: 2 }}>+{totalAdded}</span>
        <span style={{ fontSize: 11, color: 'var(--error-text, #f85149)', marginRight: 8 }}>-{totalRemoved}</span>
        {allReviewed ? (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>已完成审阅</span>
        ) : (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className="btn"
              onClick={handleAcceptAll}
              disabled={busy}
              style={{ fontSize: 11, padding: '2px 10px', display: 'flex', alignItems: 'center', gap: 3, color: 'var(--success-text)' }}
            >
              <Check size={11} /> 全部接受
            </button>
            <button
              className="btn"
              onClick={() => void handleRevertAll()}
              disabled={busy}
              style={{ fontSize: 11, padding: '2px 10px', display: 'flex', alignItems: 'center', gap: 3 }}
              title="将所有文件回滚到本轮任务开始前的状态"
            >
              <RotateCcw size={11} /> 全部撤销
            </button>
          </div>
        )}
      </div>
      {/* 文件列表 */}
      <div style={{ padding: '6px 12px 8px' }}>
        {Array.from(fileStats.entries()).map(([path, stats]) => (
          <div key={path} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0', fontSize: 11 }}>
            <code style={{ flex: 1, fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</code>
            <span style={{ color: 'var(--success-text)', flexShrink: 0 }}>+{stats.added}</span>
            <span style={{ color: 'var(--error-text, #f85149)', flexShrink: 0 }}>-{stats.removed}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

/** TurnCard — 独立 Turn 执行步骤卡片（Phase 1：从消息气泡中抽离）*/
const TurnCard = memo(function TurnCard({ planSteps, toolCallsCount }: { planSteps: PlanStep[]; toolCallsCount: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const doneCount = planSteps.filter((s) => s.status === 'done').length;
  const errorCount = planSteps.filter((s) => s.status === 'error').length;
  const runningCount = planSteps.filter((s) => s.status === 'running').length;
  const totalCount = planSteps.length;
  const completedCount = doneCount + errorCount;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isComplete = runningCount === 0;
  const statusColor = !isComplete ? 'var(--accent-color)' : errorCount > 0 ? 'var(--error-text, #f85149)' : 'var(--success-text)';
  const progressColor = errorCount > 0 && isComplete ? 'var(--error-text, #f85149)' : isComplete ? 'var(--success-text)' : 'var(--accent-color)';
  const statusLabel = !isComplete ? '执行中' : errorCount > 0 ? `完成（含 ${errorCount} 错误）` : '已完成';

  return (
    <div style={{ margin: '2px 16px 2px 40px', border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
      {/* 头部：状态 + 进度计数 + 折叠按钮 */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: statusColor, letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'left' }}
      >
        {!isComplete
          ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
          : errorCount > 0
            ? <AlertCircle size={12} style={{ flexShrink: 0 }} />
            : <CheckCircle2 size={12} style={{ flexShrink: 0 }} />
        }
        <span style={{ flex: 1 }}>
          {statusLabel}
        </span>
        <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', letterSpacing: 0, textTransform: 'none', fontVariantNumeric: 'tabular-nums' }}>
          {completedCount}/{totalCount}{toolCallsCount > 0 ? ` · ${toolCallsCount} 工具` : ''}
        </span>
        {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>

      {/* 进度条 */}
      <div style={{ height: 2, background: 'var(--border-color)', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${progressPct}%`,
          background: progressColor,
          transition: 'width 0.3s ease, background 0.3s ease',
        }} />
      </div>

      {/* 步骤时间线列表 */}
      {!collapsed && (
        <div style={{ padding: '6px 12px 10px 12px' }}>
          {planSteps.map((step, idx) => {
            const isLast = idx === planSteps.length - 1;
            const nodeColor = step.status === 'done'
              ? 'var(--success-text)'
              : step.status === 'error'
                ? 'var(--error-text, #f85149)'
                : 'var(--accent-color)';
            return (
              <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                {/* 时间线：竖线 + 圆点 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 20 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: step.status === 'running' ? 'transparent' : nodeColor,
                    border: `2px solid ${nodeColor}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 3,
                  }}>
                    {step.status === 'running' && (
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: nodeColor, animation: 'turnNodePulse 1.2s ease-in-out infinite' }} />
                    )}
                  </div>
                  {!isLast && (
                    <div style={{ width: 2, flex: 1, minHeight: 10, background: 'var(--border-color)', marginTop: 2 }} />
                  )}
                </div>
                {/* 步骤内容 */}
                <div style={{
                  flex: 1, minWidth: 0, paddingLeft: 8, paddingBottom: isLast ? 0 : 8,
                  opacity: step.status === 'done' ? 0.65 : 1,
                  background: step.status === 'running' ? 'rgba(124,58,237,0.05)' : 'transparent',
                  borderRadius: 4, padding: '2px 8px 2px 8px', marginLeft: 0,
                  transition: 'opacity 0.2s',
                }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: step.status === 'running' ? 600 : 400, lineHeight: 1.5 }}>
                    {step.label}
                  </div>
                  {step.description && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, wordBreak: 'break-word', lineHeight: 1.4 }}>{step.description}</div>
                  )}
                </div>
              </div>
            );
          })}
          {/* 完成摘要标签 */}
          {isComplete && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8, paddingLeft: 20 }}>
              {([`${doneCount} 完成`, errorCount > 0 ? `${errorCount} 失败` : null, toolCallsCount > 0 ? `${toolCallsCount} 工具调用` : null] as (string | null)[]).filter(Boolean).map((m) => (
                <span key={m!} style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 999, background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>{m}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

/** 消息气泡 — memo 防止流式输出时历史消息无效重渲 */
const MessageBubble = memo(function MessageBubble({ msg, isMatch = false, isStreaming = false, thinkingOverride = null }: { msg: Message; searchQuery?: string; isMatch?: boolean; isStreaming?: boolean; thinkingOverride?: boolean | null }) {
  const [copied, setCopied] = useState(false);
  // isStreaming 期间自动展开 thinking；结束后恢复用户控制状态（默认折叠）
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  // 全局 override 优先；null 时使用各自内部状态
  const effectiveExpanded = thinkingOverride ?? thinkingExpanded;
  // 当 isStreaming 变为 false（完成），不自动折叠（保持用户最后展开状态）
  const streamingRef = useRef(isStreaming);
  useEffect(() => {
    if (isStreaming && !streamingRef.current) {
      // 刚开始 streaming → 展开
      setThinkingExpanded(true);
    }
    streamingRef.current = isStreaming;
  }, [isStreaming]);
  const contentRef = useRef<HTMLDivElement>(null);
  // thinking 内容自动滚动到底部
  const thinkingContentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isStreaming && thinkingContentRef.current) {
      thinkingContentRef.current.scrollTop = thinkingContentRef.current.scrollHeight;
    }
  }, [msg.thinking, isStreaming]);
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

  // 思考摘要：折叠时显示前两行非空内容
  const thinkingPreview = useMemo(() => {
    if (!msg.thinking) return '';
    const lines = msg.thinking.split('\n').filter((l) => l.trim());
    const preview = lines.slice(0, 2).join(' ');
    return preview.length > 140 ? preview.slice(0, 140) + '…' : preview;
  }, [msg.thinking]);

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
    <div
      className={`message-bubble ${isUser ? 'message-bubble-user' : ''}`}
      style={isMatch ? { outline: '2px solid var(--accent-color)', outlineOffset: 2, borderRadius: 6 } : undefined}
    >
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
          <div className={`thinking-block${isStreaming ? ' thinking-block-streaming' : ''}`}>
            <button
              className="thinking-toggle"
              onClick={() => setThinkingExpanded((v) => !v)}
            >
              <span className="thinking-icon">🤔</span>
              <span>{isStreaming ? '正在思考…' : '推理过程'}</span>
              <span style={{ marginLeft: 4, opacity: 0.45, fontSize: 10 }}>
                {msg.thinking.length} 字
              </span>
              <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: 10 }}>
                {effectiveExpanded ? '收起' : '展开'}
              </span>
              {effectiveExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {!effectiveExpanded && thinkingPreview && (
              <div className="thinking-preview">
                {thinkingPreview}
              </div>
            )}
            {effectiveExpanded && (
              <div
                ref={thinkingContentRef}
                className={`thinking-content${isStreaming ? ' thinking-content-streaming' : ''}`}
              >
                {msg.thinking}
                {isStreaming && <span className="thinking-cursor" />}
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
});
