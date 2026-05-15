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
