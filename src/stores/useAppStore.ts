import { create } from 'zustand';
import type { Message, DirEntry, TerminalLine, SessionState, ConversationRecord, PlanStep, TokenRecord, Workspace, PlanReviewState, PendingDecisionRequest, PendingFileRequest, PendingQuickReply } from '../types';
import type { PermissionRequestEvent } from '../types/electron';

/** localStorage 键名 */
const HISTORY_KEY = 'claude-gui-conversation-history';
const TOKEN_HISTORY_KEY = 'claude-gui-token-history';
const TAB_PERSISTENCE_KEY = 'claude-gui-tab-persistence';
const WORKSPACES_KEY = 'claude-gui-workspaces';

/** 从 localStorage 读取工作区列表 */
function loadWorkspaces(): Workspace[] {
  try {
    return JSON.parse(localStorage.getItem(WORKSPACES_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** 保存工作区列表 */
function saveWorkspaces(list: Workspace[]): void {
  try { localStorage.setItem(WORKSPACES_KEY, JSON.stringify(list)); } catch { /* 忽略 */ }
}

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

/** 从 localStorage 读取 token 历史 */
function loadTokenHistory(): TokenRecord[] {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** 每个 Tab 的状态快照 */
interface TabSnapshot {
  messages: Message[];
  session: SessionState;
  tokenUsage: { inputTokens: number; outputTokens: number; costUsd?: number } | null;
  todoItems: { id: string; content: string; status: 'pending' | 'in_progress' | 'completed' }[];
  activePlanSteps: PlanStep[];
  planReview: PlanReviewState;
}

/** Tab 描述符 */
export interface ChatTab {
  id: string;
  label: string;
}

const DEFAULT_SESSION: SessionState = { isConnected: false, workingDirectory: '' };
const DEFAULT_PLAN_REVIEW: PlanReviewState = { phase: 'idle', rawPlanText: '', parsedSteps: [] };
const DEFAULT_SNAPSHOT: TabSnapshot = {
  messages: [],
  session: DEFAULT_SESSION,
  tokenUsage: null,
  todoItems: [],
  activePlanSteps: [],
  planReview: DEFAULT_PLAN_REVIEW,
};

/** 从 localStorage 读取上次关闭时的多标签状态 */
function loadTabPersistence(): { tabs: ChatTab[]; activeTabId: string; tabSnapshots: Record<string, TabSnapshot> } | null {
  try {
    const raw = localStorage.getItem(TAB_PERSISTENCE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

const _persisted = loadTabPersistence();
let tabCounter = 1;
// 恢复 tabCounter 为上次 tabs 中最大的序号，避免 id 重复
if (_persisted?.tabs) {
  const maxN = Math.max(0, ..._persisted.tabs.map((t) => parseInt(t.id.split('-')[1] ?? '0', 10)));
  if (maxN > 0) tabCounter = maxN;
}

interface AppState {
  // ─── 多标签 ───────────────────────────────────────────────
  tabs: ChatTab[];
  activeTabId: string;
  tabSnapshots: Record<string, TabSnapshot>;
  addTab: () => string;          // 创建新 tab，返回 tabId
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  renameTab: (tabId: string, label: string) => void;
  reorderTab: (fromIndex: number, toIndex: number) => void;

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

  // 调试：CLI 原始 JSON 输出
  rawJsonLog: string[];
  appendRawJson: (line: string) => void;
  clearRawJson: () => void;
  /** DEBT-201[v4.5.0] 保留最近 keepLast 条，超出部分丢弃，防止长会话内存增长 */
  trimRawJson: (keepLast: number) => void;

  // 对话历史（持久化到 localStorage）
  conversationHistory: ConversationRecord[];
  addOrUpdateConversation: (record: ConversationRecord) => void;
  removeConversation: (sessionId: string) => void;
  clearConversationHistory: () => void;

  // UI — Agent 中心导航（v3.0 重构）
  /** 一级导航区域：command / dispatch / agents / review / artifacts / capabilities / monitor / settings */
  activeNavSection: string;
  setActiveNavSection: (section: string) => void;
  /** 辅助面板内当前子标签（如 'files'、'git'、'settings'） */
  activeAuxSubPanel: string;
  setActiveAuxSubPanel: (sub: string) => void;
  /** 一次性跳转到 MonitorView 的指定 tab（消费后清空） */
  pendingMonitorTab: string | null;
  setPendingMonitorTab: (tab: string | null) => void;
  /** 一次性高亮定位到 HistoryPanel 中某条会话（消费后清空） */
  pendingHighlightSessionId: string | null;
  setPendingHighlightSessionId: (id: string | null) => void;
  /** 全局快速搜索信号：每次触发递增，HistoryPanel 监听后聚焦搜索框 */
  historySearchTrigger: number;
  triggerHistorySearch: () => void;
  // 兼容保留（部分组件仍引用 activePanel，逐步迁移）
  activePanel: 'chat' | 'files' | 'tools' | 'history' | 'skills' | 'tasks' | 'git' | 'changes' | 'mem' | 'claude-md' | 'checkpoints' | 'mcp' | 'agents' | 'plugins' | 'worktrees' | 'hooks' | 'rules' | 'cost';
  setActivePanel: (panel: 'chat' | 'files' | 'tools' | 'history' | 'skills' | 'tasks' | 'git' | 'changes' | 'mem' | 'claude-md' | 'checkpoints' | 'mcp' | 'agents' | 'plugins' | 'worktrees' | 'hooks' | 'rules' | 'cost') => void;
  sidebarVisible: boolean;
  setSidebarVisible: (visible: boolean) => void;
  // 主题
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  // 强调色
  accentColor: 'purple' | 'blue' | 'emerald' | 'orange' | 'pink' | 'cyan';
  setAccentColor: (color: 'purple' | 'blue' | 'emerald' | 'orange' | 'pink' | 'cyan') => void;
  // 字体大小
  fontSize: 'compact' | 'normal' | 'relaxed';
  setFontSize: (size: 'compact' | 'normal' | 'relaxed') => void;
  // 状态栏：当前模型与认证方式
  currentModel: string;
  currentAuthMode: string;
  setCurrentStatus: (model: string, authMode: string) => void;
  // Token 用量（每次会话结束后更新）
  tokenUsage: { inputTokens: number; outputTokens: number; costUsd?: number } | null;
  setTokenUsage: (usage: { inputTokens: number; outputTokens: number; costUsd?: number } | null) => void;
  // Token 历史（持久化，跨会话累积）
  tokenHistory: TokenRecord[];
  addTokenRecord: (record: TokenRecord) => void;
  clearTokenHistory: () => void;
  // 任务追踪（来自 TodoWrite 工具调用）
  todoItems: { id: string; content: string; status: 'pending' | 'in_progress' | 'completed' }[];
  setTodoItems: (items: { id: string; content: string; status: 'pending' | 'in_progress' | 'completed' }[]) => void;

  // 实时执行步骤（当前 turn 的工具调用进度，对标 Codex turn/plan/updated）
  activePlanSteps: PlanStep[];
  addPlanStep: (step: PlanStep) => void;
  updatePlanStep: (id: string, status: 'done' | 'error') => void;
  clearPlanSteps: () => void;

  /** Plan Mode 审查视图状态（3.4）*/
  planReview: PlanReviewState;
  setPlanReview: (state: Partial<PlanReviewState>) => void;
  resetPlanReview: () => void;

  /** 按 tabId 记录各 tab 的 isProcessing 状态，供 TabBar 显示旋转指示器 */
  processingTabs: Record<string, boolean>;
  setTabProcessing: (tabId: string, processing: boolean) => void;

  /** 跨 Tab 未读计数：当后台 Tab 的 Agent 完成任务时递增，切换到该 Tab 时清零 */
  tabUnreadCounts: Record<string, number>;
  markTabRead: (tabId: string) => void;

  /** 按 tabId 记录介入状态：blocked=🔴阻塞型(A/B/C) / warning=🟡非阻塞型(D) / null=无介入 */
  tabInterventionStatus: Record<string, 'blocked' | 'warning' | null>;
  setTabInterventionStatus: (tabId: string, status: 'blocked' | 'warning' | null) => void;

  /** 全局可见的决策型介入请求（按 tab 保存） */
  pendingDecisionRequests: Record<string, PendingDecisionRequest | null>;
  setPendingDecisionRequest: (tabId: string, request: PendingDecisionRequest | null) => void;

  /** 全局可见的文件请求型介入（按 tab 保存） */
  pendingFileRequests: Record<string, PendingFileRequest | null>;
  setPendingFileRequest: (tabId: string, request: PendingFileRequest | null) => void;

  /** 全局可见的权限审批请求（按 tab 保存，单一数据源） */
  permissionRequestsPerTab: Record<string, PermissionRequestEvent[]>;
  addPermissionRequest: (tabId: string, req: PermissionRequestEvent) => void;
  removePermissionRequest: (tabId: string, reqId: string) => void;
  clearPermissionRequestsForTab: (tabId: string) => void;

  /** DEBT-001[v4.3.0] 长时等待横幅状态（按 tab 保存，从 ChatPanel 本地 state 提升到 store） */
  longWaitBanners: Record<string, boolean>;
  setLongWaitBanner: (tabId: string, show: boolean) => void;

  /** 由全局介入中心下发到具体对话的快速回复动作 */
  pendingQuickReplies: Record<string, PendingQuickReply | null>;
  setPendingQuickReply: (tabId: string, reply: PendingQuickReply | null) => void;

  /** CommandCenter 置顶会话 */
  pinnedTabIds: string[];
  togglePinTab: (tabId: string) => void;

  /**
   * 对话 ↔ Diff 联动：当前高亮的工具调用 ID
   * ChatPanel 中点击文件变更徽章时设置，ChangeSummaryPanel 订阅并滚动到对应卡片
   */
  activeChangeId: string | null;
  setActiveChangeId: (id: string | null) => void;

  // 多项目工作区
  /** 已保存的工作区列表（持久化到 localStorage） */
  workspaces: Workspace[];
  /** 当前激活工作区路径（空字符串 = 显示全部会话） */
  activeWorkspacePath: string;
  addWorkspace: (path: string) => void;
  removeWorkspace: (id: string) => void;
  setActiveWorkspace: (path: string) => void;
  /** 切换工作区：保存当前 tabs 快照 → 恢复目标工作区的 tabs 快照 */
  switchWorkspace: (id: string) => void;
  /** 新建空白工作区并立即切换（不指定路径时默认为空） */
  createWorkspace: (name: string, path?: string) => string;
}

export const useAppStore = create<AppState>((set, get) => {
  // 恢复活跃 tab 的状态（如有持久化数据）
  const _activeSnap = _persisted ? (_persisted.tabSnapshots[_persisted.activeTabId] ?? DEFAULT_SNAPSHOT) : DEFAULT_SNAPSHOT;
  return {
  // ─── 多标签 ───────────────────────────────────────────────
  tabs: _persisted?.tabs ?? [{ id: 'tab-1', label: '会话 1' }],
  activeTabId: _persisted?.activeTabId ?? 'tab-1',
  tabSnapshots: _persisted?.tabSnapshots ?? {},

  addTab: () => {
    tabCounter++;
    const id = `tab-${tabCounter}`;
    const label = `会话 ${tabCounter}`;
    // 保存当前 tab 状态快照
    const state = get();
    const snapshot: TabSnapshot = {
      messages: state.messages,
      session: state.session,
      tokenUsage: state.tokenUsage,
      todoItems: state.todoItems,
      activePlanSteps: state.activePlanSteps,
      planReview: state.planReview,
    };
    set((s) => ({
      tabs: [...s.tabs, { id, label }],
      activeTabId: id,
      tabSnapshots: { ...s.tabSnapshots, [s.activeTabId]: snapshot },
      // 新 tab 从空白状态开始
      messages: [],
      session: DEFAULT_SESSION,
      tokenUsage: null,
      todoItems: [],
      activePlanSteps: [],
      planReview: DEFAULT_PLAN_REVIEW,
    }));
    return id;
  },

  closeTab: (tabId: string) => {
    const state = get();
    if (state.tabs.length <= 1) return; // 至少保留一个 tab
    const idx = state.tabs.findIndex((t) => t.id === tabId);
    const newTabs = state.tabs.filter((t) => t.id !== tabId);
    // 确定新 activeTabId
    let newActiveId: string;
    if (state.activeTabId === tabId) {
      // 切换到相邻 tab
      newActiveId = newTabs[Math.max(0, idx - 1)].id;
      const snapshot = state.tabSnapshots[newActiveId] ?? DEFAULT_SNAPSHOT;
      const restSnapshots = { ...state.tabSnapshots };
      delete restSnapshots[tabId];
      // FIX[BUG-001][v4.3.0] 关闭 Tab 时同步清理介入孤儿状态，
      // 防止介入中心显示已关闭 Tab 的决策/文件/权限/快速回复请求。
      const restDecisions = { ...state.pendingDecisionRequests };
      const restFileReqs = { ...state.pendingFileRequests };
      const restQuickReplies = { ...state.pendingQuickReplies };
      const restPermissions = { ...state.permissionRequestsPerTab };
      const restLongWait1 = { ...state.longWaitBanners };
      delete restDecisions[tabId];
      delete restFileReqs[tabId];
      delete restQuickReplies[tabId];
      delete restPermissions[tabId];
      delete restLongWait1[tabId];
      set({
        tabs: newTabs,
        activeTabId: newActiveId,
        tabSnapshots: restSnapshots,
        messages: snapshot.messages,
        session: snapshot.session,
        tokenUsage: snapshot.tokenUsage,
        todoItems: snapshot.todoItems,
        activePlanSteps: snapshot.activePlanSteps,
        planReview: snapshot.planReview ?? DEFAULT_PLAN_REVIEW,
        pendingDecisionRequests: restDecisions,
        pendingFileRequests: restFileReqs,
        pendingQuickReplies: restQuickReplies,
        permissionRequestsPerTab: restPermissions,
        longWaitBanners: restLongWait1,
      });
    } else {
      const restSnapshots = { ...state.tabSnapshots };
      delete restSnapshots[tabId];
      // FIX[BUG-001][v4.3.0] 非活跃 Tab 关闭时同样清理孤儿介入状态。
      const restDecisions = { ...state.pendingDecisionRequests };
      const restFileReqs = { ...state.pendingFileRequests };
      const restQuickReplies = { ...state.pendingQuickReplies };
      const restPermissions = { ...state.permissionRequestsPerTab };
      const restLongWait2 = { ...state.longWaitBanners };
      delete restDecisions[tabId];
      delete restFileReqs[tabId];
      delete restQuickReplies[tabId];
      delete restPermissions[tabId];
      delete restLongWait2[tabId];
      set({
        tabs: newTabs,
        tabSnapshots: restSnapshots,
        pendingDecisionRequests: restDecisions,
        pendingFileRequests: restFileReqs,
        pendingQuickReplies: restQuickReplies,
        permissionRequestsPerTab: restPermissions,
        longWaitBanners: restLongWait2,
      });
    }
  },

  setActiveTab: (tabId: string) => {
    const state = get();
    if (state.activeTabId === tabId) return;
    // FIX[BUG-005][v4.3.0] setActiveTab 时自动 markTabRead，
    // 确保通过介入中心/通知跳转时目标 Tab 的未读计数同步清零，不依赖 UI 点击事件。
    // 保存当前 tab 快照
    const snapshot: TabSnapshot = {
      messages: state.messages,
      session: state.session,
      tokenUsage: state.tokenUsage,
      todoItems: state.todoItems,
      activePlanSteps: state.activePlanSteps,
      planReview: state.planReview,
    };
    const targetSnapshot = state.tabSnapshots[tabId] ?? DEFAULT_SNAPSHOT;
    set({
      activeTabId: tabId,
      tabSnapshots: { ...state.tabSnapshots, [state.activeTabId]: snapshot },
      messages: targetSnapshot.messages,
      session: targetSnapshot.session,
      tokenUsage: targetSnapshot.tokenUsage,
      todoItems: targetSnapshot.todoItems,
      activePlanSteps: targetSnapshot.activePlanSteps,
      planReview: targetSnapshot.planReview ?? DEFAULT_PLAN_REVIEW,
      // FIX[BUG-005][v4.3.0] 切换到目标 Tab 时自动清零未读计数。
      tabUnreadCounts: { ...state.tabUnreadCounts, [tabId]: 0 },
    });
  },

  renameTab: (tabId: string, label: string) => {
    set((s) => ({ tabs: s.tabs.map((t) => t.id === tabId ? { ...t, label } : t) }));
  },

  reorderTab: (fromIndex: number, toIndex: number) => {
    set((s) => {
      if (fromIndex === toIndex) return {};
      const tabs = [...s.tabs];
      const [moved] = tabs.splice(fromIndex, 1);
      tabs.splice(toIndex, 0, moved);
      return { tabs };
    });
  },

  session: { ..._activeSnap.session, isConnected: false }, // 恢复工作目录，但连接状态重置
  setSession: (session) => set((state) => ({ session: { ...state.session, ...session } })),

  messages: _activeSnap.messages,
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

  rawJsonLog: [],
  appendRawJson: (line) => set((state) => ({
    rawJsonLog: [...state.rawJsonLog, line].slice(-1000),
  })),
  clearRawJson: () => set({ rawJsonLog: [] }),
  // DEBT-201[v4.5.0] 保留最后 keepLast 条，message-done 后自动调用以限制内存
  trimRawJson: (keepLast) => set((state) => ({
    rawJsonLog: state.rawJsonLog.slice(-keepLast),
  })),

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

  // Phase 1 新导航状态
  activeNavSection: 'command',
  setActiveNavSection: (section) => set({ activeNavSection: section }),
  activeAuxSubPanel: '',
  setActiveAuxSubPanel: (sub) => set({ activeAuxSubPanel: sub }),
  pendingMonitorTab: null,
  setPendingMonitorTab: (tab) => set({ pendingMonitorTab: tab }),
  pendingHighlightSessionId: null,
  setPendingHighlightSessionId: (id) => set({ pendingHighlightSessionId: id }),
  historySearchTrigger: 0,
  triggerHistorySearch: () => set((s) => ({ historySearchTrigger: s.historySearchTrigger + 1 })),
  // 兼容保留
  activePanel: 'chat',
  setActivePanel: (panel) => set({ activePanel: panel }),
  sidebarVisible: true,
  setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
  theme: (localStorage.getItem('claude-gui-theme') as 'dark' | 'light') ?? 'dark',
  setTheme: (theme) => {
    localStorage.setItem('claude-gui-theme', theme);
    set({ theme });
  },
  accentColor: (localStorage.getItem('claude-gui-accent') as AppState['accentColor']) ?? 'purple',
  setAccentColor: (color) => {
    localStorage.setItem('claude-gui-accent', color);
    set({ accentColor: color });
  },
  fontSize: (localStorage.getItem('claude-gui-fontsize') as AppState['fontSize']) ?? 'normal',
  setFontSize: (size) => {
    localStorage.setItem('claude-gui-fontsize', size);
    set({ fontSize: size });
  },
  currentModel: '',
  currentAuthMode: '',
  setCurrentStatus: (model, authMode) => set({ currentModel: model, currentAuthMode: authMode }),
  tokenUsage: null,
  setTokenUsage: (usage) => set({ tokenUsage: usage }),
  tokenHistory: loadTokenHistory(),
  addTokenRecord: (record) => set((state) => {
    const next = [record, ...state.tokenHistory].slice(0, 500);
    try { localStorage.setItem(TOKEN_HISTORY_KEY, JSON.stringify(next)); } catch { /* 忽略 */ }
    return { tokenHistory: next };
  }),
  clearTokenHistory: () => {
    try { localStorage.removeItem(TOKEN_HISTORY_KEY); } catch { /* 忽略 */ }
    set({ tokenHistory: [] });
  },
  todoItems: _activeSnap.todoItems,
  setTodoItems: (items) => set({ todoItems: items }),

  activePlanSteps: _activeSnap.activePlanSteps,
  addPlanStep: (step) => set((state) => ({ activePlanSteps: [...state.activePlanSteps, step] })),
  updatePlanStep: (id, status) => set((state) => ({
    activePlanSteps: state.activePlanSteps.map((s) => s.id === id ? { ...s, status } : s),
  })),
  clearPlanSteps: () => set({ activePlanSteps: [] }),

  // Plan Mode 审查视图（3.4）
  planReview: _activeSnap.planReview ?? DEFAULT_PLAN_REVIEW,
  setPlanReview: (partial) => set((state) => ({ planReview: { ...state.planReview, ...partial } })),
  resetPlanReview: () => set({ planReview: DEFAULT_PLAN_REVIEW }),

  processingTabs: {},
  setTabProcessing: (tabId, processing) => set((state) => {
    // 后台 Tab 完成任务时，自动添加未读标记
    const unreadUpdate: Record<string, number> = {};
    if (!processing && tabId !== state.activeTabId) {
      unreadUpdate[tabId] = (state.tabUnreadCounts[tabId] ?? 0) + 1;
    }
    return {
      processingTabs: { ...state.processingTabs, [tabId]: processing },
      tabUnreadCounts: Object.keys(unreadUpdate).length > 0
        ? { ...state.tabUnreadCounts, ...unreadUpdate }
        : state.tabUnreadCounts,
    };
  }),

  tabUnreadCounts: {},
  markTabRead: (tabId) => set((state) => ({
    tabUnreadCounts: { ...state.tabUnreadCounts, [tabId]: 0 },
  })),

  tabInterventionStatus: {},
  setTabInterventionStatus: (tabId, status) => set((state) => ({
    tabInterventionStatus: { ...state.tabInterventionStatus, [tabId]: status },
  })),

  pendingDecisionRequests: {},
  setPendingDecisionRequest: (tabId, request) => set((state) => ({
    pendingDecisionRequests: { ...state.pendingDecisionRequests, [tabId]: request },
  })),

  pendingFileRequests: {},
  setPendingFileRequest: (tabId, request) => set((state) => ({
    pendingFileRequests: { ...state.pendingFileRequests, [tabId]: request },
  })),

  // FIX[BUG-002][v4.3.0] 权限审批请求集中到 store，按 tabId 隔离存储，单一数据源。
  permissionRequestsPerTab: {},
  addPermissionRequest: (tabId, req) => set((state) => {
    const existing = state.permissionRequestsPerTab[tabId] ?? [];
    if (existing.some((r) => r.id === req.id)) return {}; // 去重
    return { permissionRequestsPerTab: { ...state.permissionRequestsPerTab, [tabId]: [...existing, req] } };
  }),
  removePermissionRequest: (tabId, reqId) => set((state) => ({
    permissionRequestsPerTab: {
      ...state.permissionRequestsPerTab,
      [tabId]: (state.permissionRequestsPerTab[tabId] ?? []).filter((r) => r.id !== reqId),
    },
  })),
  clearPermissionRequestsForTab: (tabId) => set((state) => ({
    permissionRequestsPerTab: { ...state.permissionRequestsPerTab, [tabId]: [] },
  })),

  // DEBT-001[v4.3.0] longWaitBanners 提升到 store，消除 ChatPanel 本地 state 对 tabInterventionStatus 计算的干扰。
  longWaitBanners: {},
  setLongWaitBanner: (tabId, show) => set((state) => ({
    longWaitBanners: { ...state.longWaitBanners, [tabId]: show },
  })),

  pendingQuickReplies: {},
  setPendingQuickReply: (tabId, reply) => set((state) => ({
    pendingQuickReplies: { ...state.pendingQuickReplies, [tabId]: reply },
  })),

  pinnedTabIds: [],
  togglePinTab: (tabId) => set((state) => ({
    pinnedTabIds: state.pinnedTabIds.includes(tabId)
      ? state.pinnedTabIds.filter((id) => id !== tabId)
      : [...state.pinnedTabIds, tabId],
  })),

  // 对话 ↔ Diff 联动
  activeChangeId: null,
  setActiveChangeId: (id) => set({ activeChangeId: id }),

  // 多项目工作区
  workspaces: loadWorkspaces(),
  activeWorkspacePath: '',
  addWorkspace: (path) => set((state) => {
    // 去重：路径相同则跳过
    if (state.workspaces.some((w) => w.path === path)) {
      return { activeWorkspacePath: path };
    }
    const name = path.replace(/\\/g, '/').replace(/\/$/, '').split('/').pop() ?? path;
    const ws: Workspace = { id: `ws-${Date.now()}`, name, path, addedAt: Date.now() };
    const next = [ws, ...state.workspaces];
    saveWorkspaces(next);
    return { workspaces: next, activeWorkspacePath: path };
  }),
  removeWorkspace: (id) => set((state) => {
    const next = state.workspaces.filter((w) => w.id !== id);
    saveWorkspaces(next);
    const removed = state.workspaces.find((w) => w.id === id);
    const activePath = removed?.path === state.activeWorkspacePath ? '' : state.activeWorkspacePath;
    return { workspaces: next, activeWorkspacePath: activePath };
  }),
  setActiveWorkspace: (path) => set({ activeWorkspacePath: path }),

  switchWorkspace: (targetId) => {
    const state = get();
    const target = state.workspaces.find((w) => w.id === targetId);
    if (!target) return;
    if (target.path === state.activeWorkspacePath) return;

    // 1. 把当前活跃 tab 的实时状态写入快照（不触发 re-render）
    const currentActiveSnap = {
      messages: state.messages,
      session: state.session,
      tokenUsage: state.tokenUsage,
      todoItems: state.todoItems,
      activePlanSteps: state.activePlanSteps,
      planReview: state.planReview,
    };
    const currentTabSnapshots = { ...state.tabSnapshots, [state.activeTabId]: currentActiveSnap };

    // 2. 更新当前工作区的 tabsSnapshot（同步回写 workingDirectory 到 path）
    const currentCwd = state.session.workingDirectory || '';
    const updatedWorkspaces = state.workspaces.map((w) =>
      w.path === state.activeWorkspacePath
        ? { ...w, lastUsed: Date.now(), path: currentCwd || w.path, tabsSnapshot: { tabs: state.tabs, activeTabId: state.activeTabId, tabSnapshots: currentTabSnapshots } }
        : w
    );
    saveWorkspaces(updatedWorkspaces);

    // 3. 恢复目标工作区状态（若无快照则新建空白状态）
    const targetSnap = target.tabsSnapshot;
    let newTabs, newActiveTabId, newTabSnapshots, newMessages, newSession, newTokenUsage, newTodoItems, newActivePlanSteps, newPlanReview;

    if (targetSnap && targetSnap.tabs.length > 0) {
      newTabs = targetSnap.tabs;
      newActiveTabId = targetSnap.activeTabId;
      newTabSnapshots = targetSnap.tabSnapshots;
      const activeSnap = targetSnap.tabSnapshots[targetSnap.activeTabId] ?? DEFAULT_SNAPSHOT;
      newMessages = activeSnap.messages ?? [];
      // 如果快照里的 workingDirectory 为空，用工作区 path 补充
      const snapCwd = activeSnap.session?.workingDirectory || target.path || '';
      newSession = { ...activeSnap.session, isConnected: false, workingDirectory: snapCwd };
      newTokenUsage = activeSnap.tokenUsage ?? null;
      newTodoItems = activeSnap.todoItems ?? [];
      newActivePlanSteps = activeSnap.activePlanSteps ?? [];
      newPlanReview = activeSnap.planReview ?? DEFAULT_PLAN_REVIEW;
    } else {
      // 全新工作区
      tabCounter++;
      const newTabId = `tab-${tabCounter}`;
      newTabs = [{ id: newTabId, label: '会话 1' }];
      newActiveTabId = newTabId;
      newTabSnapshots = {};
      newMessages = [];
      newSession = { isConnected: false, workingDirectory: target.path };
      newTokenUsage = null;
      newTodoItems = [];
      newActivePlanSteps = [];
      newPlanReview = DEFAULT_PLAN_REVIEW;
    }

    set({
      workspaces: updatedWorkspaces,
      activeWorkspacePath: target.path,
      tabs: newTabs,
      activeTabId: newActiveTabId,
      tabSnapshots: newTabSnapshots,
      messages: newMessages,
      session: newSession,
      tokenUsage: newTokenUsage,
      todoItems: newTodoItems,
      activePlanSteps: newActivePlanSteps,
      planReview: newPlanReview,
      // 重置处理中状态（防止跨工作区状态污染）
      processingTabs: {},
      tabInterventionStatus: {},
      tabUnreadCounts: {},
      // FIX[BUG-001][v4.3.0] 工作区切换时清理介入孤儿状态，防止跨工作区残留。
      pendingDecisionRequests: {},
      pendingFileRequests: {},
      pendingQuickReplies: {},
      permissionRequestsPerTab: {},
      longWaitBanners: {},
      // TODO[BUG-006][v4.3.0] App.tsx 的 questionRequests 是 React 本地 state，
      // switchWorkspace 无法触发其重置，已通过 activeWorkspacePath useEffect 修复（BUG-006）。
    });
  },

  createWorkspace: (name, path = '') => {
    const id = `ws-${Date.now()}`;
    const ws: Workspace = { id, name, path, addedAt: Date.now(), lastUsed: Date.now() };
    set((state) => {
      const next = [ws, ...state.workspaces];
      saveWorkspaces(next);
      return { workspaces: next };
    });
    // 创建后立即切换
    get().switchWorkspace(id);
    return id;
  },
}; // return 结束
}); // create 结束

/** 将当前所有 tab 状态持久化到 localStorage（应在 beforeunload 时调用） */
export function persistTabState(): void {
  try {
    const s = useAppStore.getState();
    // 将当前活跃 tab 状态写入快照（setActiveTab 只在切换时保存，当前 tab 未保存）
    const activeSnap: TabSnapshot = {
      messages: s.messages.slice(-50),
      session: s.session,
      tokenUsage: s.tokenUsage,
      todoItems: s.todoItems,
      activePlanSteps: s.activePlanSteps,
      planReview: s.planReview,
    };
    const snapshots: Record<string, TabSnapshot> = {};
    for (const [k, v] of Object.entries(s.tabSnapshots)) {
      snapshots[k] = { ...v, messages: v.messages.slice(-50) };
    }
    snapshots[s.activeTabId] = activeSnap;
    const data = { tabs: s.tabs, activeTabId: s.activeTabId, tabSnapshots: snapshots };
    localStorage.setItem(TAB_PERSISTENCE_KEY, JSON.stringify(data));
  } catch { /* 忽略存储失败 */ }
}

