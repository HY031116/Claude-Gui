import { create } from 'zustand';
import type { Message, DirEntry, TerminalLine, SessionState, CliPrompt, ConversationRecord, PlanStep } from '../types';

/** localStorage 键名 */
const HISTORY_KEY = 'claude-gui-conversation-history';

/** 从 localStorage 读取历史（最多 50 条） */
function loadHistory(): ConversationRecord[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** 写入 localStorage */
function saveHistory(history: ConversationRecord[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
  } catch { /* 忽略存储失败 */ }
}

interface AppState {
  // Session
  session: SessionState;
  setSession: (session: Partial<SessionState>) => void;

  // Messages
  messages: Message[];
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;
  /** 批量设置消息列表（加载历史会话时使用） */
  setMessages: (messages: Message[]) => void;
  /** 每次需要立即滚到底部时自增（供 ChatPanel 监听） */
  scrollBottomSeq: number;

  // File Explorer
  currentPath: string;
  entries: DirEntry[];
  selectedFile: string | null;
  fileContent: string | null;
  setCurrentPath: (path: string) => void;
  setEntries: (entries: DirEntry[]) => void;
  setSelectedFile: (path: string | null) => void;
  setFileContent: (content: string | null) => void;

  // Terminal
  terminalLines: TerminalLine[];
  addTerminalLine: (line: TerminalLine) => void;
  /** 批量写入终端行（RAF 缓冲用），减少每行一次 setState */
  addTerminalLines: (lines: TerminalLine[]) => void;
  clearTerminal: () => void;

  // CLI Interactive Prompts
  pendingPrompt: CliPrompt | null;
  setPendingPrompt: (prompt: CliPrompt | null) => void;

  // 对话历史（持久化到 localStorage）
  conversationHistory: ConversationRecord[];
  addOrUpdateConversation: (record: ConversationRecord) => void;
  removeConversation: (sessionId: string) => void;
  clearConversationHistory: () => void;

  // UI
  activePanel: 'chat' | 'files' | 'tools' | 'history' | 'skills' | 'tasks' | 'git' | 'changes' | 'mem';
  setActivePanel: (panel: 'chat' | 'files' | 'tools' | 'history' | 'skills' | 'tasks' | 'git' | 'changes' | 'mem') => void;
  sidebarVisible: boolean;
  setSidebarVisible: (visible: boolean) => void;
  // 主题
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  // 状态栏：当前模型与认证方式
  currentModel: string;
  currentAuthMode: string;
  setCurrentStatus: (model: string, authMode: string) => void;
  // Token 用量（每次会话结束后更新）
  tokenUsage: { inputTokens: number; outputTokens: number } | null;
  setTokenUsage: (usage: { inputTokens: number; outputTokens: number } | null) => void;
  // 任务追踪（来自 TodoWrite 工具调用）
  todoItems: { id: string; content: string; status: 'pending' | 'in_progress' | 'completed' }[];
  setTodoItems: (items: { id: string; content: string; status: 'pending' | 'in_progress' | 'completed' }[]) => void;

  // 实时执行步骤（当前 turn 的工具调用进度，对标 Codex turn/plan/updated）
  activePlanSteps: PlanStep[];
  addPlanStep: (step: PlanStep) => void;
  updatePlanStep: (id: string, status: 'done' | 'error') => void;
  clearPlanSteps: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  session: {
    isConnected: false,
    workingDirectory: '',
  },
  setSession: (session) => set((state) => ({ session: { ...state.session, ...session } })),

  messages: [],
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, updates) => set((state) => ({
    messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
  })),
  clearMessages: () => set({ messages: [] }),
  setMessages: (messages) => set((state) => ({ messages, scrollBottomSeq: state.scrollBottomSeq + 1 })),

  scrollBottomSeq: 0,

  currentPath: '',
  entries: [],
  selectedFile: null,
  fileContent: null,
  setCurrentPath: (path) => set({ currentPath: path }),
  setEntries: (entries) => set({ entries }),
  setSelectedFile: (path) => set({ selectedFile: path }),
  setFileContent: (content) => set({ fileContent: content }),

  terminalLines: [],
  addTerminalLine: (line) => set((state) => ({
    terminalLines: [...state.terminalLines.slice(-500), line],
  })),
  addTerminalLines: (lines) => set((state) => ({
    terminalLines: [...state.terminalLines, ...lines].slice(-500),
  })),
  clearTerminal: () => set({ terminalLines: [] }),

  pendingPrompt: null,
  setPendingPrompt: (prompt) => set({ pendingPrompt: prompt }),

  conversationHistory: loadHistory(),
  addOrUpdateConversation: (record) => set((state) => {
    const existing = state.conversationHistory.find((r) => r.sessionId === record.sessionId);
    let newHistory: ConversationRecord[];
    if (existing) {
      // 更新 lastMessageAt，保留原有 preview 和 startedAt
      newHistory = state.conversationHistory.map((r) =>
        r.sessionId === record.sessionId
          ? { ...r, lastMessageAt: record.lastMessageAt }
          : r,
      );
      // 把更新的记录移到顶部
      const idx = newHistory.findIndex((r) => r.sessionId === record.sessionId);
      if (idx > 0) {
        const [item] = newHistory.splice(idx, 1);
        newHistory.unshift(item);
      }
    } else {
      newHistory = [record, ...state.conversationHistory];
    }
    newHistory = newHistory.slice(0, 50);
    saveHistory(newHistory);
    return { conversationHistory: newHistory };
  }),
  clearConversationHistory: () => {
    saveHistory([]);
    set({ conversationHistory: [] });
  },
  removeConversation: (sessionId) => set((state) => {
    const newHistory = state.conversationHistory.filter((r) => r.sessionId !== sessionId);
    saveHistory(newHistory);
    return { conversationHistory: newHistory };
  }),

  activePanel: 'chat',
  setActivePanel: (panel) => set({ activePanel: panel }),
  sidebarVisible: true,
  setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
  theme: (localStorage.getItem('claude-gui-theme') as 'dark' | 'light') ?? 'dark',
  setTheme: (theme) => {
    localStorage.setItem('claude-gui-theme', theme);
    set({ theme });
  },
  currentModel: '',
  currentAuthMode: '',
  setCurrentStatus: (model, authMode) => set({ currentModel: model, currentAuthMode: authMode }),
  tokenUsage: null,
  setTokenUsage: (usage) => set({ tokenUsage: usage }),
  todoItems: [],
  setTodoItems: (items) => set({ todoItems: items }),

  activePlanSteps: [],
  addPlanStep: (step) => set((state) => ({ activePlanSteps: [...state.activePlanSteps, step] })),
  updatePlanStep: (id, status) => set((state) => ({
    activePlanSteps: state.activePlanSteps.map((s) => s.id === id ? { ...s, status } : s),
  })),
  clearPlanSteps: () => set({ activePlanSteps: [] }),
}));
