/**
 * ChatPanel 空状态渲染测试
 * 覆盖：初次启动欢迎引导、已配置提示、会话连接后提示、消息渲染
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';

// jsdom 不实现 scrollIntoView，统一 mock 掉
Element.prototype.scrollIntoView = vi.fn();

// ──────────────────────────────────────────
// electronAPI mock（ChatPanel 挂载时使用）
// ──────────────────────────────────────────
const mockElectronAPI = {
  onCliOutput: vi.fn().mockReturnValue(() => {}),
  loadSettings: vi.fn().mockResolvedValue({ success: true, settings: { model: 'claude-3-5-sonnet', permissionMode: 'auto' } }),
  loadCliConfig: vi.fn().mockResolvedValue({ success: true, settings: {} }),
  agentList: vi.fn().mockResolvedValue({ success: true, agents: [] }),
  listDirectory: vi.fn().mockResolvedValue({ success: false }),
  selectDirectory: vi.fn().mockResolvedValue({ success: false, path: null }),
  cliStart: vi.fn().mockResolvedValue({ success: false }),
  cliStop: vi.fn().mockResolvedValue({ success: false }),
  cliSendMessage: vi.fn().mockResolvedValue({ success: false }),
  cliSendToStdin: vi.fn().mockResolvedValue({ success: false }),
  cliRespondPermission: vi.fn().mockResolvedValue({ success: false }),
  cliRespondQuestion: vi.fn().mockResolvedValue({ success: false }),
  saveSettings: vi.fn().mockResolvedValue({ success: false }),
  getAuthStatus: vi.fn().mockResolvedValue({ success: false }),
};

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = mockElectronAPI;
  // 重置 store：清空消息、设置未连接
  useAppStore.setState({
    messages: [],
    session: { isConnected: false, workingDirectory: '' },
  });
  // 清空 onboarding 标志
  localStorage.removeItem('claude-gui-onboarding-v1');
});

afterEach(() => {
  // 恢复 vi.fn 到原始状态
  vi.clearAllMocks();
  mockElectronAPI.onCliOutput.mockReturnValue(() => {});
  mockElectronAPI.loadSettings.mockResolvedValue({ success: true, settings: { model: 'claude-3-5-sonnet', permissionMode: 'auto' } });
  mockElectronAPI.loadCliConfig.mockResolvedValue({ success: true, settings: {} });
  mockElectronAPI.agentList.mockResolvedValue({ success: true, agents: [] });
});

// ──────────────────────────────────────────
// 情景 1：首次启动（localStorage 未设置 onboarding）
// ──────────────────────────────────────────
describe('ChatPanel - 首次启动欢迎引导（session 未连接）', () => {
  it('应显示"Claude Code GUI"标题', async () => {
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      expect(screen.getByText('Claude Code GUI')).toBeInTheDocument();
    });
  });

  it('应显示欢迎语"欢迎使用 Claude Code GUI"', async () => {
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      expect(screen.getByText(/欢迎使用 Claude Code GUI/)).toBeInTheDocument();
    });
  });

  it('应显示"去配置 API Key"快捷按钮', async () => {
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /去配置 API Key/ })).toBeInTheDocument();
    });
  });

  it('应渲染底部输入框', async () => {
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    // 等待组件完整渲染
    await waitFor(() => {
      const textareas = document.querySelectorAll('textarea');
      expect(textareas.length).toBeGreaterThan(0);
    });
  });
});

// ──────────────────────────────────────────
// 情景 2：已完成 onboarding，session 仍未连接
// ──────────────────────────────────────────
describe('ChatPanel - 已配置但会话未连接', () => {
  beforeEach(() => {
    localStorage.setItem('claude-gui-onboarding-v1', '1');
  });

  it('应显示"请点击右上角「启动」按钮"提示', async () => {
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      expect(screen.getByText(/请点击右上角.*启动.*按钮/)).toBeInTheDocument();
    });
  });

  it('不应显示欢迎引导卡片', async () => {
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      expect(screen.queryByText('✓ 直接开始')).not.toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────
// 情景 3：session 已连接，无消息
// ──────────────────────────────────────────
describe('ChatPanel - 会话已连接，无消息', () => {
  beforeEach(() => {
    useAppStore.setState({
      messages: [],
      session: { isConnected: true, workingDirectory: '/my/project' },
    });
  });

  it('应显示"有什么可以帮你的？"', async () => {
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      expect(screen.getByText('有什么可以帮你的？')).toBeInTheDocument();
    });
  });

  it('应显示快捷建议按钮（"帮我修复 Bug"）', async () => {
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      expect(screen.getByText('帮我修复 Bug')).toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────
// 情景 4：有消息时渲染消息列表
// ──────────────────────────────────────────
describe('ChatPanel - 消息列表渲染', () => {
  beforeEach(() => {
    useAppStore.setState({
      messages: [
        { id: 'msg-1', role: 'user', content: '你好，Claude', timestamp: Date.now() - 2000 },
        { id: 'msg-2', role: 'assistant', content: '你好！有什么我可以帮你的？', timestamp: Date.now() - 1000 },
      ],
      session: { isConnected: true, workingDirectory: '/my/project' },
    });
  });

  it('有消息时不应显示空状态引导', async () => {
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      expect(screen.queryByText('Claude Code GUI')).not.toBeInTheDocument();
    });
  });

  it('应渲染用户消息文本', async () => {
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      expect(screen.getByText('你好，Claude')).toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────
// 情景 5：已恢复历史会话（有 conversationSessionId）
// ──────────────────────────────────────────
describe('ChatPanel - 恢复历史会话状态', () => {
  beforeEach(() => {
    useAppStore.setState({
      messages: [],
      session: { isConnected: false, workingDirectory: '', conversationSessionId: 'sess-abc-123' },
    });
  });

  it('有 conversationSessionId 时应显示"已恢复历史会话"', async () => {
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      expect(screen.getByText('已恢复历史会话')).toBeInTheDocument();
    });
  });
});
