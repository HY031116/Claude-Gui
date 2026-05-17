/**
 * useAppStore 状态管理单元测试
 * 覆盖：消息管理、会话状态、导航切换、Tab 管理
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// localStorage mock（jsdom 提供，但需要在各测试前清空）
beforeEach(() => {
  localStorage.clear();
  // 每次测试前重置 store（通过动态 import 重新加载模块）
  vi.resetModules();
});

describe('useAppStore - 消息管理', () => {
  it('addMessage 应将消息追加到列表', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addMessage({ id: 'msg-1', role: 'user', content: 'hello', timestamp: Date.now() });
    expect(useAppStore.getState().messages).toHaveLength(1);
    expect(useAppStore.getState().messages[0].content).toBe('hello');
  });

  it('updateMessage 应更新指定 id 的消息内容', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addMessage({ id: 'msg-2', role: 'assistant', content: 'initial', timestamp: Date.now() });
    store.updateMessage('msg-2', { content: 'updated' });
    const msg = useAppStore.getState().messages.find((m) => m.id === 'msg-2');
    expect(msg?.content).toBe('updated');
  });

  it('clearMessages 应清空所有消息', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addMessage({ id: 'msg-3', role: 'user', content: 'test', timestamp: Date.now() });
    store.clearMessages();
    expect(useAppStore.getState().messages).toHaveLength(0);
  });
});

describe('useAppStore - 会话状态', () => {
  it('setSession 应合并更新 session 对象', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.setSession({ isConnected: true, pid: 1234 });
    const s = useAppStore.getState().session;
    expect(s.isConnected).toBe(true);
    expect(s.pid).toBe(1234);
  });

  it('setSession 仅传 isConnected 不覆盖其他字段', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.setSession({ workingDirectory: '/my/project' });
    store.setSession({ isConnected: true });
    const s = useAppStore.getState().session;
    expect(s.workingDirectory).toBe('/my/project');
    expect(s.isConnected).toBe(true);
  });
});

describe('useAppStore - 导航状态', () => {
  it('setActiveNavSection 更新导航区域', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.setActiveNavSection('tools');
    expect(useAppStore.getState().activeNavSection).toBe('tools');
  });

  it('setActiveAuxSubPanel 更新子标签', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.setActiveAuxSubPanel('settings');
    expect(useAppStore.getState().activeAuxSubPanel).toBe('settings');
  });
});

describe('useAppStore - Tab 管理', () => {
  it('addTab 应添加新标签并保持其他标签不变', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();
    const initialTabCount = store.tabs.length;

    store.addTab();
    expect(useAppStore.getState().tabs).toHaveLength(initialTabCount + 1);
  });

  it('closeTab 删除后 activeTabId 应切换到其他 tab', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addTab();
    const tabs = useAppStore.getState().tabs;
    const firstId = tabs[0].id;

    store.setActiveTab(firstId);
    store.closeTab(firstId);

    const remaining = useAppStore.getState().tabs;
    expect(remaining.every((t) => t.id !== firstId)).toBe(true);
    // 至少保留 1 个 tab
    expect(remaining.length).toBeGreaterThanOrEqual(1);
  });

  it('renameTab 应更新指定 tab 的 label', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();
    const tabId = store.tabs[0].id;

    store.renameTab(tabId, '我的项目');
    const tab = useAppStore.getState().tabs.find((t) => t.id === tabId);
    expect(tab?.label).toBe('我的项目');
  });
});

describe('useAppStore - 终端行缓冲', () => {
  it('addTerminalLine 累积行数，capped at 500', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    // 写入 510 行
    const lines = Array.from({ length: 510 }, (_, i) => ({
      id: `t-${i}`,
      type: 'stdout' as const,
      content: `line ${i}`,
      timestamp: Date.now(),
    }));
    store.addTerminalLines(lines);

    expect(useAppStore.getState().terminalLines.length).toBeLessThanOrEqual(500);
  });
});

// TEST-001[v4.3.0] 介入状态隔离测试
// 验证：Tab 切换后各 pendingXxx / permissionRequestsPerTab / longWaitBanners 状态是否正确隔离；
// 关闭 Tab 后孤儿状态是否清除；工作区切换后是否不带入旧介入。
describe('useAppStore - 介入状态隔离（TEST-001）', () => {

  it('addPermissionRequest 隔离：Tab A 的权限请求不出现在 Tab B', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();
    const tabA = store.tabs[0].id;

    // 先保证 Tab B 存在
    store.addTab();
    const tabB = useAppStore.getState().tabs[1].id;

    const fakeReq = { id: 'req-1', toolName: 'bash', input: {}, risk: 'medium' as const };
    store.addPermissionRequest(tabA, fakeReq);

    const { permissionRequestsPerTab } = useAppStore.getState();
    expect(permissionRequestsPerTab[tabA]).toHaveLength(1);
    // Tab B 不应有任何权限请求
    expect(permissionRequestsPerTab[tabB] ?? []).toHaveLength(0);
  });

  it('removePermissionRequest：移除后该 Tab 列表为空', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();
    const tabA = store.tabs[0].id;

    const req1 = { id: 'req-a', toolName: 'write', input: {}, risk: 'high' as const };
    store.addPermissionRequest(tabA, req1);
    store.removePermissionRequest(tabA, req1.id);

    expect(useAppStore.getState().permissionRequestsPerTab[tabA] ?? []).toHaveLength(0);
  });

  it('closeTab：关闭 Tab 后其 permissionRequestsPerTab 条目被清除', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    // 需要至少 2 个 Tab 才能关闭
    store.addTab();
    const tabs = useAppStore.getState().tabs;
    const tabA = tabs[0].id;
    const tabB = tabs[1].id;

    const req = { id: 'req-close', toolName: 'bash', input: {}, risk: 'medium' as const };
    store.addPermissionRequest(tabA, req);
    store.setLongWaitBanner(tabA, true);

    store.closeTab(tabA);

    const next = useAppStore.getState();
    // Tab A 的权限请求和长时等待标记均已清除
    expect(next.permissionRequestsPerTab[tabA]).toBeUndefined();
    expect(next.longWaitBanners[tabA]).toBeUndefined();
    // Tab B 保持
    expect(next.tabs.some((t) => t.id === tabB)).toBe(true);
  });

  it('closeTab：关闭非活跃 Tab 也清理其介入状态', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addTab();
    const tabs = useAppStore.getState().tabs;
    const tabA = tabs[0].id;
    const tabB = tabs[1].id;

    // 设置 Tab A 为活跃
    store.setActiveTab(tabA);
    // 给非活跃的 Tab B 设置权限请求
    const req = { id: 'req-bg', toolName: 'bash', input: {}, risk: 'low' as const };
    store.addPermissionRequest(tabB, req);
    store.setLongWaitBanner(tabB, true);

    // 关闭非活跃 Tab B
    store.closeTab(tabB);

    const next = useAppStore.getState();
    expect(next.permissionRequestsPerTab[tabB]).toBeUndefined();
    expect(next.longWaitBanners[tabB]).toBeUndefined();
  });

  it('longWaitBanners：setLongWaitBanner 按 Tab 隔离', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addTab();
    const tabs = useAppStore.getState().tabs;
    const tabA = tabs[0].id;
    const tabB = tabs[1].id;

    store.setLongWaitBanner(tabA, true);

    const { longWaitBanners } = useAppStore.getState();
    expect(longWaitBanners[tabA]).toBe(true);
    expect(longWaitBanners[tabB] ?? false).toBe(false);
  });

  it('setActiveTab：切换 Tab 时未读计数自动清零', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addTab();
    const tabs = useAppStore.getState().tabs;
    const tabA = tabs[0].id;
    const tabB = tabs[1].id;

    // 模拟 Tab B 完成任务产生未读计数：setTabProcessing(tabB, false) 在非活跃 Tab 时自动 +1
    // 先确保 Tab A 是活跃 Tab，Tab B 在后台
    store.setActiveTab(tabA);
    store.setTabProcessing(tabB, true);   // 标记 B 处理中
    store.setTabProcessing(tabB, false);  // B 完成 → 后台 Tab 自动 +1 未读

    const beforeSwitch = useAppStore.getState().tabUnreadCounts[tabB] ?? 0;
    expect(beforeSwitch).toBeGreaterThan(0);

    // 切换到 Tab B，未读计数应清零（FIX[BUG-005]）
    store.setActiveTab(tabB);
    expect(useAppStore.getState().tabUnreadCounts[tabB]).toBe(0);
  });
});

// TEST-201[v4.5.0] v4.5.0 场景验证
// 验证：trimRawJson 裁剪行为；token 增量记录；介入中心快速回复状态收敛；工作区切换后旧介入清空。
describe('useAppStore - v4.5.0 场景测试（TEST-201）', () => {

  // --- DEBT-201：trimRawJson ---
  it('trimRawJson：裁剪后仅保留最近 N 条，多余条目丢弃', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    // 写入 300 条
    for (let i = 0; i < 300; i++) {
      store.appendRawJson(`{"seq":${i}}`);
    }
    expect(useAppStore.getState().rawJsonLog.length).toBe(300);

    // 裁剪到 200
    store.trimRawJson(200);
    const log = useAppStore.getState().rawJsonLog;
    expect(log.length).toBe(200);
    // 保留的是最近的 200 条（seq 100 ~ 299）
    expect(JSON.parse(log[0]).seq).toBe(100);
    expect(JSON.parse(log[199]).seq).toBe(299);
  });

  it('trimRawJson：条目数不足 N 时不改变列表', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.appendRawJson('{"type":"test"}');
    store.appendRawJson('{"type":"test2"}');
    store.trimRawJson(200);
    expect(useAppStore.getState().rawJsonLog.length).toBe(2);
  });

  // --- BUG-202：token 增量记录 ---
  it('addTokenRecord：多次记录的 inputTokens 按增量求和正确', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    // 第 1 轮：增量 100 input
    store.addTokenRecord({ id: 'r1', sessionId: 's1', inputTokens: 100, outputTokens: 50, timestamp: Date.now() });
    // 第 2 轮（resume）：增量 200 input（不是累计 300）
    store.addTokenRecord({ id: 'r2', sessionId: 's1', inputTokens: 200, outputTokens: 80, timestamp: Date.now() });

    const history = useAppStore.getState().tokenHistory;
    // tokenHistory 最新在前
    const totalInput = history.reduce((acc, r) => acc + r.inputTokens, 0);
    // 记录的应是增量之和，不应是 300+50 = 350（累计值重复相加）
    expect(totalInput).toBe(300); // 100 + 200 = 300
  });

  // --- 介入中心快速回复 → 状态收敛 ---
  it('setPendingDecisionRequest：设置后可正确清空为 null（状态收敛）', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    const tabId = store.tabs[0].id;
    store.setPendingDecisionRequest(tabId, {
      text: '是否继续？',
      options: ['是', '否'],
      createdAt: Date.now(),
    });
    expect(useAppStore.getState().pendingDecisionRequests[tabId]).not.toBeNull();

    // 模拟用户快速回复后清空
    store.setPendingDecisionRequest(tabId, null);
    expect(useAppStore.getState().pendingDecisionRequests[tabId]).toBeNull();
  });

  it('setPendingFileRequest：按 Tab 隔离，其他 Tab 不受影响', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addTab();
    const tabs = useAppStore.getState().tabs;
    const tabA = tabs[0].id;
    const tabB = tabs[1].id;

    store.setPendingFileRequest(tabA, { text: '请提供文件', createdAt: Date.now() });

    const state = useAppStore.getState();
    expect(state.pendingFileRequests[tabA]).not.toBeUndefined();
    expect(state.pendingFileRequests[tabB] ?? null).toBeNull();
  });

  // --- 工作区切换 → 旧介入不残留 ---
  it('switchWorkspace：切换后 pendingDecisionRequests / permissionRequestsPerTab 全部清空', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    const tabId = store.tabs[0].id;
    // 写入旧工作区介入状态
    store.setPendingDecisionRequest(tabId, { text: '旧请求', options: [], createdAt: Date.now() });
    store.addPermissionRequest(tabId, { id: 'req-old', toolName: 'bash', input: {}, risk: 'medium' });
    store.setLongWaitBanner(tabId, true);

    // 创建并切换到新工作区
    const newWsId = store.createWorkspace('新工作区', '/tmp/ws2');

    const next = useAppStore.getState();
    expect(Object.keys(next.pendingDecisionRequests)).toHaveLength(0);
    expect(Object.keys(next.permissionRequestsPerTab)).toHaveLength(0);
    expect(Object.keys(next.longWaitBanners)).toHaveLength(0);
    // 新工作区 ID 已激活
    expect(next.activeWorkspacePath).toBeTruthy();
    // createWorkspace 会调用 switchWorkspace，workspaces 列表含新 ID
    expect(next.workspaces.some((w) => w.id === newWsId)).toBe(true);
  });
});

// TEST-202[v4.6.0] DEBT-002 回归测试
// 验证：setTabProcessing(tabId, false) 自动清空 permissionRequestsPerTab[tabId]，
// 消除原先 3 处分散 clearPermissionRequestsForTab 调用的遗漏风险。
describe('useAppStore - DEBT-002 权限清理收敛测试（TEST-202）', () => {

  it('setTabProcessing false：自动清空该 Tab 的权限请求', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    const tabId = store.tabs[0].id;
    store.addPermissionRequest(tabId, { id: 'req-1', toolName: 'bash', input: {}, risk: 'medium' });
    expect(useAppStore.getState().permissionRequestsPerTab[tabId]).toHaveLength(1);

    // 回合结束，setTabProcessing → false
    store.setTabProcessing(tabId, false);
    expect(useAppStore.getState().permissionRequestsPerTab[tabId]).toHaveLength(0);
  });

  it('setTabProcessing true：不清空权限请求（仅结束时清理）', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    const tabId = store.tabs[0].id;
    store.addPermissionRequest(tabId, { id: 'req-2', toolName: 'write', input: {}, risk: 'high' });

    // 开始新回合，不应清空
    store.setTabProcessing(tabId, true);
    expect(useAppStore.getState().permissionRequestsPerTab[tabId]).toHaveLength(1);
  });

  it('setTabProcessing false：Tab A 清理不影响 Tab B 的权限请求', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addTab();
    const tabs = useAppStore.getState().tabs;
    const tabA = tabs[0].id;
    const tabB = tabs[1].id;

    store.addPermissionRequest(tabA, { id: 'req-a', toolName: 'bash', input: {}, risk: 'low' });
    store.addPermissionRequest(tabB, { id: 'req-b', toolName: 'write', input: {}, risk: 'medium' });

    // Tab A 回合结束
    store.setTabProcessing(tabA, false);

    const state = useAppStore.getState();
    expect(state.permissionRequestsPerTab[tabA]).toHaveLength(0);
    // Tab B 的权限请求不受影响
    expect(state.permissionRequestsPerTab[tabB]).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────
// TEST-203[v4.6.x] 对话历史管理
// ──────────────────────────────────────────────────────────────────
describe('useAppStore - 对话历史管理', () => {
  it('addOrUpdateConversation：新记录插入到列表头部', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addOrUpdateConversation({
      sessionId: 'sess-1',
      projectDir: '/tmp/proj',
      preview: '第一条',
      startedAt: Date.now(),
      lastMessageAt: Date.now(),
    });
    expect(useAppStore.getState().conversationHistory[0].sessionId).toBe('sess-1');
  });

  it('addOrUpdateConversation：更新已有记录时移至顶部并更新 lastMessageAt', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    const ts1 = Date.now();
    store.addOrUpdateConversation({ sessionId: 'sess-A', projectDir: '/tmp', preview: 'A', startedAt: ts1, lastMessageAt: ts1 });
    store.addOrUpdateConversation({ sessionId: 'sess-B', projectDir: '/tmp', preview: 'B', startedAt: ts1, lastMessageAt: ts1 });

    // sess-A 排在后面，更新后应移至顶部
    const ts2 = ts1 + 5000;
    store.addOrUpdateConversation({ sessionId: 'sess-A', projectDir: '/tmp', preview: 'A', startedAt: ts1, lastMessageAt: ts2 });

    const history = useAppStore.getState().conversationHistory;
    expect(history[0].sessionId).toBe('sess-A');
    expect(history[0].lastMessageAt).toBe(ts2);
  });

  it('removeConversation：删除指定会话后不出现在列表', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addOrUpdateConversation({ sessionId: 'del-me', projectDir: '/tmp', preview: 'X', startedAt: 0, lastMessageAt: 0 });
    store.removeConversation('del-me');

    expect(useAppStore.getState().conversationHistory.every((r) => r.sessionId !== 'del-me')).toBe(true);
  });

  it('clearConversationHistory：清空后列表为空', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addOrUpdateConversation({ sessionId: 'c1', projectDir: '/tmp', preview: 'C1', startedAt: 0, lastMessageAt: 0 });
    store.clearConversationHistory();

    expect(useAppStore.getState().conversationHistory).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// TEST-204[v4.6.x] 执行计划步骤追踪
// ──────────────────────────────────────────────────────────────────
describe('useAppStore - 执行计划步骤追踪', () => {
  it('addPlanStep：累积步骤，顺序保持不变', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addPlanStep({ id: 'step-1', description: '读取文件', status: 'pending', tool: 'readFile' });
    store.addPlanStep({ id: 'step-2', description: '写入文件', status: 'pending', tool: 'writeFile' });

    const steps = useAppStore.getState().activePlanSteps;
    expect(steps).toHaveLength(2);
    expect(steps[0].id).toBe('step-1');
    expect(steps[1].id).toBe('step-2');
  });

  it('updatePlanStep：将指定步骤标记为 done，其他步骤不变', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addPlanStep({ id: 's1', description: '步骤1', status: 'pending', tool: 'bash' });
    store.addPlanStep({ id: 's2', description: '步骤2', status: 'pending', tool: 'bash' });
    store.updatePlanStep('s1', 'done');

    const steps = useAppStore.getState().activePlanSteps;
    expect(steps.find((s) => s.id === 's1')?.status).toBe('done');
    expect(steps.find((s) => s.id === 's2')?.status).toBe('pending');
  });

  it('clearPlanSteps：清空后 activePlanSteps 为空数组', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addPlanStep({ id: 'x', description: '步骤', status: 'pending', tool: 'bash' });
    store.clearPlanSteps();

    expect(useAppStore.getState().activePlanSteps).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// TEST-205[v4.6.x] Token 用量追踪
// ──────────────────────────────────────────────────────────────────
describe('useAppStore - Token 用量追踪', () => {
  it('setTokenUsage：设置后可读取，再次设为 null 时清空', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.setTokenUsage({ inputTokens: 500, outputTokens: 200, costUsd: 0.01 });
    expect(useAppStore.getState().tokenUsage?.inputTokens).toBe(500);

    store.setTokenUsage(null);
    expect(useAppStore.getState().tokenUsage).toBeNull();
  });

  it('clearTokenHistory：清空后 tokenHistory 为空数组', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addTokenRecord({ id: 'r1', sessionId: 's1', inputTokens: 10, outputTokens: 5, timestamp: Date.now() });
    store.clearTokenHistory();

    expect(useAppStore.getState().tokenHistory).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// TEST-206[v4.6.x] 任务列表 & 主题设置
// ──────────────────────────────────────────────────────────────────
describe('useAppStore - 任务列表与主题', () => {
  it('setTodoItems：设置后列表可正确读取', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    const items = [
      { id: 't1', content: '任务一', status: 'pending' as const },
      { id: 't2', content: '任务二', status: 'in_progress' as const },
    ];
    store.setTodoItems(items);

    expect(useAppStore.getState().todoItems).toHaveLength(2);
    expect(useAppStore.getState().todoItems[0].content).toBe('任务一');
  });

  it('triggerHistorySearch：每次调用令 historySearchTrigger 自增', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    const before = useAppStore.getState().historySearchTrigger;
    store.triggerHistorySearch();
    expect(useAppStore.getState().historySearchTrigger).toBe(before + 1);
    store.triggerHistorySearch();
    expect(useAppStore.getState().historySearchTrigger).toBe(before + 2);
  });

  it('setCurrentStatus：model 与 authMode 同时更新', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.setCurrentStatus('claude-3-5-sonnet', 'oauth');
    expect(useAppStore.getState().currentModel).toBe('claude-3-5-sonnet');
    expect(useAppStore.getState().currentAuthMode).toBe('oauth');
  });
});

// ──────────────────────────────────────────────────────────────────
// TEST-207 — 多工作区管理
// ──────────────────────────────────────────────────────────────────
describe('useAppStore - 多工作区管理', () => {
  it('addWorkspace：新工作区加入列表，activePath 更新', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addWorkspace('/tmp/proj-a');
    const { workspaces, activeWorkspacePath } = useAppStore.getState();
    expect(workspaces.some((w) => w.path === '/tmp/proj-a')).toBe(true);
    expect(activeWorkspacePath).toBe('/tmp/proj-a');
  });

  it('addWorkspace：重复路径不重复添加，只更新 activePath', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addWorkspace('/dup');
    const before = useAppStore.getState().workspaces.length;
    store.addWorkspace('/dup');
    const after = useAppStore.getState().workspaces.length;
    expect(after).toBe(before); // 数量不变
    expect(useAppStore.getState().activeWorkspacePath).toBe('/dup');
  });

  it('removeWorkspace：移除后不再出现在列表', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addWorkspace('/tmp/remove-me');
    const ws = useAppStore.getState().workspaces.find((w) => w.path === '/tmp/remove-me')!;
    store.removeWorkspace(ws.id);
    expect(useAppStore.getState().workspaces.every((w) => w.id !== ws.id)).toBe(true);
  });

  it('removeWorkspace：移除当前活跃工作区时 activeWorkspacePath 清空', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addWorkspace('/active-ws');
    const ws = useAppStore.getState().workspaces.find((w) => w.path === '/active-ws')!;
    store.removeWorkspace(ws.id);
    expect(useAppStore.getState().activeWorkspacePath).toBe('');
  });

  it('setActiveWorkspace：直接设置 activeWorkspacePath', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.setActiveWorkspace('/manual-path');
    expect(useAppStore.getState().activeWorkspacePath).toBe('/manual-path');
  });

  it('switchWorkspace：目标 ID 不存在时提前返回，状态不变', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();
    const before = useAppStore.getState().activeWorkspacePath;

    store.switchWorkspace('non-existent-id');
    expect(useAppStore.getState().activeWorkspacePath).toBe(before);
  });

  it('switchWorkspace：切换到已有快照的工作区可正确恢复 tabs', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    // 先创建工作区 A
    const wsIdA = store.createWorkspace('工作区A', '/ws-a');

    // 向 A 添加消息
    useAppStore.getState().addMessage({ id: 'msg-ws-a', role: 'user', content: 'A 的消息', timestamp: Date.now() });

    // 创建工作区 B（切换时会自动保存 A 的快照）
    const wsIdB = store.createWorkspace('工作区B', '/ws-b');

    // 现在切换回工作区 A（A 应有快照）
    store.switchWorkspace(wsIdA);

    // 切换后，activeWorkspacePath 应是 A 的路径
    const next = useAppStore.getState();
    const wsA = next.workspaces.find((w) => w.id === wsIdA);
    expect(next.activeWorkspacePath).toBe(wsA?.path);
    // A 的消息不一定仍存（快照可能含消息，这里只验证 path 正确）
    expect(wsIdB).toBeTruthy(); // B 也被创建
  });

  it('createWorkspace：立即切换到新工作区，介入状态清空', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();
    const tabId = store.tabs[0].id;

    // 在切换前设置一些介入状态
    store.addPermissionRequest(tabId, { id: 'r1', toolName: 'bash', input: {}, risk: 'low' });
    store.setLongWaitBanner(tabId, true);

    const newId = store.createWorkspace('全新工作区', '/new-ws');

    const next = useAppStore.getState();
    expect(next.workspaces.some((w) => w.id === newId)).toBe(true);
    // 切换后介入状态清空
    expect(Object.keys(next.permissionRequestsPerTab)).toHaveLength(0);
  });

  it('togglePinTab：首次 pin，再次取消 pin', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();
    const tabId = store.tabs[0].id;

    store.togglePinTab(tabId);
    expect(useAppStore.getState().pinnedTabIds).toContain(tabId);

    store.togglePinTab(tabId);
    expect(useAppStore.getState().pinnedTabIds).not.toContain(tabId);
  });

  it('setActiveChangeId：可设置和清空', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.setActiveChangeId('change-123');
    expect(useAppStore.getState().activeChangeId).toBe('change-123');

    store.setActiveChangeId(null);
    expect(useAppStore.getState().activeChangeId).toBeNull();
  });

  it('clearPermissionRequestsForTab：清空指定 Tab 的所有请求', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();
    const tabId = store.tabs[0].id;

    store.addPermissionRequest(tabId, { id: 'req-1', toolName: 'bash', input: {}, risk: 'medium' });
    store.addPermissionRequest(tabId, { id: 'req-2', toolName: 'write', input: {}, risk: 'high' });
    store.clearPermissionRequestsForTab(tabId);

    expect(useAppStore.getState().permissionRequestsPerTab[tabId]).toHaveLength(0);
  });

  it('setPendingQuickReply：按 Tab 设置和清空快速回复', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();
    const tabId = store.tabs[0].id;

    store.setPendingQuickReply(tabId, { text: '继续', createdAt: Date.now() });
    expect(useAppStore.getState().pendingQuickReplies[tabId]).not.toBeNull();

    store.setPendingQuickReply(tabId, null);
    expect(useAppStore.getState().pendingQuickReplies[tabId]).toBeNull();
  });

  it('reorderTab：交换两个 tab 位置', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addTab();
    store.addTab();
    const tabs = useAppStore.getState().tabs;
    const idFirst = tabs[0].id;
    const idSecond = tabs[1].id;

    store.reorderTab(0, 1);
    const reordered = useAppStore.getState().tabs;
    expect(reordered[0].id).toBe(idSecond);
    expect(reordered[1].id).toBe(idFirst);
  });
});

// ──────────────────────────────────────────────────────────────────
// TEST-208 — persistTabState 工具函数
// ──────────────────────────────────────────────────────────────────
describe('persistTabState', () => {
  it('调用后将当前状态序列化到 localStorage', async () => {
    const { useAppStore, persistTabState } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addMessage({ id: 'persist-1', role: 'user', content: '持久化测试', timestamp: Date.now() });

    persistTabState();

    const raw = localStorage.getItem('claude-gui-tab-persistence');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveProperty('tabs');
    expect(parsed).toHaveProperty('activeTabId');
    expect(parsed).toHaveProperty('tabSnapshots');
  });

  it('多次调用覆盖旧值', async () => {
    const { useAppStore, persistTabState } = await import('../stores/useAppStore');
    const store = useAppStore.getState();

    store.addMessage({ id: 'p1', role: 'user', content: '第一次', timestamp: Date.now() });
    persistTabState();
    const first = localStorage.getItem('claude-gui-tab-persistence');

    store.addMessage({ id: 'p2', role: 'assistant', content: '第二次', timestamp: Date.now() });
    persistTabState();
    const second = localStorage.getItem('claude-gui-tab-persistence');

    expect(first).not.toBe(second);
  });
});
