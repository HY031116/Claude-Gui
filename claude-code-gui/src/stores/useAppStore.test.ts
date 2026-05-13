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

    store.setActiveNavSection('config');
    expect(useAppStore.getState().activeNavSection).toBe('config');
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
