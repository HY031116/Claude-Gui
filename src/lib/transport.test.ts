/**
 * transport.test.ts
 * 测试 transport.ts：isElectron / webInvoke / ensureSSE / webAPI / api 导出
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── 全局 mock ────────────────────────────────────────────────────────────────

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  // 辅助：主动触发消息
  emit(data: string) {
    this.onmessage?.({ data } as MessageEvent<string>);
  }
  // 辅助：主动触发错误
  triggerError() {
    this.onerror?.();
  }
}

vi.stubGlobal('EventSource', MockEventSource);

// Mock window.open
const mockOpen = vi.fn();
vi.stubGlobal('open', mockOpen);

// ── 辅助：清除模块缓存，确保每次 import 拿到新实例 ────────────────────────────

beforeEach(() => {
  MockEventSource.instances = [];
  mockFetch.mockReset();
  mockOpen.mockReset();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── isElectron ────────────────────────────────────────────────────────────────

describe('isElectron', () => {
  it('没有 electronAPI 时返回 false', async () => {
    const win = window as Record<string, unknown>;
    delete win.electronAPI;
    const { isElectron } = await import('./transport');
    expect(isElectron()).toBe(false);
  });

  it('有 electronAPI 时返回 true', async () => {
    (window as Record<string, unknown>).electronAPI = { cliStop: vi.fn() };
    const { isElectron } = await import('./transport');
    expect(isElectron()).toBe(true);
    delete (window as Record<string, unknown>).electronAPI;
  });
});

// ── webAPI.cliStart ───────────────────────────────────────────────────────────

describe('webAPI — webInvoke（fetch 路径）', () => {
  it('成功响应时返回 json 数据', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });
    const { webAPI } = await import('./transport');
    const result = await webAPI.cliStop();
    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5175/api/invoke/cli:stop',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('HTTP 4xx 时抛出包含状态码的错误', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    const { webAPI } = await import('./transport');
    await expect(webAPI.cliStop()).rejects.toThrow('[transport] HTTP 404: cli:stop');
  });

  it('loadSettings 调用正确 channel', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, settings: {} }),
    });
    const { webAPI } = await import('./transport');
    await webAPI.loadSettings();
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5175/api/invoke/settings:load',
      expect.anything(),
    );
  });

  it('getAuthStatus 调用正确 channel', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, authStatus: { loggedIn: false } }),
    });
    const { webAPI } = await import('./transport');
    await webAPI.getAuthStatus();
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5175/api/invoke/auth:status',
      expect.anything(),
    );
  });

  it('listFilesInDir 正确传递参数', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, files: [] }),
    });
    const { webAPI } = await import('./transport');
    await webAPI.listFilesInDir('/project', 'src');
    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body).toEqual(['/project', 'src']);
  });

  it('gitCommit 正确传递 cwd 和 message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });
    const { webAPI } = await import('./transport');
    await webAPI.gitCommit('/repo', 'feat: test commit');
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toContain('git:commit');
    const body = JSON.parse(call[1].body as string);
    expect(body).toEqual(['/repo', 'feat: test commit']);
  });
});

// ── webAPI.selectDirectory / selectFile / saveFileDialog ─────────────────────

describe('webAPI — 对话框降级实现', () => {
  it('selectDirectory 返回 success:true, path:null（Web 模式降级）', async () => {
    const { webAPI } = await import('./transport');
    const result = await webAPI.selectDirectory();
    expect(result).toEqual({ success: true, path: null });
  });

  it('selectFile 返回 success:true, path:null', async () => {
    const { webAPI } = await import('./transport');
    const result = await webAPI.selectFile();
    expect(result).toEqual({ success: true, path: null });
  });

  it('saveFileDialog 返回 success:true, path:null', async () => {
    const { webAPI } = await import('./transport');
    const result = await webAPI.saveFileDialog();
    expect(result).toEqual({ success: true, path: null });
  });

  it('setNativeTheme 返回 success:true', async () => {
    const { webAPI } = await import('./transport');
    const result = await webAPI.setNativeTheme('dark');
    expect(result).toEqual({ success: true });
  });
});

// ── webAPI.onUpdateStatus ─────────────────────────────────────────────────────

describe('webAPI — 更新相关', () => {
  it('onUpdateStatus 返回空取消函数（Web 模式下无自动更新）', async () => {
    const { webAPI } = await import('./transport');
    const cancel = webAPI.onUpdateStatus(() => {});
    expect(typeof cancel).toBe('function');
    expect(() => cancel()).not.toThrow();
  });

  it('installUpdate 调用 window.open 打开 GitHub Releases 页面', async () => {
    const { webAPI } = await import('./transport');
    webAPI.installUpdate();
    expect(mockOpen).toHaveBeenCalledWith(
      expect.stringContaining('github.com'),
      '_blank',
    );
  });
});

// ── webAPI.onCliOutput（SSE）─────────────────────────────────────────────────

describe('webAPI — SSE / onCliOutput', () => {
  it('订阅后创建 EventSource 连接', async () => {
    const { webAPI } = await import('./transport');
    const unsub = webAPI.onCliOutput(() => {});
    expect(MockEventSource.instances.length).toBe(1);
    expect(MockEventSource.instances[0].url).toContain('/api/events');
    unsub();
  });

  it('重复订阅不创建多个 EventSource', async () => {
    const { webAPI } = await import('./transport');
    const unsub1 = webAPI.onCliOutput(() => {});
    const unsub2 = webAPI.onCliOutput(() => {});
    expect(MockEventSource.instances.length).toBe(1);
    unsub1();
    unsub2();
  });

  it('收到 cli:output 消息时回调被触发', async () => {
    const callback = vi.fn();
    const { webAPI } = await import('./transport');
    const unsub = webAPI.onCliOutput(callback);

    const sse = MockEventSource.instances[0];
    const payload = { type: 'stdout', content: 'hello', tabId: 'tab-1' };
    sse.emit(JSON.stringify({ channel: 'cli:output', payload }));

    expect(callback).toHaveBeenCalledWith(payload);
    unsub();
  });

  it('取消订阅后不再收到消息', async () => {
    const callback = vi.fn();
    const { webAPI } = await import('./transport');
    const unsub = webAPI.onCliOutput(callback);

    const sse = MockEventSource.instances[0];
    unsub();

    const payload = { type: 'stdout', content: 'after unsub', tabId: 'tab-1' };
    sse.emit(JSON.stringify({ channel: 'cli:output', payload }));

    expect(callback).not.toHaveBeenCalled();
  });

  it('收到非 cli:output channel 的消息时 cli 回调不触发', async () => {
    const callback = vi.fn();
    const { webAPI } = await import('./transport');
    const unsub = webAPI.onCliOutput(callback);

    const sse = MockEventSource.instances[0];
    sse.emit(JSON.stringify({ channel: 'other:channel', payload: {} }));

    expect(callback).not.toHaveBeenCalled();
    unsub();
  });

  it('SSE 收到无效 JSON 时不抛出错误', async () => {
    const { webAPI } = await import('./transport');
    const unsub = webAPI.onCliOutput(() => {});
    const sse = MockEventSource.instances[0];
    expect(() => sse.emit('invalid-json{{')).not.toThrow();
    unsub();
  });
});

// ── webAPI.onNotificationClick（SSE 通知）─────────────────────────────────────

describe('webAPI — onNotificationClick', () => {
  it('收到 notify:send 带 tabId 时回调被触发', async () => {
    const callback = vi.fn();
    const { webAPI } = await import('./transport');
    const unsub = webAPI.onNotificationClick(callback);

    const sse = MockEventSource.instances[0];
    sse.emit(JSON.stringify({
      channel: 'notify:send',
      payload: { title: '任务完成', body: 'Tab 1 完成', tabId: 'tab-1' },
    }));

    expect(callback).toHaveBeenCalledWith('tab-1');
    unsub();
  });

  it('notify:send 不含 tabId 时不触发回调', async () => {
    const callback = vi.fn();
    const { webAPI } = await import('./transport');
    const unsub = webAPI.onNotificationClick(callback);

    const sse = MockEventSource.instances[0];
    sse.emit(JSON.stringify({
      channel: 'notify:send',
      payload: { title: '系统', body: '无 tab' },
    }));

    expect(callback).not.toHaveBeenCalled();
    unsub();
  });
});

// ── webAPI 其余 CLI 方法 ──────────────────────────────────────────────────────

describe('webAPI — 其余 CLI / FS / Git 方法（覆盖 webAPI 箭头函数行）', () => {
  function okJson(data: unknown) {
    return { ok: true, json: async () => data };
  }

  it('cliStart 调用 cli:start', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true }));
    const { webAPI } = await import('./transport');
    await webAPI.cliStart({ cwd: '/proj' } as never);
    expect(mockFetch.mock.calls[0][0]).toContain('cli:start');
  });

  it('cliSend 调用 cli:send', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true }));
    const { webAPI } = await import('./transport');
    await webAPI.cliSend('hello');
    expect(mockFetch.mock.calls[0][0]).toContain('cli:send');
  });

  it('cliSendMessage 调用 cli:sendMessage', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true }));
    const { webAPI } = await import('./transport');
    await webAPI.cliSendMessage('hi', '/cwd', undefined, [], undefined, 'tab-1', []);
    expect(mockFetch.mock.calls[0][0]).toContain('cli:sendMessage');
  });

  it('cliStopMessage 调用 cli:stopMessage', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true }));
    const { webAPI } = await import('./transport');
    await webAPI.cliStopMessage('tab-1');
    expect(mockFetch.mock.calls[0][0]).toContain('cli:stopMessage');
  });

  it('cliSendToStdin 调用 cli:sendToStdin', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true }));
    const { webAPI } = await import('./transport');
    await webAPI.cliSendToStdin('y\n');
    expect(mockFetch.mock.calls[0][0]).toContain('cli:sendToStdin');
  });

  it('cliRespondPermission 调用正确 channel', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true }));
    const { webAPI } = await import('./transport');
    await webAPI.cliRespondPermission('req-1', true);
    expect(mockFetch.mock.calls[0][0]).toContain('cli:respondPermission');
  });

  it('cliRespondQuestion 调用正确 channel', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true }));
    const { webAPI } = await import('./transport');
    await webAPI.cliRespondQuestion('req-2', ['答案']);
    expect(mockFetch.mock.calls[0][0]).toContain('cli:respondQuestion');
  });

  it('listDirectory 调用 fs:list', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true, entries: [] }));
    const { webAPI } = await import('./transport');
    await webAPI.listDirectory('/tmp');
    expect(mockFetch.mock.calls[0][0]).toContain('fs:list');
  });

  it('listSkills 调用 fs:listSkills', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true, skills: [] }));
    const { webAPI } = await import('./transport');
    await webAPI.listSkills('/cwd');
    expect(mockFetch.mock.calls[0][0]).toContain('fs:listSkills');
  });

  it('readFile 调用 fs:read', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true, content: '' }));
    const { webAPI } = await import('./transport');
    await webAPI.readFile('/tmp/file.txt');
    expect(mockFetch.mock.calls[0][0]).toContain('fs:read');
  });

  it('writeFile 调用 fs:write', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true }));
    const { webAPI } = await import('./transport');
    await webAPI.writeFile('/tmp/file.txt', 'content');
    expect(mockFetch.mock.calls[0][0]).toContain('fs:write');
  });

  it('saveCliConfig 调用 cli-config:save', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true }));
    const { webAPI } = await import('./transport');
    await webAPI.saveCliConfig({} as never);
    expect(mockFetch.mock.calls[0][0]).toContain('cli-config:save');
  });

  it('agentList 调用 agent:list', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true, agents: [] }));
    const { webAPI } = await import('./transport');
    await webAPI.agentList();
    expect(mockFetch.mock.calls[0][0]).toContain('agent:list');
  });

  it('agentWrite 调用 agent:write', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true }));
    const { webAPI } = await import('./transport');
    await webAPI.agentWrite('my-agent.md', 'content');
    expect(mockFetch.mock.calls[0][0]).toContain('agent:write');
  });

  it('agentDelete 调用 agent:delete', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true }));
    const { webAPI } = await import('./transport');
    await webAPI.agentDelete('my-agent.md');
    expect(mockFetch.mock.calls[0][0]).toContain('agent:delete');
  });

  it('pluginList 调用 plugin:list', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true, plugins: [] }));
    const { webAPI } = await import('./transport');
    await webAPI.pluginList();
    expect(mockFetch.mock.calls[0][0]).toContain('plugin:list');
  });

  it('gitStatus 调用 git:status', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true, status: null }));
    const { webAPI } = await import('./transport');
    await webAPI.gitStatus('/repo');
    expect(mockFetch.mock.calls[0][0]).toContain('git:status');
  });

  it('gitDiff 调用 git:diff', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true, diff: '' }));
    const { webAPI } = await import('./transport');
    await webAPI.gitDiff('/repo', 'file.ts', false);
    expect(mockFetch.mock.calls[0][0]).toContain('git:diff');
  });

  it('sessionList 调用 session:list', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true, sessions: [] }));
    const { webAPI } = await import('./transport');
    await webAPI.sessionList();
    expect(mockFetch.mock.calls[0][0]).toContain('session:list');
  });

  it('checkClaudeMem 调用 mem:check', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true }));
    const { webAPI } = await import('./transport');
    await webAPI.checkClaudeMem();
    expect(mockFetch.mock.calls[0][0]).toContain('mem:check');
  });

  it('notifySend 调用 notify:send（Notification.permission = denied，跳过权限请求）', async () => {
    // jsdom 没有 Notification，设置全局 stub
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() });
    mockFetch.mockResolvedValueOnce(okJson({ success: true }));
    const { webAPI } = await import('./transport');
    await webAPI.notifySend('title', 'body', 'tab-1');
    expect(mockFetch.mock.calls[0][0]).toContain('notify:send');
  });

  it('checkUpdate 调用 update:check', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true }));
    const { webAPI } = await import('./transport');
    await webAPI.checkUpdate();
    expect(mockFetch.mock.calls[0][0]).toContain('update:check');
  });
});

// ── SSE 错误重连 ──────────────────────────────────────────────────────────────

describe('webAPI — SSE 错误重连', () => {
  it('SSE 出错后关闭连接（通过 close()）', async () => {
    vi.useFakeTimers();
    const { webAPI } = await import('./transport');
    const unsub = webAPI.onCliOutput(() => {});

    const sse = MockEventSource.instances[0];
    sse.triggerError();

    expect(sse.close).toHaveBeenCalled();
    vi.useRealTimers();
    unsub();
  });
});

// ── api 导出选择逻辑 ──────────────────────────────────────────────────────────

describe('api 导出', () => {
  it('无 electronAPI 时 api === webAPI', async () => {
    const win = window as Record<string, unknown>;
    delete win.electronAPI;
    const { api, webAPI } = await import('./transport');
    expect(api).toBe(webAPI);
  });

  it('有 electronAPI 时 api === window.electronAPI', async () => {
    const fakeElectronAPI = { cliStop: vi.fn() };
    (window as Record<string, unknown>).electronAPI = fakeElectronAPI;
    const { api } = await import('./transport');
    expect(api).toBe(fakeElectronAPI);
    delete (window as Record<string, unknown>).electronAPI;
  });
});
