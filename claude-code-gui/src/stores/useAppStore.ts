import { create } from 'zustand';
import type { Message, DirEntry, TerminalLine, SessionState, CliPrompt, ConversationRecord } from '../types';

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
  activePanel: 'chat' | 'files' | 'tools' | 'history';
  setActivePanel: (panel: 'chat' | 'files' | 'tools' | 'history') => void;
  sidebarVisible: boolean;
  setSidebarVisible: (visible: boolean) => void;
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
}));
